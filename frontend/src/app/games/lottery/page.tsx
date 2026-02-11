'use client';

import { useEffect, useState } from 'react';
import { useAccount, useChainId, usePublicClient, useWalletClient } from 'wagmi';
import { decodeEventLog } from 'viem';
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
  const [ticketCount, setTicketCount] = useState('1');
  const [requestId, setRequestId] = useState('');
  const [status, setStatus] = useState('');
  const [roundView, setRoundView] = useState<any>(null);
  const [requestView, setRequestView] = useState<any>(null);
  const [resultView, setResultView] = useState<any>(null);

  useEffect(() => {
    loadDeployment(chainId)
      .then(setDeployment)
      .catch((e) => setStatus(e.message));
  }, [chainId]);

  async function faucetAndDeposit() {
    if (!walletClient || !publicClient || !deployment) return;
    setStatus('Faucet + approve + deposit MCT...');

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

    setStatus('MCT deposited to treasury player balance.');
    await refresh();
  }

  async function buy() {
    if (!walletClient || !publicClient || !deployment) return;
    setStatus('Buying tickets...');
    const hash = await walletClient.writeContract({
      address: deployment.contracts.PowerUpLottery,
      abi: PowerUpLotteryAbi,
      functionName: 'buyTickets',
      args: [BigInt(ticketCount)],
    });
    await publicClient.waitForTransactionReceipt({ hash });
    setStatus('Tickets purchased.');
    await refresh();
  }

  async function requestDraw() {
    if (!walletClient || !publicClient || !deployment) return;
    setStatus('Requesting draw...');
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
        // ignore non-matching logs
      }
    }

    if (extracted) {
      setRequestId(extracted);
      setStatus(`Draw requested. requestId=${extracted}`);
      await refresh(extracted);
    } else {
      setStatus('Draw requested. Could not auto-detect requestId from logs; paste manually.');
      await refresh();
    }
  }

  async function settle() {
    if (!walletClient || !publicClient || !deployment || !requestId) return;
    setStatus('Settling draw...');
    const hash = await walletClient.writeContract({
      address: deployment.contracts.PowerUpLottery,
      abi: PowerUpLotteryAbi,
      functionName: 'settleRequest',
      args: [BigInt(requestId)],
    });
    await publicClient.waitForTransactionReceipt({ hash });
    setStatus('Settled.');
    await refresh(requestId);
  }

  async function refresh(overrideRequestId?: string) {
    if (!publicClient || !deployment) return;
    const round = await publicClient.readContract({
      address: deployment.contracts.PowerUpLottery,
      abi: PowerUpLotteryAbi,
      functionName: 'getCurrentRound',
      args: [],
    });
    setRoundView(round);

    const ridString = overrideRequestId ?? requestId;
    if (ridString) {
      const rid = BigInt(ridString);
      const req = await publicClient.readContract({
        address: deployment.contracts.PowerUpLottery,
        abi: PowerUpLotteryAbi,
        functionName: 'getRequest',
        args: [rid],
      });
      setRequestView(req);

      const res = await publicClient.readContract({
        address: deployment.contracts.PowerUpLottery,
        abi: PowerUpLotteryAbi,
        functionName: 'resultsByRequestId',
        args: [rid],
      });
      setResultView(res);
    } else {
      setRequestView(null);
      setResultView(null);
    }
  }

  const verifyUrl = deployment && requestId
    ? getChainlinkVrfRequestUrl({
        chainId,
        subscriptionId: deployment.config.vrfSubscriptionId,
        requestId,
      })
    : undefined;

  return (
    <main className="min-h-screen flex flex-col">
      <Header />
      <div className="flex-grow container mx-auto px-4 py-10 text-white">
        <h1 className="font-pixel text-2xl mb-6">Power-Up Lottery</h1>

        <div className="space-y-4 bg-black/40 p-6 pixel-border">
          <div className="flex flex-wrap gap-3">
            <button className="bg-mario-yellow text-black px-4 py-2 pixel-border" onClick={faucetAndDeposit} disabled={!address}>
              Faucet + Deposit MCT
            </button>
            <button className="bg-mario-blue px-4 py-2 pixel-border" onClick={() => refresh()}>
              Refresh Round
            </button>
          </div>

          <div className="flex gap-3 items-center">
            <label className="font-game">Tickets</label>
            <input className="text-black px-2 py-1" value={ticketCount} onChange={(e) => setTicketCount(e.target.value)} />
            <button className="bg-mario-green px-4 py-2 pixel-border" onClick={buy} disabled={!address}>
              Buy
            </button>
          </div>

          <div className="flex flex-wrap gap-3 items-center">
            <button className="bg-mario-red px-4 py-2 pixel-border" onClick={requestDraw} disabled={!address}>
              Request Draw
            </button>
            <label className="font-game">requestId</label>
            <input className="text-black px-2 py-1" value={requestId} onChange={(e) => setRequestId(e.target.value)} />
            <button className="bg-white text-black px-4 py-2 pixel-border" onClick={settle}>
              Settle
            </button>
            {verifyUrl && (
              <a className="underline" href={verifyUrl} target="_blank" rel="noreferrer">
                Verify on Explorer
              </a>
            )}
          </div>

          {roundView && (
            <div className="font-game text-sm">
              <div>ticketCount: {roundView.ticketCount?.toString?.()}</div>
              <div>prizePool: {roundView.prizePool?.toString?.()}</div>
              <div>endTime: {roundView.endTime?.toString?.()}</div>
              <div>drawRequested: {String(roundView.drawRequested)}</div>
              <div>settled: {String(roundView.settled)}</div>
              <div>winner: {roundView.winner}</div>
            </div>
          )}

          {requestView && (
            <div className="font-game text-sm">
              <div>fulfilled: {String(requestView.fulfilled)}</div>
              <div>randomWord: {requestView.randomWord?.toString?.() ?? ''}</div>
            </div>
          )}

          {resultView && (
            <div className="font-game text-sm">
              <div>resolved: {String(resultView.exists)}</div>
              <div>roundId: {resultView.roundId?.toString?.() ?? ''}</div>
              <div>winner: {resultView.winner}</div>
              <div>winningTicketIndex: {resultView.winningTicketIndex?.toString?.() ?? ''}</div>
            </div>
          )}

          <div className="font-game text-sm text-yellow-300">{status}</div>
        </div>
      </div>
      <Footer />
    </main>
  );
}
