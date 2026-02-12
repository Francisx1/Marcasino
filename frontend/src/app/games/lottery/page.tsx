'use client';

import { useEffect, useState } from 'react';
import { useAccount, useChainId, usePublicClient, useWalletClient } from 'wagmi';
import { decodeEventLog, formatEther } from 'viem';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { MockERC20Abi, PowerUpLotteryAbi, TreasuryManagerAbi } from '@/contracts/abis';
import { getChainlinkVrfRequestUrl, loadDeployment } from '@/utils/deployments';

export default function LotteryPage() {
  const { address } = useAccount();
  const chainId = useChainId();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();

  const [deployment, setDeployment] = useState<any>(null);
  
  // Step progression (1: Faucet & Deposit, 2: Buy Tickets, 3: Request Draw & Wait, 4: Results)
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  
  // User inputs
  const [ticketCount, setTicketCount] = useState(1);
  
  // Round & request tracking
  const [requestId, setRequestId] = useState('');
  const [status, setStatus] = useState('');
  const [roundView, setRoundView] = useState<any>(null);
  const [requestView, setRequestView] = useState<any>(null);
  const [resultView, setResultView] = useState<any>(null);
  const [treasuryMctBalance, setTreasuryMctBalance] = useState<bigint>(BigInt(0));
  const [hasDeposited, setHasDeposited] = useState(false);

  useEffect(() => {
    loadDeployment(chainId)
      .then(setDeployment)
      .catch((e) => setStatus(e.message));
  }, [chainId]);

  useEffect(() => {
    if (!address || !publicClient || !deployment) return;
    refreshTreasuryBalances();
    const interval = setInterval(() => {
      refreshTreasuryBalances();
    }, 5000);
    return () => clearInterval(interval);
  }, [address, publicClient, deployment]);

  // Auto-refresh round info in Step 2 and 3
  useEffect(() => {
    if ((step === 2 || step === 3) && publicClient && deployment) {
      const fetchRound = async () => {
        try {
          const round = await publicClient.readContract({
            address: deployment.contracts.PowerUpLottery,
            abi: PowerUpLotteryAbi,
            functionName: 'getCurrentRound',
            args: [],
          });
          setRoundView(round);
        } catch (e) {
          console.error('Round fetch error:', e);
        }
      };
      fetchRound();
      const interval = setInterval(fetchRound, 3000);
      return () => clearInterval(interval);
    }
  }, [step, publicClient, deployment]);

  // Auto-refresh VRF status in Step 3
  useEffect(() => {
    if (step !== 3 || !requestId || !publicClient || !deployment) return;
    refreshViews();
    const interval = setInterval(() => {
      refreshViews();
    }, 3000);
    return () => clearInterval(interval);
  }, [step, requestId, publicClient, deployment]);

  async function faucetAndDeposit() {
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

      setStatus('✅ MCT deposited successfully! You can now buy lottery tickets.');
      setHasDeposited(true);
      setStep(2);
    } catch (e: any) {
      setStatus('❌ Deposit failed: ' + e.message);
    }
  }

  async function buyTickets() {
    if (!walletClient || !publicClient || !deployment) return;
    setStatus('🎟️ Buying tickets...');
    try {
      const hash = await walletClient.writeContract({
        address: deployment.contracts.PowerUpLottery,
        abi: PowerUpLotteryAbi,
        functionName: 'buyTickets',
        args: [BigInt(ticketCount)],
      });
      await publicClient.waitForTransactionReceipt({ hash });
      setStatus(`✅ Successfully purchased ${ticketCount} ticket(s)!`);
      
      // Refresh round to show updated ticket count
      const round = await publicClient.readContract({
        address: deployment.contracts.PowerUpLottery,
        abi: PowerUpLotteryAbi,
        functionName: 'getCurrentRound',
        args: [],
      });
      setRoundView(round);
    } catch (e: any) {
      setStatus('❌ Purchase failed: ' + e.message);
    }
  }

  async function requestDraw() {
    if (!walletClient || !publicClient || !deployment) return;
    setStatus('🎲 Requesting lottery draw...');
    try {
      const hash = await walletClient.writeContract({
        address: deployment.contracts.PowerUpLottery,
        abi: PowerUpLotteryAbi,
        functionName: 'requestDraw',
        args: [],
      });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      let extracted: string | undefined;
      const logs = await publicClient.getLogs({
        address: deployment.contracts.PowerUpLottery,
        fromBlock: receipt.blockNumber,
        toBlock: receipt.blockNumber,
      });
      for (const l of logs) {
        try {
          const decoded = decodeEventLog({
            abi: PowerUpLotteryAbi,
            data: l.data,
            topics: l.topics,
          });
          if (decoded.eventName === 'DrawRequested') {
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
        setStatus('✅ Draw requested! Waiting for VRF fulfillment...');
      } else {
        setStatus('⚠️ Draw requested but requestId not detected.');
      }
    } catch (e: any) {
      setStatus('❌ Request draw failed: ' + e.message);
    }
  }

  async function settle() {
    if (!walletClient || !publicClient || !deployment || !requestId) return;
    try {
      setStatus('⏳ Preflighting settleRequest...');
      await publicClient.simulateContract({
        address: deployment.contracts.PowerUpLottery,
        abi: PowerUpLotteryAbi,
        functionName: 'settleRequest',
        args: [BigInt(requestId)],
        account: address as any,
      });

      setStatus('⏳ Settling lottery (confirm in wallet)...');
      const hash = await walletClient.writeContract({
        address: deployment.contracts.PowerUpLottery,
        abi: PowerUpLotteryAbi,
        functionName: 'settleRequest',
        args: [BigInt(requestId)],
      });
      setStatus(`⏳ settle tx sent: ${hash}. Waiting for confirmation...`);
      await publicClient.waitForTransactionReceipt({ hash });
      await refreshViews();
      await refreshTreasuryBalances();
      setStep(4);
      setStatus('✅ Lottery settled! Check the results below.');
    } catch (e: any) {
      const msg = e?.shortMessage || e?.message || String(e);
      setStatus('❌ Settlement failed: ' + msg);
    }
  }

  async function refreshViews() {
    if (!publicClient || !deployment || !requestId) return;
    const rid = BigInt(requestId);

    const req = await publicClient.readContract({
      address: deployment.contracts.PowerUpLottery,
      abi: PowerUpLotteryAbi,
      functionName: 'getRequest',
      args: [rid],
    });
    setRequestView(req);

    if ((req as any)?.fulfilled && !(req as any)?.settled && !(resultView as any)?.exists) {
      setStatus('✅ VRF fulfilled. Click “Settle & See Result” to finalize.');
    }

    const res = await publicClient.readContract({
      address: deployment.contracts.PowerUpLottery,
      abi: PowerUpLotteryAbi,
      functionName: 'resultsByRequestId',
      args: [rid],
    });
    setResultView(res);
  }

  async function refreshTreasuryBalances() {
    if (!publicClient || !deployment || !address) return;
    try {
      const mctBal = await publicClient.readContract({
        address: deployment.contracts.TreasuryManager,
        abi: TreasuryManagerAbi,
        functionName: 'playerTokenBalances',
        args: [address as any, deployment.contracts.MockToken],
      });
      setTreasuryMctBalance(mctBal as bigint);
    } catch {
      // ignore
    }
  }

  async function withdrawMctFromTreasury() {
    if (!walletClient || !publicClient || !deployment || !address) return;
    if (treasuryMctBalance <= BigInt(0)) return;
    try {
      setStatus('⏳ Preflighting withdrawToken...');
      await publicClient.simulateContract({
        address: deployment.contracts.TreasuryManager,
        abi: TreasuryManagerAbi,
        functionName: 'withdrawToken',
        args: [deployment.contracts.MockToken, treasuryMctBalance],
        account: address as any,
      });

      setStatus('⏳ Withdrawing MCT (confirm in wallet)...');
      const hash = await walletClient.writeContract({
        address: deployment.contracts.TreasuryManager,
        abi: TreasuryManagerAbi,
        functionName: 'withdrawToken',
        args: [deployment.contracts.MockToken, treasuryMctBalance],
      });
      setStatus(`⏳ withdrawToken tx sent: ${hash}. Waiting for confirmation...`);
      await publicClient.waitForTransactionReceipt({ hash });
      await refreshTreasuryBalances();
      setStatus('✅ Withdrawn to wallet.');
    } catch (e: any) {
      const msg = e?.shortMessage || e?.message || String(e);
      setStatus('❌ Withdraw failed: ' + msg);
    }
  }

  function playAgain() {
    setStep(1);
    setHasDeposited(false);
    setRequestId('');
    setRoundView(null);
    setRequestView(null);
    setResultView(null);
    setStatus('');
    setTicketCount(1);
  }

  const verifyUrl = deployment && requestId
    ? getChainlinkVrfRequestUrl({
        chainId,
        subscriptionId: deployment.config.vrfSubscriptionId,
        requestId,
      })
    : undefined;

  const ticketPrice = deployment?.config?.lotteryTicketPrice 
    ? formatEther(BigInt(deployment.config.lotteryTicketPrice))
    : '1';

  return (
    <main className="min-h-screen flex flex-col bg-gradient-to-b from-pink-900 via-purple-900 to-black">
      <Header />
      <div className="flex-grow container mx-auto px-4 py-10 max-w-4xl">
        <h1 className="font-pixel text-4xl text-center mb-8 text-yellow-300">🎟️ Power-Up Lottery</h1>

        <div className="bg-black/60 backdrop-blur-sm p-8 rounded-lg border-2 border-pink-400 shadow-2xl">
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
                  {s === 1 ? 'Deposit' : s === 2 ? 'Buy' : s === 3 ? 'Draw' : 'Results'}
                </span>
              </div>
            ))}
          </div>

          {/* STEP 1: Faucet & Deposit MCT */}
          {step === 1 && (
            <div className="space-y-6">
              <h2 className="font-pixel text-2xl text-center text-white mb-4">💰 Get MCT Tokens</h2>
              
              <div className="bg-pink-900/40 p-6 rounded-lg border-2 border-pink-400">
                <div className="text-center mb-4">
                  <div className="text-6xl mb-3">🪙</div>
                  <div className="font-game text-pink-200 text-lg">Get MCT tokens from faucet and deposit to treasury</div>
                </div>
                <div className="space-y-3 font-game text-white text-sm">
                  <div className="flex justify-between items-center bg-black/30 p-3 rounded">
                    <span>Faucet Amount:</span>
                    <span className="text-green-300 font-bold">100 MCT</span>
                  </div>
                  <div className="flex justify-between items-center bg-black/30 p-3 rounded">
                    <span>Ticket Price:</span>
                    <span className="text-yellow-300 font-bold">{ticketPrice} MCT</span>
                  </div>
                  <div className="flex justify-between items-center bg-black/30 p-3 rounded">
                    <span>Max Tickets per Buy:</span>
                    <span className="text-blue-300 font-bold">50 tickets</span>
                  </div>
                </div>
              </div>

              <div className="bg-blue-900/40 p-4 rounded-lg border-2 border-blue-400">
                <div className="font-game text-blue-200 text-sm flex items-center gap-2">
                  <span className="text-2xl">ℹ️</span>
                  <span>This will get tokens from faucet, approve treasury, and deposit 100 MCT</span>
                </div>
              </div>

              <button
                onClick={faucetAndDeposit}
                disabled={!address}
                className="w-full bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-400 hover:to-purple-400 disabled:from-gray-600 disabled:to-gray-700 text-white font-pixel text-xl py-4 rounded-lg shadow-lg transform hover:scale-105 transition-all disabled:scale-100 disabled:cursor-not-allowed"
              >
                {address ? '🪙 Get MCT & Deposit to Treasury' : '❌ Connect Wallet'}
              </button>
            </div>
          )}

          {/* STEP 2: Buy Tickets */}
          {step === 2 && (
            <div className="space-y-6">
              <h2 className="font-pixel text-2xl text-center text-white mb-4">🎟️ Buy Lottery Tickets</h2>
              
              {roundView && (
                <div className="bg-indigo-900/40 p-6 rounded-lg border-2 border-indigo-400">
                  <h3 className="font-game text-indigo-200 text-sm mb-3">📊 Current Round Info:</h3>
                  <div className="space-y-2 font-game text-white">
                    <div className="flex justify-between">
                      <span>Total Tickets Sold:</span>
                      <span className="text-yellow-300 font-bold">{roundView.ticketCount?.toString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Prize Pool:</span>
                      <span className="text-green-300 font-bold">{formatEther(roundView.prizePool || BigInt(0))} MCT</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Round Ends:</span>
                      <span className="text-blue-300">
                        {BigInt(roundView.endTime || 0) === BigInt(0)
                          ? 'Not started (starts when first ticket is purchased)'
                          : new Date(Number(roundView.endTime) * 1000).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              <div className="bg-gray-800/50 p-6 rounded-lg border border-gray-600">
                <label className="font-game text-white block mb-3">Number of Tickets (1-50)</label>
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={ticketCount}
                  onChange={(e) => setTicketCount(Math.min(50, Math.max(1, parseInt(e.target.value) || 1)))}
                  className="w-full px-4 py-3 text-2xl text-center rounded bg-gray-900 text-white border border-gray-600 focus:border-yellow-400 focus:outline-none font-bold"
                />
                <div className="mt-3 text-center font-game text-yellow-300 text-lg">
                  Total Cost: {(parseFloat(ticketPrice) * ticketCount).toFixed(2)} MCT
                </div>
              </div>

              <div className="bg-yellow-900/40 p-4 rounded-lg border-2 border-yellow-400 animate-pulse">
                <div className="font-game text-yellow-200 text-sm flex items-center gap-2">
                  <span className="text-2xl">🎲</span>
                  <span>Each ticket gives you a chance to win the entire prize pool!</span>
                </div>
              </div>

              <button
                onClick={buyTickets}
                className="w-full bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-400 hover:to-emerald-400 text-white font-pixel text-xl py-4 rounded-lg shadow-lg transform hover:scale-105 transition-all"
              >
                🎟️ Buy {ticketCount} Ticket{ticketCount > 1 ? 's' : ''} ({(parseFloat(ticketPrice) * ticketCount).toFixed(2)} MCT)
              </button>

              <button
                onClick={requestDraw}
                disabled={!roundView || BigInt(roundView.endTime || 0) === BigInt(0) || (roundView.endTime && Number(roundView.endTime) * 1000 > Date.now()) || Number(roundView.ticketCount) === 0}
                className="w-full bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-400 hover:to-orange-400 disabled:from-gray-600 disabled:to-gray-700 text-white font-pixel text-xl py-4 rounded-lg shadow-lg transform hover:scale-105 transition-all disabled:scale-100 disabled:cursor-not-allowed"
              >
                🎲 Request Lottery Draw
              </button>
            </div>
          )}

          {/* STEP 3: Wait for VRF & Draw */}
          {step === 3 && (
            <div className="space-y-6">
              <h2 className="font-pixel text-2xl text-center text-white mb-4">🎰 Drawing Winner...</h2>
              
              <div className="bg-purple-900/40 p-6 rounded-lg border-2 border-purple-400">
                <div className="text-center mb-4">
                  <div className="text-6xl animate-bounce">🎱</div>
                </div>
                <h3 className="font-game text-purple-200 text-center mb-4">Request ID: {requestId}</h3>
                
                {roundView && (
                  <div className="space-y-2 font-game text-sm text-white mb-4">
                    <div className="flex justify-between">
                      <span>Total Tickets:</span>
                      <span className="text-yellow-300 font-bold">{roundView.ticketCount?.toString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Prize Pool:</span>
                      <span className="text-green-300 font-bold">{formatEther(roundView.prizePool || BigInt(0))} MCT</span>
                    </div>
                  </div>
                )}

                {requestView && (
                  <div className="space-y-2 font-game text-sm text-white">
                    <div className="flex justify-between">
                      <span>VRF Status:</span>
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

              {(chainId === 31337 || chainId === 1337) && !requestView?.fulfilled && (
                <div className="bg-red-900/40 p-4 rounded-lg border-2 border-red-400">
                  <div className="font-game text-red-200 text-sm">
                    <div className="font-bold mb-2">⚠️ LOCAL TESTING: Manual VRF Fulfillment Required</div>
                    <div className="bg-black/30 p-3 rounded font-mono text-xs overflow-x-auto">
                      $env:REQUEST_ID="{requestId}"; npx hardhat run scripts/fulfill.js --network localhost
                    </div>
                    <div className="mt-2 text-xs">Run this command in contracts directory, then wait for auto-refresh</div>
                  </div>
                </div>
              )}

              <button
                onClick={settle}
                disabled={!requestView?.fulfilled}
                className="w-full bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-400 hover:to-emerald-400 disabled:from-gray-600 disabled:to-gray-700 text-white font-pixel text-xl py-4 rounded-lg shadow-lg transform hover:scale-105 transition-all disabled:scale-100 disabled:cursor-not-allowed"
              >
                ✅ Settle & Reveal Winner
              </button>

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
          {step === 4 && resultView?.exists && (
            <div className="space-y-6">
              <h2 className="font-pixel text-3xl text-center text-white mb-4">
                {resultView.winner?.toLowerCase() === address?.toLowerCase() ? '🎉 You Won!' : '🎊 Winner Announced!'}
              </h2>
              
              <div className={`p-8 rounded-lg border-3 ${
                resultView.winner?.toLowerCase() === address?.toLowerCase()
                  ? 'bg-green-900/40 border-green-400' 
                  : 'bg-purple-900/40 border-purple-400'
              }`}>
                <div className="text-center mb-6">
                  <div className="text-8xl mb-4">
                    {resultView.winner?.toLowerCase() === address?.toLowerCase() ? '🏆' : '🎊'}
                  </div>
                  <div className="font-pixel text-4xl mb-4 text-yellow-300">
                    Prize: {formatEther(resultView.prizePool || BigInt(0))} MCT
                  </div>
                </div>

                <div className="space-y-3 font-game text-white">
                  <div className="flex justify-between items-center bg-black/30 p-3 rounded">
                    <span>Round ID:</span>
                    <span className="text-blue-300">{resultView.roundId?.toString()}</span>
                  </div>
                  <div className="flex justify-between items-center bg-black/30 p-3 rounded">
                    <span>Winning Ticket:</span>
                    <span className="text-yellow-300 text-xl font-bold">#{resultView.winningTicketIndex?.toString()}</span>
                  </div>
                  <div className="flex flex-col bg-black/30 p-3 rounded gap-2">
                    <span>Winner Address:</span>
                    <span className="text-green-300 text-xs font-mono break-all">{resultView.winner}</span>
                    {resultView.winner?.toLowerCase() === address?.toLowerCase() && (
                      <span className="text-yellow-300 text-sm mt-1">🎊 That's you! Congratulations!</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="bg-black/40 p-4 rounded-lg border-2 border-gray-700">
                <div className="font-game text-sm mb-3 text-gray-200">Treasury Balance (Claim to Wallet)</div>
                <div className="grid grid-cols-1 gap-3">
                  <div className="flex items-center justify-between bg-black/30 p-3 rounded">
                    <div className="text-gray-300">MCT in Treasury</div>
                    <div className="font-mono text-xs text-yellow-300">{formatEther(treasuryMctBalance)} MCT</div>
                  </div>
                  <button
                    className="w-full bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-400 hover:to-purple-400 text-white font-pixel text-xl py-4 rounded-lg shadow-lg transform hover:scale-105 transition-all disabled:opacity-50"
                    onClick={withdrawMctFromTreasury}
                    disabled={!address || treasuryMctBalance === BigInt(0)}
                  >
                    Withdraw MCT to Wallet
                  </button>
                </div>
              </div>

              <button
                onClick={playAgain}
                className="w-full bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-400 hover:to-orange-400 text-black font-pixel text-xl py-4 rounded-lg shadow-lg transform hover:scale-105 transition-all"
              >
                🎟️ Play Again
              </button>
            </div>
          )}

          {/* Status Message */}
          {!resultView?.exists && status && (
            <div className={`mt-4 p-4 rounded-lg border-2 shadow-lg text-center ${
              status.includes('✅') ? 'bg-green-900/40 border-green-400 text-green-200' :
              status.includes('⚠️') ? 'bg-yellow-900/40 border-yellow-400 text-yellow-200' :
              status.includes('❌') ? 'bg-red-900/40 border-red-400 text-red-200' :
              'bg-blue-900/40 border-blue-400 text-blue-200'
            }`}>
              <div className="font-game text-sm flex items-center justify-center gap-2">
                {(status.includes('🎲') || status.includes('⏳') || status.includes('🎟️')) && (
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
