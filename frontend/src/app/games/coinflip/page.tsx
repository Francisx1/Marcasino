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

  useEffect(() => {
    loadDeployment(chainId)
      .then(setDeployment)
      .catch((e) => setStatus(e.message));
  }, [chainId]);

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
    setStatus('ETH deposited. Now reveal.');
  }

  async function runReveal() {
    if (!walletClient || !publicClient || !deployment) return;
    setStatus('Revealing...');

    const wagerToken = useToken ? deployment.contracts.MockToken : '0x0000000000000000000000000000000000000000';
    const amount = parseEther(betEth);

    const hash = await walletClient.writeContract({
      address: deployment.contracts.CoinFlipGame,
      abi: CoinFlipGameAbi,
      functionName: 'revealBet',
      args: [choice, wagerToken, amount, secret as any],
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

    if (extracted) {
      setRequestId(extracted);
      setStatus(`Reveal sent. requestId=${extracted}. Wait for VRF fulfill, then settle.`);
    } else {
      setRequestId('');
      setStatus('Reveal sent. Wait for VRF fulfill, then settle. (requestId not detected; paste manually)');
    }
  }

  async function settle() {
    if (!walletClient || !publicClient || !deployment || !requestId) return;
    setStatus('Settling...');
    const hash = await walletClient.writeContract({
      address: deployment.contracts.CoinFlipGame,
      abi: CoinFlipGameAbi,
      functionName: 'settleRequest',
      args: [BigInt(requestId)],
    });
    await publicClient.waitForTransactionReceipt({ hash });
    await refreshViews();
    setStatus('Settled.');
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

  return (
    <main className="min-h-screen flex flex-col">
      <Header />
      <div className="flex-grow container mx-auto px-4 py-10 text-white">
        <h1 className="font-pixel text-2xl mb-6">Coin Flip</h1>

        <div className="space-y-4 bg-black/40 p-6 pixel-border">
          <div className="flex gap-4 items-center">
            <label className="font-game">Choice</label>
            <select
              className="text-black px-2 py-1"
              value={choice}
              onChange={(e) => setChoice(Number(e.target.value) as 0 | 1)}
            >
              <option value={0}>Heads</option>
              <option value={1}>Tails</option>
            </select>

            <label className="font-game ml-6">Bet</label>
            <input
              className="text-black px-2 py-1"
              value={betEth}
              onChange={(e) => setBetEth(e.target.value)}
            />

            <label className="font-game ml-6">Use MCT</label>
            <input type="checkbox" checked={useToken} onChange={(e) => setUseToken(e.target.checked)} />
          </div>

          <div>
            <label className="font-game">Secret (bytes32 hex)</label>
            <input className="text-black px-2 py-1 w-full" value={secret} onChange={(e) => setSecret(e.target.value)} />
          </div>

          <div className="flex flex-wrap gap-3">
            <button className="bg-mario-red px-4 py-2 pixel-border" onClick={runCommit} disabled={!address}>
              1) Commit (0.002 ETH)
            </button>
            <button className="bg-mario-blue px-4 py-2 pixel-border" onClick={runDepositEth} disabled={!address || useToken}>
              Deposit ETH to Treasury
            </button>
            <button className="bg-mario-yellow text-black px-4 py-2 pixel-border" onClick={runFaucetAndDepositToken} disabled={!address || !useToken}>
              Faucet+Deposit MCT
            </button>
            <button className="bg-mario-green px-4 py-2 pixel-border" onClick={runReveal} disabled={!address}>
              2) Reveal
            </button>
          </div>

          <div className="flex gap-3 items-center">
            <label className="font-game">requestId</label>
            <input className="text-black px-2 py-1" value={requestId} onChange={(e) => setRequestId(e.target.value)} />
            <button className="bg-white text-black px-4 py-2 pixel-border" onClick={settle}>
              3) Settle
            </button>
            <button className="bg-white text-black px-4 py-2 pixel-border" onClick={refreshViews}>
              Refresh
            </button>
            {verifyUrl && (
              <a className="underline" href={verifyUrl} target="_blank" rel="noreferrer">
                Verify on Explorer
              </a>
            )}
          </div>

          {requestView && (
            <div className="font-game text-sm">
              <div>fulfilled: {String(requestView.fulfilled)}</div>
              <div>randomWord: {requestView.randomWord?.toString?.() ?? ''}</div>
              <div>player: {requestView.player}</div>
            </div>
          )}

          {outcomeView && (
            <div className="font-game text-sm">
              <div>resolved: {String(outcomeView.exists)}</div>
              <div>win: {String(outcomeView.win)}</div>
              <div>choice: {outcomeView.playerChoice?.toString?.() ?? ''}</div>
              <div>outcome: {outcomeView.outcome?.toString?.() ?? ''}</div>
              <div>payout: {outcomeView.payoutAmount?.toString?.() ?? ''}</div>
            </div>
          )}

          <div className="font-game text-sm text-yellow-300">{status}</div>
        </div>
      </div>
      <Footer />
    </main>
  );
}
