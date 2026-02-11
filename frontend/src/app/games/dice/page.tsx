'use client';

import { useEffect, useState } from 'react';
import { useAccount, useChainId, usePublicClient, useWalletClient } from 'wagmi';
import { parseEther, keccak256, encodePacked, decodeEventLog } from 'viem';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { DiceGameAbi, MockERC20Abi, TreasuryManagerAbi } from '@/contracts/abis';
import { getChainlinkVrfRequestUrl, loadDeployment } from '@/utils/deployments';

type DiceTier = 0 | 1 | 2;

const TIER_INFO = {
  0: { name: '🍄 Mushroom', winChance: 70, multiplier: '1.5x', icon: '🍄' },
  1: { name: '⭐ Star', winChance: 20, multiplier: '10x', icon: '⭐' },
  2: { name: '🚀 1-up', winChance: 2, multiplier: '50x', icon: '🚀' },
};

export default function DicePage() {
  const { address } = useAccount();
  const chainId = useChainId();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();

  const [deployment, setDeployment] = useState<any>(null);
  
  // Step progression (1: Choose tier & commit, 2: Deposit, 3: Reveal & wait VRF, 4: Results)
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  
  // User inputs
  const [tier, setTier] = useState<DiceTier>(0);
  const [betEth, setBetEth] = useState('0.05');
  const [useToken, setUseToken] = useState(false);
  const [secret] = useState('0x' + '22'.repeat(32));
  
  // Committed values locked after Step 1
  const [committedParams, setCommittedParams] = useState<{
    tier: DiceTier;
    betEth: string;
    useToken: boolean;
  } | null>(null);
  
  // Request tracking
  const [requestId, setRequestId] = useState<string>('');
  const [status, setStatus] = useState('');
  
  // VRF & outcome data
  const [requestView, setRequestView] = useState<any>(null);
  const [outcomeView, setOutcomeView] = useState<any>(null);

  useEffect(() => {
    loadDeployment(chainId)
      .then(setDeployment)
      .catch((e) => setStatus(e.message));
  }, [chainId]);

  // Auto-refresh VRF status in Step 3
  useEffect(() => {
    if (step !== 3 || !requestId || !publicClient || !deployment) return;
    const interval = setInterval(async () => {
      try {
        const req = await publicClient.readContract({
          address: deployment.contracts.DiceGame,
          abi: DiceGameAbi,
          functionName: 'getRequest',
          args: [BigInt(requestId)],
        });
        setRequestView(req);
        if ((req as any).fulfilled) {
          clearInterval(interval);
        }
      } catch (e) {
        console.error('Poll error:', e);
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [step, requestId, publicClient, deployment]);

  const commitment = (() => {
    if (!address || !deployment) return undefined;
    const wagerToken = useToken ? deployment.contracts.MockToken : '0x0000000000000000000000000000000000000000';
    const amount = parseEther(betEth);
    return keccak256(
      encodePacked(
        ['address', 'uint8', 'address', 'uint256', 'bytes32'],
        [address, tier, wagerToken, amount, secret as `0x${string}`]
      )
    );
  })();

  async function commit() {
    if (!walletClient || !publicClient || !deployment || !commitment) return;
    setStatus('💾 Committing your bet...');
    try {
      const commitValue = deployment?.config?.slashingDeposit
        ? BigInt(deployment.config.slashingDeposit)
        : parseEther('0.002');
      const hash = await walletClient.writeContract({
        address: deployment.contracts.DiceGame,
        abi: DiceGameAbi,
        functionName: 'commitBet',
        args: [commitment],
        value: commitValue,
      });
      await publicClient.waitForTransactionReceipt({ hash });
      
      setCommittedParams({ tier, betEth, useToken });
      setStatus('✅ Bet committed! Proceeding to deposit funds.');
      setStep(2);
    } catch (e: any) {
      setStatus('❌ Commit failed: ' + e.message);
    }
  }

  async function depositETH() {
    if (!walletClient || !publicClient || !deployment || !committedParams) return;
    setStatus('💰 Depositing ETH to treasury...');
    try {
      const hash = await walletClient.writeContract({
        address: deployment.contracts.TreasuryManager,
        abi: TreasuryManagerAbi,
        functionName: 'deposit',
        args: [],
        value: parseEther(committedParams.betEth),
      });
      await publicClient.waitForTransactionReceipt({ hash });
      setStatus('✅ ETH deposited successfully! You can now reveal your bet.');
    } catch (e: any) {
      setStatus('❌ Deposit failed: ' + e.message);
    }
  }

  async function depositToken() {
    if (!walletClient || !publicClient || !deployment) return;
    setStatus('🪙 Processing faucet, approve, and deposit...');
    try {
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

      setStatus('✅ MCT deposited successfully! You can now reveal your bet.');
    } catch (e: any) {
      setStatus('❌ Token deposit failed: ' + e.message);
    }
  }

  async function reveal() {
    if (!walletClient || !publicClient || !deployment || !committedParams) return;
    setStatus('🎲 Revealing your bet and requesting randomness...');
    try {
      const wagerToken = committedParams.useToken ? deployment.contracts.MockToken : '0x0000000000000000000000000000000000000000';
      const amount = parseEther(committedParams.betEth);

      const hash = await walletClient.writeContract({
        address: deployment.contracts.DiceGame,
        abi: DiceGameAbi,
        functionName: 'revealBet',
        args: [committedParams.tier, wagerToken, amount, secret as any],
      });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      let extracted: string | undefined;
      const logs = await publicClient.getLogs({
        address: deployment.contracts.DiceGame,
        fromBlock: receipt.blockNumber,
        toBlock: receipt.blockNumber,
      });
      for (const l of logs) {
        try {
          const decoded = decodeEventLog({
            abi: DiceGameAbi,
            data: l.data,
            topics: l.topics,
          });
          if (decoded.eventName === 'RandomnessRequested') {
            const args: any = decoded.args;
            extracted = args.requestId?.toString?.();
            break;
          }
        } catch {
          // ignore
        }
      }

      if (extracted) {
        setRequestId(extracted);
        setStep(3);
        setStatus('✅ Bet revealed! Waiting for VRF fulfillment...');
      } else {
        setStatus('⚠️ Reveal sent but requestId not detected. Check console.');
      }
    } catch (e: any) {
      setStatus('❌ Reveal failed: ' + e.message);
    }
  }

  async function settle() {
    if (!walletClient || !publicClient || !deployment || !requestId) return;
    setStatus('⏳ Settling bet and processing results...');
    try {
      const hash = await walletClient.writeContract({
        address: deployment.contracts.DiceGame,
        abi: DiceGameAbi,
        functionName: 'settleRequest',
        args: [BigInt(requestId)],
      });
      await publicClient.waitForTransactionReceipt({ hash });
      
      const out = await publicClient.readContract({
        address: deployment.contracts.DiceGame,
        abi: DiceGameAbi,
        functionName: 'getOutcome',
        args: [BigInt(requestId)],
      });
      setOutcomeView(out);
      setStep(4);
      setStatus('✅ Bet settled! Check your results below.');
    } catch (e: any) {
      setStatus('❌ Settle failed: ' + e.message);
    }
  }

  function playAgain() {
    setStep(1);
    setCommittedParams(null);
    setRequestId('');
    setRequestView(null);
    setOutcomeView(null);
    setStatus('');
  }

  const verifyUrl = deployment && requestId
    ? getChainlinkVrfRequestUrl({
        chainId,
        subscriptionId: deployment.config.vrfSubscriptionId,
        requestId,
      })
    : undefined;

  return (
    <main className="min-h-screen flex flex-col bg-gradient-to-b from-purple-900 via-indigo-900 to-black">
      <Header />
      <div className="flex-grow container mx-auto px-4 py-10 max-w-4xl">
        <h1 className="font-pixel text-4xl text-center mb-8 text-yellow-300">🎲 Mystery Dice</h1>

        <div className="bg-black/60 backdrop-blur-sm p-8 rounded-lg border-2 border-purple-400 shadow-2xl">
          {/* Step Progress Indicator */}
          <div className="flex justify-between items-center mb-8">
            {[1, 2, 3, 4].map((s) => (
              <div key={s} className="flex flex-col items-center">
                <div
                  className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg border-2 ${
                    step === s
                      ? 'bg-yellow-400 border-yellow-300 text-black'
                      : step > s
                      ? 'bg-green-600 border-green-400 text-white'
                      : 'bg-gray-700 border-gray-500 text-gray-400'
                  }`}
                >
                  {s}
                </div>
                <span className="text-xs mt-1 text-gray-300 font-game">
                  {s === 1 ? 'Choose' : s === 2 ? 'Deposit' : s === 3 ? 'Reveal' : 'Results'}
                </span>
              </div>
            ))}
          </div>

          {/* STEP 1: Choose Tier & Commit Bet */}
          {step === 1 && (
            <div className="space-y-6">
              <h2 className="font-pixel text-2xl text-center text-white mb-4">Choose Your Risk Level</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {([0, 1, 2] as DiceTier[]).map((t) => {
                  const info = TIER_INFO[t];
                  return (
                    <button
                      key={t}
                      onClick={() => setTier(t)}
                      className={`p-6 rounded-lg border-3 transition-all transform hover:scale-105 ${
                        tier === t
                          ? 'bg-yellow-500/30 border-yellow-400 shadow-lg shadow-yellow-500/50'
                          : 'bg-gray-800/50 border-gray-600 hover:border-gray-400'
                      }`}
                    >
                      <div className="text-5xl mb-2">{info.icon}</div>
                      <div className="font-pixel text-lg text-white mb-2">{info.name}</div>
                      <div className="font-game text-green-300 text-sm mb-1">{info.winChance}% Win</div>
                      <div className="font-game text-yellow-300 text-lg font-bold">{info.multiplier}</div>
                    </button>
                  );
                })}
              </div>

              <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-600">
                <label className="font-game text-white block mb-2">Bet Amount (ETH)</label>
                <input
                  type="text"
                  value={betEth}
                  onChange={(e) => setBetEth(e.target.value)}
                  className="w-full px-4 py-2 rounded bg-gray-900 text-white border border-gray-600 focus:border-yellow-400 focus:outline-none"
                  placeholder="0.05"
                />
              </div>

              <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-600">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={useToken}
                    onChange={(e) => setUseToken(e.target.checked)}
                    className="w-5 h-5"
                  />
                  <span className="font-game text-white">Use MCT Token instead of ETH</span>
                </label>
              </div>

              <button
                onClick={commit}
                disabled={!address || !commitment}
                className="w-full bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-400 hover:to-orange-400 disabled:from-gray-600 disabled:to-gray-700 text-black font-pixel text-xl py-4 rounded-lg shadow-lg transform hover:scale-105 transition-all disabled:scale-100 disabled:cursor-not-allowed"
              >
                {address ? '🎲 Commit Bet (0.002 ETH)' : '❌ Connect Wallet'}
              </button>
            </div>
          )}

          {/* STEP 2: Deposit Funds */}
          {step === 2 && committedParams && (
            <div className="space-y-6">
              <h2 className="font-pixel text-2xl text-center text-white mb-4">💰 Place Your Bet</h2>
              
              <div className="bg-indigo-900/40 p-6 rounded-lg border-2 border-indigo-400">
                <h3 className="font-game text-indigo-200 text-sm mb-3">🔒 Committed Bet Details:</h3>
                <div className="space-y-2 font-game text-white">
                  <div className="flex justify-between">
                    <span>Tier:</span>
                    <span className="text-yellow-300">{TIER_INFO[committedParams.tier].name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Win Chance:</span>
                    <span className="text-green-300">{TIER_INFO[committedParams.tier].winChance}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Multiplier:</span>
                    <span className="text-yellow-300">{TIER_INFO[committedParams.tier].multiplier}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Bet Amount:</span>
                    <span className="text-white font-bold">{committedParams.betEth} {committedParams.useToken ? 'MCT' : 'ETH'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Potential Win:</span>
                    <span className="text-green-400 font-bold">
                      {(parseFloat(committedParams.betEth) * parseFloat(TIER_INFO[committedParams.tier].multiplier)).toFixed(4)} {committedParams.useToken ? 'MCT' : 'ETH'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-yellow-900/40 p-4 rounded-lg border-2 border-yellow-400 animate-pulse">
                <div className="font-game text-yellow-200 text-sm flex items-center gap-2">
                  <span className="text-2xl">💡</span>
                  <span>Deposit {committedParams.betEth} {committedParams.useToken ? 'MCT' : 'ETH'} to treasury to proceed</span>
                </div>
              </div>

              {!committedParams.useToken ? (
                <button
                  onClick={depositETH}
                  className="w-full bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-400 hover:to-cyan-400 text-white font-pixel text-xl py-4 rounded-lg shadow-lg transform hover:scale-105 transition-all"
                >
                  💰 Deposit {committedParams.betEth} ETH
                </button>
              ) : (
                <button
                  onClick={depositToken}
                  className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-400 hover:to-pink-400 text-white font-pixel text-xl py-4 rounded-lg shadow-lg transform hover:scale-105 transition-all"
                >
                  🪙 Get Faucet & Deposit 100 MCT
                </button>
              )}

              <button
                onClick={reveal}
                className="w-full bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-400 hover:to-emerald-400 text-white font-pixel text-xl py-4 rounded-lg shadow-lg transform hover:scale-105 transition-all"
              >
                🎲 Reveal Bet & Request Randomness
              </button>
            </div>
          )}

          {/* STEP 3: Wait for VRF */}
          {step === 3 && (
            <div className="space-y-6">
              <h2 className="font-pixel text-2xl text-center text-white mb-4">⏳ Rolling the Dice...</h2>
              
              <div className="bg-blue-900/40 p-6 rounded-lg border-2 border-blue-400">
                <div className="text-center mb-4">
                  <div className="text-6xl animate-bounce">🎲</div>
                </div>
                <h3 className="font-game text-blue-200 text-center mb-4">Request ID: {requestId}</h3>
                
                {requestView && (
                  <div className="space-y-2 font-game text-sm text-white">
                    <div className="flex justify-between">
                      <span>Status:</span>
                      <span className={requestView.fulfilled ? 'text-green-400' : 'text-yellow-400'}>
                        {requestView.fulfilled ? '✅ Fulfilled' : '⏳ Waiting...'}
                      </span>
                    </div>
                    {requestView.fulfilled && (
                      <div className="flex justify-between">
                        <span>Random Word:</span>
                        <span className="text-purple-300 font-mono text-xs">{requestView.randomWord?.toString()}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="bg-red-900/40 p-4 rounded-lg border-2 border-red-400">
                <div className="font-game text-red-200 text-sm">
                  <div className="font-bold mb-2">⚠️ LOCAL TESTING: Manual VRF Fulfillment Required</div>
                  <div className="bg-black/30 p-3 rounded font-mono text-xs overflow-x-auto">
                    $env:REQUEST_ID="{requestId}"; npx hardhat run scripts/fulfill.js --network localhost
                  </div>
                  <div className="mt-2 text-xs">Run this command in contracts directory, then wait for auto-refresh</div>
                </div>
              </div>

              {requestView?.fulfilled && (
                <button
                  onClick={settle}
                  className="w-full bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-400 hover:to-emerald-400 text-white font-pixel text-xl py-4 rounded-lg shadow-lg transform hover:scale-105 transition-all animate-pulse"
                >
                  ✅ Settle & Reveal Results
                </button>
              )}

              {verifyUrl && (
                <a
                  href={verifyUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="block text-center text-blue-300 underline hover:text-blue-200 font-game text-sm"
                >
                  🔗 Verify on Explorer
                </a>
              )}
            </div>
          )}

          {/* STEP 4: Results */}
          {step === 4 && outcomeView?.exists && (
            <div className="space-y-6">
              <h2 className="font-pixel text-3xl text-center text-white mb-4">
                {outcomeView.win ? '🎉 You Won!' : '😢 You Lost'}
              </h2>
              
              <div className={`p-8 rounded-lg border-3 ${
                outcomeView.win 
                  ? 'bg-green-900/40 border-green-400' 
                  : 'bg-red-900/40 border-red-400'
              }`}>
                <div className="text-center mb-6">
                  <div className="text-8xl mb-4">
                    {outcomeView.win ? '🏆' : '💀'}
                  </div>
                  <div className="font-pixel text-4xl mb-2" style={{
                    color: outcomeView.win ? '#4ade80' : '#f87171'
                  }}>
                    {outcomeView.win ? `+${outcomeView.payoutAmount?.toString()}` : '0'} wei
                  </div>
                </div>

                <div className="space-y-3 font-game text-white">
                  <div className="flex justify-between items-center bg-black/30 p-3 rounded">
                    <span>Tier:</span>
                    <span className="text-yellow-300 text-lg">{TIER_INFO[outcomeView.tier as DiceTier].name}</span>
                  </div>
                  <div className="flex justify-between items-center bg-black/30 p-3 rounded">
                    <span>Your Roll:</span>
                    <span className="text-purple-300 text-xl font-bold">{outcomeView.roll?.toString()}</span>
                  </div>
                  <div className="flex justify-between items-center bg-black/30 p-3 rounded">
                    <span>Win Threshold:</span>
                    <span className="text-blue-300 text-lg">&lt; {TIER_INFO[outcomeView.tier as DiceTier].winChance * 100}</span>
                  </div>
                  <div className="flex justify-between items-center bg-black/30 p-3 rounded">
                    <span>Bet Amount:</span>
                    <span className="text-white">{outcomeView.betAmount?.toString()} wei</span>
                  </div>
                  {outcomeView.win && (
                    <div className="flex justify-between items-center bg-green-900/50 p-3 rounded border border-green-400">
                      <span>Payout:</span>
                      <span className="text-green-300 text-lg font-bold">{outcomeView.payoutAmount?.toString()} wei</span>
                    </div>
                  )}
                </div>
              </div>

              <button
                onClick={playAgain}
                className="w-full bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-400 hover:to-orange-400 text-black font-pixel text-xl py-4 rounded-lg shadow-lg transform hover:scale-105 transition-all"
              >
                🎲 Play Again
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
