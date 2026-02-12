'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAccount, useChainId, usePublicClient, useWalletClient } from 'wagmi';
import { parseEther, keccak256, encodePacked, decodeEventLog } from 'viem';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { CoinFlipGameAbi, MockERC20Abi, TreasuryManagerAbi } from '@/contracts/abis';
import { getChainlinkVrfRequestUrl, loadDeployment } from '@/utils/deployments';

export default function CoinFlipPage() {
  const { address } = useAccount();
  const chainId = useChainId();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();

  const [deployment, setDeployment] = useState<any>(null);
  const [choice, setChoice] = useState<0 | 1>(0);
  const [betEth, setBetEth] = useState('0.05');
  const [useToken, setUseToken] = useState(false);
  const [secret, setSecret] = useState('0x' + '11'.repeat(32));
  const [requestId, setRequestId] = useState<string>('');
  const [status, setStatus] = useState<string>('');
  const [requestView, setRequestView] = useState<any>(null);
  const [outcomeView, setOutcomeView] = useState<any>(null);
  
  // Store committed values to prevent mismatches
  const [committedParams, setCommittedParams] = useState<{
    choice: 0 | 1;
    betEth: string;
    useToken: boolean;
    secret: string;
  } | null>(null);

  useEffect(() => {
    loadDeployment(chainId)
      .then(setDeployment)
      .catch((e) => setStatus(e.message));
  }, [chainId]);

  // Auto-refresh request view when requestId changes
  useEffect(() => {
    if (requestId && publicClient && deployment) {
      refreshViews();
      // Set up periodic refresh every 3 seconds while waiting for VRF
      const interval = setInterval(() => {
        refreshViews();
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [requestId, publicClient, deployment]);

  const commitment = useMemo(() => {
    if (!address || !deployment) return undefined;
    const wagerToken = useToken ? deployment.contracts.MockToken : '0x0000000000000000000000000000000000000000';
    const amount = parseEther(betEth);
    return keccak256(
      encodePacked(
        ['address', 'uint8', 'address', 'uint256', 'bytes32'],
        [address, choice, wagerToken, amount, secret as `0x${string}`]
      )
    );
  }, [address, choice, betEth, useToken, secret, deployment]);

  async function runCommit() {
    if (!walletClient || !publicClient || !deployment || !commitment) return;
    setStatus('Committing...');
    const commitValue = deployment?.config?.slashingDeposit
      ? BigInt(deployment.config.slashingDeposit)
      : parseEther('0.002');
    const hash = await walletClient.writeContract({
      address: deployment.contracts.CoinFlipGame,
      abi: CoinFlipGameAbi,
      functionName: 'commitBet',
      args: [commitment],
      value: commitValue,
    });
    await publicClient.waitForTransactionReceipt({ hash });
    
    // Store committed parameters
    setCommittedParams({ choice, betEth, useToken, secret });
    setStatus('Committed. Wait 120s then reveal.');
  }

  async function runFaucetAndDepositToken() {
    if (!walletClient || !publicClient || !deployment) return;
    setStatus('Faucet + approve + deposit...');

    const faucetTx = await walletClient.writeContract({
      address: deployment.contracts.MockToken,
      abi: MockERC20Abi,
      functionName: 'faucet',
      args: [],
    });
    await publicClient.waitForTransactionReceipt({ hash: faucetTx });

    const depositAmount = BigInt('100000000000000000000');

    const approveTx = await walletClient.writeContract({
      address: deployment.contracts.MockToken,
      abi: MockERC20Abi,
      functionName: 'approve',
      args: [deployment.contracts.TreasuryManager, depositAmount],
    });
    await publicClient.waitForTransactionReceipt({ hash: approveTx });

    const depositTx = await walletClient.writeContract({
      address: deployment.contracts.TreasuryManager,
      abi: TreasuryManagerAbi,
      functionName: 'depositToken',
      args: [deployment.contracts.MockToken, depositAmount],
    });
    await publicClient.waitForTransactionReceipt({ hash: depositTx });

    setStatus('Token ready in treasury balance. Switch to token mode & reveal.');
  }

  async function runDepositEth() {
    if (!walletClient || !publicClient || !deployment) return;
    setStatus('Depositing ETH to treasury...');
    const hash = await walletClient.writeContract({
      address: deployment.contracts.TreasuryManager,
      abi: TreasuryManagerAbi,
      functionName: 'deposit',
      args: [],
      value: parseEther(betEth),
    });
    await publicClient.waitForTransactionReceipt({ hash });
    setStatus('✅ ETH deposited successfully! You can now reveal your bet.');
  }

  async function runReveal() {
    if (!walletClient || !publicClient || !deployment) return;
    
    // Use committed parameters if available, otherwise current values
    const revealParams = committedParams || { choice, betEth, useToken, secret };
    
    if (!committedParams) {
      setStatus('⚠️ Warning: No commitment found. Using current values (may fail if different from commit).');
    }
    
    setStatus('🎲 Revealing your bet and requesting randomness...');

    const wagerToken = revealParams.useToken ? deployment.contracts.MockToken : '0x0000000000000000000000000000000000000000';
    const amount = parseEther(revealParams.betEth);

    const hash = await walletClient.writeContract({
      address: deployment.contracts.CoinFlipGame,
      abi: CoinFlipGameAbi,
      functionName: 'revealBet',
      args: [revealParams.choice, wagerToken, amount, revealParams.secret as any],
    });
    const receipt = await publicClient.waitForTransactionReceipt({ hash });

    const logs = await publicClient.getLogs({
      address: deployment.contracts.CoinFlipGame,
      fromBlock: receipt.blockNumber,
      toBlock: receipt.blockNumber,
    });

    let extracted: string | undefined;
    for (const l of logs) {
      try {
        const decoded = decodeEventLog({
          abi: CoinFlipGameAbi,
          data: l.data,
          topics: l.topics,
        });
        if (decoded.eventName === 'RandomnessRequested') {
          const args: any = decoded.args;
          extracted = args.requestId?.toString?.();
          break;
        }
      } catch {
        // ignore non-matching logs
      }
    }

    // Keep committed params for Step 4 display (will be cleared by resetGame)

    if (extracted) {
      setRequestId(extracted);
      setStatus(`✅ Reveal sent. requestId=${extracted}. Waiting for Chainlink VRF fulfillment...`);
    } else {
      setRequestId('');
      setStatus('Reveal sent. Wait for VRF fulfill, then settle. (requestId not detected; paste manually)');
    }
  }

  async function settle() {
    if (!walletClient || !publicClient || !deployment || !requestId) return;
    try {
      setStatus('⏳ Preflighting settleRequest...');
      await publicClient.simulateContract({
        address: deployment.contracts.CoinFlipGame,
        abi: CoinFlipGameAbi,
        functionName: 'settleRequest',
        args: [BigInt(requestId)],
        account: address as any,
      });

      setStatus('⏳ Settling bet (confirm in wallet)...');
      const hash = await walletClient.writeContract({
        address: deployment.contracts.CoinFlipGame,
        abi: CoinFlipGameAbi,
        functionName: 'settleRequest',
        args: [BigInt(requestId)],
      });
      setStatus(`⏳ settle tx sent: ${hash}. Waiting for confirmation...`);
      await publicClient.waitForTransactionReceipt({ hash });
      await refreshViews();
      setStatus('');
    } catch (e: any) {
      const msg = e?.shortMessage || e?.message || String(e);
      setStatus('❌ Settle failed: ' + msg);
    }
  }

  async function refreshViews() {
    if (!publicClient || !deployment || !requestId) return;
    const rid = BigInt(requestId);
    const req = await publicClient.readContract({
      address: deployment.contracts.CoinFlipGame,
      abi: CoinFlipGameAbi,
      functionName: 'getRequest',
      args: [rid],
    });
    setRequestView(req);

    if (req?.fulfilled && !req?.settled && !outcomeView?.exists) {
      setStatus('✅ VRF fulfilled. Click “Settle & See Result” to finalize.');
    }

    const out = await publicClient.readContract({
      address: deployment.contracts.CoinFlipGame,
      abi: CoinFlipGameAbi,
      functionName: 'getOutcome',
      args: [rid],
    });
    setOutcomeView(out);
  }

  const verifyUrl = deployment && requestId
    ? getChainlinkVrfRequestUrl({
        chainId,
        subscriptionId: deployment.config.vrfSubscriptionId,
        requestId,
      })
    : undefined;

  // Determine current step (check in order: outcome exists -> has requestId -> has commitment -> initial)
  const currentStep = outcomeView?.exists ? 4 : requestId ? 3 : committedParams ? 2 : 1;

  // Reset function for Play Again
  const resetGame = () => {
    setRequestId('');
    setCommittedParams(null);
    setRequestView(null);
    setOutcomeView(null);
    setStatus('');
  };

  return (
    <main className="min-h-screen flex flex-col">
      <Header />
      <div className="flex-grow container mx-auto px-4 py-10 text-white">
        <h1 className="font-pixel text-2xl mb-6 text-center">🪙 Coin Flip Game</h1>

        <div className="space-y-6 bg-black/40 p-8 rounded-lg border-4 border-black shadow-2xl max-w-2xl mx-auto">
          {/* Step Progress Indicator */}
          <div className="flex justify-between items-center mb-6">
            <div className={`flex-1 text-center ${currentStep >= 1 ? 'text-yellow-300' : 'text-gray-500'}`}>
              <div className="font-game text-lg">Step 1</div>
              <div className="text-xs">Choose & Commit</div>
            </div>
            <div className="text-2xl text-gray-500">→</div>
            <div className={`flex-1 text-center ${currentStep >= 2 ? 'text-yellow-300' : 'text-gray-500'}`}>
              <div className="font-game text-lg">Step 2</div>
              <div className="text-xs">Place Bet</div>
            </div>
            <div className="text-2xl text-gray-500">→</div>
            <div className={`flex-1 text-center ${currentStep >= 3 ? 'text-yellow-300' : 'text-gray-500'}`}>
              <div className="font-game text-lg">Step 3</div>
              <div className="text-xs">Reveal & Settle</div>
            </div>
            <div className="text-2xl text-gray-500">→</div>
            <div className={`flex-1 text-center ${currentStep >= 4 ? 'text-yellow-300' : 'text-gray-500'}`}>
              <div className="font-game text-lg">Step 4</div>
              <div className="text-xs">Results</div>
            </div>
          </div>

          {/* Step 1: Choose & Commit */}
          {!committedParams && !requestId && (
            <div className="bg-mario-red/20 p-6 rounded-lg border-2 border-black/50 shadow-lg">
              <h2 className="font-game text-xl mb-4">Step 1: Choose Your Side</h2>
              
              <div className="space-y-4">
                <div className="flex gap-4 items-center justify-center">
                  <button
                    className={`px-8 py-4 rounded-lg border-3 border-black shadow-md text-xl flex flex-col items-center gap-2 transition-all hover:scale-105 ${choice === 0 ? 'bg-yellow-500 text-black shadow-yellow-300/50' : 'bg-gray-700 hover:bg-gray-600'}`}
                    onClick={() => setChoice(0)}
                  >
                    <img src="/mario.png" alt="Mario" className="w-16 h-16 object-contain" />
                    <span>Mario (Heads)</span>
                  </button>
                  <button
                    className={`px-8 py-4 rounded-lg border-3 border-black shadow-md text-xl flex flex-col items-center gap-2 transition-all hover:scale-105 ${choice === 1 ? 'bg-green-500 text-black shadow-green-300/50' : 'bg-gray-700 hover:bg-gray-600'}`}
                    onClick={() => setChoice(1)}
                  >
                    <img src="/luigi.png" alt="Luigi" className="w-16 h-16 object-contain" />
                    <span>Luigi (Tails)</span>
                  </button>
                </div>

                <div className="space-y-2">
                  <label className="font-game block">Bet Amount (ETH)</label>
                  <input
                    className="text-black px-3 py-2 w-full text-lg"
                    type="number"
                    step="0.01"
                    value={betEth}
                    onChange={(e) => setBetEth(e.target.value)}
                    placeholder="0.05"
                  />
                </div>

                {/* Advanced options collapsed by default */}
                <details className="text-sm">
                  <summary className="font-game cursor-pointer">Advanced Options</summary>
                  <div className="mt-2 space-y-2 pl-4">
                    <div className="flex items-center gap-2">
                      <input type="checkbox" checked={useToken} onChange={(e) => setUseToken(e.target.checked)} />
                      <label className="font-game">Use MCT Token</label>
                    </div>
                    <div>
                      <label className="font-game block">Secret (bytes32 hex)</label>
                      <input className="text-black px-2 py-1 w-full text-xs" value={secret} onChange={(e) => setSecret(e.target.value)} />
                    </div>
                  </div>
                </details>

                <button 
                  className="w-full bg-mario-red hover:bg-red-600 px-6 py-3 rounded-lg border-2 border-black shadow-lg font-game text-lg transition-all hover:scale-[1.02]"
                  onClick={runCommit}
                  disabled={!address}
                >
                  Commit Choice (Pay 0.002 ETH Deposit)
                </button>
                <div className="bg-blue-900/40 border-2 border-blue-400/50 rounded-lg p-3 mt-3">
                  <div className="flex items-center gap-2 text-blue-200 text-sm">
                    <span className="text-xl">ℹ️</span>
                    <span className="font-game">This deposit ensures fair play and is refunded when you reveal</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Place Bet */}
          {committedParams && !requestId && (
            <div className="bg-mario-blue/20 p-6 rounded-lg border-2 border-black/50 shadow-lg">
              <h2 className="font-game text-xl mb-4">Step 2: Place Your Bet</h2>
              
              <div className="bg-black/40 p-4 rounded-lg border-2 border-gray-700 mb-4">
                <div className="font-game text-sm">
                  <div className="flex items-center gap-2">
                    <span>Choice:</span>
                    <img src={committedParams.choice === 0 ? '/mario.png' : '/luigi.png'} alt={committedParams.choice === 0 ? 'Mario' : 'Luigi'} className="w-8 h-8 object-contain inline" />
                    <span className="text-yellow-300">{committedParams.choice === 0 ? 'Mario (Heads)' : 'Luigi (Tails)'}</span>
                  </div>
                  <div>Amount: <span className="text-yellow-300">{committedParams.betEth} ETH</span></div>
                </div>
              </div>

              {!committedParams.useToken ? (
                <button
                  className="w-full bg-mario-blue hover:bg-blue-600 px-6 py-3 rounded-lg border-2 border-black shadow-lg font-game text-lg transition-all hover:scale-[1.02]"
                  onClick={runDepositEth}
                  disabled={!address}
                >
                  Place Bet ({committedParams.betEth} ETH)
                </button>
              ) : (
                <button
                  className="w-full bg-mario-yellow text-black hover:bg-yellow-500 px-6 py-3 rounded-lg border-2 border-black shadow-lg font-game text-lg transition-all hover:scale-[1.02]"
                  onClick={runFaucetAndDepositToken}
                  disabled={!address}
                >
                  Get MCT & Place Bet
                </button>
              )}

              <button
                className="w-full mt-3 bg-mario-green hover:bg-green-600 px-6 py-3 rounded-lg border-2 border-black shadow-lg font-game text-lg transition-all hover:scale-[1.02]"
                onClick={runReveal}
                disabled={!address}
              >
                Reveal Outcome →
              </button>
              <div className="bg-yellow-900/40 border-2 border-yellow-400/50 rounded-lg p-3 mt-3">
                <div className="flex items-center gap-2 text-yellow-200 text-sm">
                  <span className="text-xl">⏱️</span>
                  <span className="font-game">Wait 120 seconds after commit (see Testing Guide to skip)</span>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Reveal & Settle */}
          {requestId && !outcomeView?.exists && (
            <div className="bg-mario-green/20 p-6 rounded-lg border-2 border-black/50 shadow-lg">
              <h2 className="font-game text-xl mb-4">Step 3: Get Your Result</h2>
              
              <div className="bg-black/40 p-4 rounded-lg border-2 border-gray-700 mb-4">
                <div className="font-game text-sm space-y-1">
                  <div>Request ID: <span className="text-yellow-300">{requestId}</span></div>
                  {requestView && (
                    <>
                      <div>VRF Fulfilled: <span className={requestView.fulfilled ? 'text-green-400' : 'text-red-400'}>{String(requestView.fulfilled)}</span></div>
                      <div>Request Settled: <span className={requestView.settled ? 'text-green-400' : 'text-red-400'}>{String(requestView.settled)}</span></div>
                      {requestView.fulfilled && <div>Random: {requestView.randomWord?.toString?.()}</div>}
                    </>
                  )}
                </div>
              </div>

              {!requestView?.fulfilled && (
                <div className="mb-3 p-4 bg-yellow-900/50 rounded-lg border-2 border-yellow-400 shadow-lg animate-pulse">
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">⚠️</span>
                    <div className="flex-1">
                      <div className="text-yellow-200 font-game mb-2">Waiting for VRF fulfillment</div>
                      <div className="text-sm text-yellow-100 mb-2">Chainlink VRF will fulfill automatically on Sepolia. This can take a bit.</div>
                      {verifyUrl && (
                        <a className="inline-block underline text-blue-300 text-sm" href={verifyUrl} target="_blank" rel="noreferrer">
                          🔗 Verify VRF on Chainlink Explorer
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <button
                className="w-full bg-mario-green hover:bg-green-600 px-6 py-3 rounded-lg border-2 border-black shadow-lg font-game text-lg transition-all hover:scale-[1.02]"
                onClick={settle}
                disabled={!requestView?.fulfilled}
              >
                Settle & See Result
              </button>
            </div>
          )}

          {/* Step 4: Results & Play Again */}
          {outcomeView?.exists && (
            <div className="bg-gradient-to-b from-gray-800 to-gray-900 p-6 rounded-lg border-2 border-black/50 shadow-lg">
              <h2 className="font-game text-xl mb-4">Step 4: Game Results</h2>
              
              <div className={`p-6 rounded-lg border-3 border-black text-center mb-4 shadow-xl ${outcomeView.win ? 'bg-gradient-to-b from-green-600 to-green-800' : 'bg-gradient-to-b from-red-600 to-red-800'}`}>
                <div className="text-3xl font-game mb-4">{outcomeView.win ? '🎉 YOU WIN! 🎉' : '😢 YOU LOSE 😢'}</div>
                
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="bg-black/40 p-3 rounded-lg border-2 border-gray-700">
                    <div className="text-sm text-gray-400 mb-2">Your Choice</div>
                    <img src={outcomeView.playerChoice === 0 ? '/mario.png' : '/luigi.png'} alt="Your choice" className="w-16 h-16 object-contain mx-auto mb-2" />
                    <div className="font-game">{outcomeView.playerChoice === 0 ? 'Mario' : 'Luigi'}</div>
                  </div>
                  <div className="bg-black/40 p-3 rounded-lg border-2 border-gray-700">
                    <div className="text-sm text-gray-400 mb-2">Result</div>
                    <img src={outcomeView.outcome === 0 ? '/mario.png' : '/luigi.png'} alt="Result" className="w-16 h-16 object-contain mx-auto mb-2" />
                    <div className="font-game">{outcomeView.outcome === 0 ? 'Mario' : 'Luigi'}</div>
                  </div>
                </div>

                {outcomeView.win && (
                  <div className="text-yellow-300 text-2xl font-game mb-2">
                    💰 Payout: {(Number(outcomeView.payoutAmount) / 1e18).toFixed(4)} ETH
                  </div>
                )}
              </div>

              {/* Detailed Game Information */}
              <details className="mb-4">
                <summary className="font-game cursor-pointer bg-black/40 p-3 rounded-lg border-2 border-gray-700 hover:bg-black/60 transition-colors">View Detailed Game Info</summary>
                <div className="mt-2 bg-black/60 p-4 rounded-lg border-2 border-gray-700 text-sm space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="text-gray-400">Player Address:</div>
                    <div className="font-mono text-xs break-all">{address}</div>
                    
                    <div className="text-gray-400">Commitment Hash:</div>
                    <div className="font-mono text-xs break-all">{commitment}</div>
                    
                    <div className="text-gray-400">Request ID:</div>
                    <div className="font-mono text-xs">{requestId}</div>
                    
                    <div className="text-gray-400">VRF Fulfilled:</div>
                    <div className={requestView?.fulfilled ? 'text-green-400' : 'text-red-400'}>
                      {String(requestView?.fulfilled)}
                    </div>
                    
                    <div className="text-gray-400">Random Number:</div>
                    <div className="font-mono text-xs">{requestView?.randomWord?.toString?.() ?? 'N/A'}</div>
                    
                    <div className="text-gray-400">Game Resolved:</div>
                    <div className={outcomeView.exists ? 'text-green-400' : 'text-red-400'}>
                      {String(outcomeView.exists)}
                    </div>
                    
                    <div className="text-gray-400">Result:</div>
                    <div className={outcomeView.win ? 'text-green-400' : 'text-red-400'}>
                      {outcomeView.win ? 'WIN' : 'LOSE'}
                    </div>
                    
                    <div className="text-gray-400">Payout Amount:</div>
                    <div className="font-mono text-xs">{outcomeView.payoutAmount?.toString?.()} wei</div>
                  </div>
                  
                  {verifyUrl && (
                    <a className="block text-center underline text-blue-400 mt-3" href={verifyUrl} target="_blank" rel="noreferrer">
                      🔗 Verify VRF on Chainlink Explorer
                    </a>
                  )}
                </div>
              </details>

              <button
                className="w-full bg-mario-red hover:bg-red-600 px-6 py-3 rounded-lg border-2 border-black shadow-lg font-game text-lg transition-all hover:scale-[1.02]"
                onClick={resetGame}
              >
                🍄 Play Again
              </button>
            </div>
          )}

          {/* Status Message */}
          {!outcomeView?.exists && status && (
            <div className={`mt-4 p-4 rounded-lg border-2 shadow-lg text-center ${
              status.includes('✅') ? 'bg-green-900/40 border-green-400 text-green-200' :
              status.includes('⚠️') ? 'bg-yellow-900/40 border-yellow-400 text-yellow-200' :
              status.includes('❌') ? 'bg-red-900/40 border-red-400 text-red-200' :
              'bg-blue-900/40 border-blue-400 text-blue-200'
            }`}>
              <div className="font-game text-sm flex items-center justify-center gap-2">
                {(status.includes('🎲') || status.includes('⏳')) && (
                  <span className="inline-block animate-spin">⏳</span>
                )}
                <span>{status}</span>
              </div>
            </div>
          )}
        </div>
      </div>
      <Footer />
    </main>
  );
}
