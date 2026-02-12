const hre = require('hardhat');
const fs = require('fs');
const path = require('path');

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function loadDeployments(networkName) {
  const p = path.join(__dirname, '..', 'deployments', `${networkName}.json`);
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}

async function main() {
  // Params (match frontend/contract expectations)
  const choice = 1;
  const wagerToken = '0x0000000000000000000000000000000000000000';
  const amountEth = '0.02';
  const secret = '0x1111111111111111111111111111111111111111111111111111111111111111';

  const deployment = loadDeployments(hre.network.name);
  const addresses = {
    TreasuryManager: deployment?.contracts?.TreasuryManager || '0xDa06f87B0EC232015f330282ddf117b69C427682',
    CoinFlipGame: deployment?.contracts?.CoinFlipGame || '0x7eaE3b83360bC913b1EDDdFe120c9B3241104B3E',
  };

  const [signer] = await hre.ethers.getSigners();
  const me = await signer.getAddress();

  const amount = hre.ethers.parseEther(amountEth);
  const slashingDeposit = hre.ethers.parseEther('0.002');

  console.log('==================================================');
  console.log('🎯 Sepolia commit + reveal (CoinFlip)');
  console.log('==================================================');
  console.log('network     :', hre.network.name);
  console.log('signer/me   :', me);
  console.log('game        :', addresses.CoinFlipGame);
  console.log('treasury    :', addresses.TreasuryManager);
  console.log('choice      :', choice);
  console.log('wagerToken  :', wagerToken);
  console.log('amountEth   :', amountEth);
  console.log('amountWei   :', amount.toString());
  console.log('secret      :', secret);
  console.log('depositWei  :', slashingDeposit.toString());

  const treasury = await hre.ethers.getContractAt('TreasuryManager', addresses.TreasuryManager, signer);
  const game = await hre.ethers.getContractAt('CoinFlipGame', addresses.CoinFlipGame, signer);

  const decodeSelector = (data) => {
    if (!data) return null;
    const selector = String(data).slice(0, 10);
    const map = {
      '0x00ad0c95': 'NotOperational()',
      '0x9c454001': 'InvalidChoice()',
      '0x7a3e9f14': 'CommitmentMissing()',
      '0x36359cbe': 'CommitmentNotReady()',
      '0x53adc965': 'CommitmentExpired()',
      '0x9ea6d127': 'InvalidReveal()',
    };
    return { selector, decoded: map[selector] };
  };

  // Ensure treasury player balance is enough for reveal (processBet will deduct here)
  const balBefore = await treasury.playerBalances(me);
  console.log('\n[0] treasury.playerBalances(before) =', balBefore.toString());
  if (balBefore < amount) {
    const need = amount - balBefore;
    console.log('Not enough player balance in Treasury. Depositing:', need.toString(), 'wei');
    const txDep = await treasury.deposit({ value: need });
    console.log('deposit tx:', txDep.hash);
    await txDep.wait();
  }
  const balAfter = await treasury.playerBalances(me);
  console.log('[0] treasury.playerBalances(after)  =', balAfter.toString());

  const paused = await treasury.paused();
  const role = await treasury.GAME_ROLE();
  const hasRole = await treasury.hasRole(role, addresses.CoinFlipGame);
  console.log('[0] treasury.paused =', paused);
  console.log('[0] coinflip has GAME_ROLE =', hasRole);

  // Compute commitment
  const commitment = hre.ethers.keccak256(
    hre.ethers.solidityPacked(
      ['address', 'uint8', 'address', 'uint256', 'bytes32'],
      [me, choice, wagerToken, amount, secret]
    )
  );
  console.log('\n[1] commitment =', commitment);

  // Commit
  console.log('\n[2] commitBet...');
  const txCommit = await game.commitBet(commitment, { value: slashingDeposit });
  console.log('commit tx:', txCommit.hash);
  const rcCommit = await txCommit.wait();
  console.log('commit mined block:', rcCommit.blockNumber);

  // Read commit timestamp from chain
  const c = await game.commitments(me);
  const ts = Number(c.timestamp);
  console.log('\n[3] commitment timestamp =', ts);

  // Wait until reveal window opens
  console.log('\n[4] waiting for REVEAL_DELAY (120s)...');
  while (true) {
    const blk = await hre.ethers.provider.getBlock('latest');
    const now = Number(blk.timestamp);
    const readyAt = ts + 120;
    const expiresAt = ts + 120 + 600;
    const remain = readyAt - now;
    console.log('  now:', now, 'readyAt:', readyAt, 'expiresAt:', expiresAt, 'remain:', remain);
    if (now >= readyAt) break;
    await sleep(Math.min(10_000, Math.max(1_000, remain * 1000)));
  }

  // Reveal
  console.log('\n[5] revealBet.staticCall (preflight)...');
  try {
    const requestIdSim = await game.revealBet.staticCall(choice, wagerToken, amount, secret);
    console.log('  ✅ staticCall success, requestId =', requestIdSim.toString());
  } catch (e) {
    let data = e?.data || e?.error?.data || e?.info?.error?.data;
    console.log('  ❌ staticCall reverted');
    console.log('  message:', e?.shortMessage || e?.message || String(e));

    // Try raw eth_call to capture revert data
    try {
      const callData = game.interface.encodeFunctionData('revealBet', [choice, wagerToken, amount, secret]);
      await hre.ethers.provider.call({
        to: addresses.CoinFlipGame,
        from: me,
        data: callData,
      });
    } catch (e2) {
      data = data || e2?.data || e2?.error?.data || e2?.info?.error?.data;
      if (data) {
        console.log('  eth_call revert data:', data);
      }
      const sel = decodeSelector(data);
      if (sel?.selector) {
        console.log('  selector:', sel.selector);
        if (sel.decoded) console.log('  decoded:', sel.decoded);
      }
    }

    if (data) {
      console.log('  data:', data);
      const sel = decodeSelector(data);
      if (sel?.selector) {
        console.log('  selector:', sel.selector);
        if (sel.decoded) console.log('  decoded:', sel.decoded);
      }
    }
    console.log('\n[5.1] Attempting to SEND reveal tx anyway (bypass estimateGas)...');
    const dataTx = game.interface.encodeFunctionData('revealBet', [choice, wagerToken, amount, secret]);
    const gasLimit = BigInt(1_500_000);
    console.log('  gasLimit:', gasLimit.toString());
    const tx = await signer.sendTransaction({
      to: addresses.CoinFlipGame,
      data: dataTx,
      gasLimit,
    });
    console.log('  reveal tx:', tx.hash);
    const rc = await tx.wait();
    console.log('  reveal receipt status:', rc.status);
    console.log('  mined block:', rc.blockNumber);
    if (rc.status !== 1) {
      console.log('  ❌ reveal transaction reverted on-chain. Check the tx on a block explorer for more details.');
    }
    return;
  }

  console.log('\n[6] revealBet tx...');
  const estimated = await game.revealBet.estimateGas(choice, wagerToken, amount, secret);
  const gasLimit = (estimated * BigInt(12)) / BigInt(10);
  console.log('  estimatedGas:', estimated.toString());
  console.log('  gasLimit(20% buffer):', gasLimit.toString());
  const txReveal = await game.revealBet(choice, wagerToken, amount, secret, { gasLimit });
  console.log('  reveal tx:', txReveal.hash);
  const rcReveal = await txReveal.wait();
  console.log('  reveal mined block:', rcReveal.blockNumber);

  // Parse requestId from events
  const gameIface = game.interface;
  let requestId = null;
  for (const log of rcReveal.logs) {
    try {
      const parsed = gameIface.parseLog(log);
      if (parsed?.name === 'BetRevealed') {
        requestId = parsed.args.requestId;
      }
      if (parsed?.name === 'RandomnessRequested') {
        requestId = parsed.args.requestId;
      }
    } catch {
      // ignore non-game logs
    }
  }

  console.log('\n[7] requestId =', requestId ? requestId.toString() : 'NOT_FOUND');

  if (!requestId) {
    console.log('Done.');
    return;
  }

  // Auto-wait for VRF fulfillment + auto-settle
  console.log('\n[8] waiting for VRF fulfillment (RandomnessFulfilled)...');
  const start = Date.now();
  const maxWaitMs = 15 * 60 * 1000;
  while (Date.now() - start < maxWaitMs) {
    try {
      const r = await game.vrfRequests(requestId);
      const fulfilled = r.fulfilled;
      const settled = r.settled;
      console.log('  fulfilled:', fulfilled, 'settled:', settled);
      if (settled) {
        console.log('  ✅ already settled');
        console.log('Done.');
        return;
      }
      if (fulfilled) break;
    } catch (e) {
      console.log('  ⚠️  failed to read vrfRequests:', e?.shortMessage || e?.message || String(e));
    }
    await sleep(15_000);
  }

  console.log('\n[9] settleRequest...');
  try {
    const txSettle = await game.settleRequest(requestId);
    console.log('  settle tx:', txSettle.hash);
    const rc = await txSettle.wait();
    console.log('  settle mined block:', rc.blockNumber);
    console.log('Done.');
  } catch (e) {
    console.log('  ❌ settleRequest failed:', e?.shortMessage || e?.message || String(e));
    console.log('  You can retry later with:');
    console.log(`    npx hardhat run scripts/settle.js --network ${hre.network.name} -- ${requestId.toString()}`);
    console.log('Done.');
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
