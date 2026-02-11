const hre = require('hardhat');

async function rawRpc(method, params) {
  const url = process.env.SEPOLIA_RPC_URL;
  if (!url) throw new Error('Missing SEPOLIA_RPC_URL in environment');
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  const json = await res.json();
  if (json.error) {
    const err = new Error(json.error.message || 'RPC error');
    err.code = json.error.code;
    err.data = json.error.data;
    err.rpcError = json.error;
    throw err;
  }
  return json.result;
}

function decodeCoinFlipSelector(data) {
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
}

async function main() {
  const me = '0x8bB43b9C0AE907686A8E26245659190455b664EC';
  const choice = 1;
  const wagerToken = '0x0000000000000000000000000000000000000000';
  const amountEth = '0.02';
  const secret = '0x1111111111111111111111111111111111111111111111111111111111111111';

  const commitTxHash = '0xed17365766eb08bc35183a4b129006aa201f11c435ae62d10f88747592f76c4d';

  const addresses = {
    MarcasinoCore: '0x2054ec7315138A2dBc8B9b51C15a5d2C8749c0C6',
    TreasuryManager: '0x54e09bc035F2dde6334187372412608550a15755',
    CoinFlipGame: '0xC932044456580986235924c106D870e74419cc87',
  };

  const amount = hre.ethers.parseEther(amountEth);

  console.log('==================================================');
  console.log('🔎 CoinFlip Sepolia revealBet preflight (read-only)');
  console.log('==================================================');
  console.log('network:', hre.network.name);
  console.log('me:', me);
  console.log('choice:', choice);
  console.log('wagerToken:', wagerToken);
  console.log('amountEth:', amountEth);
  console.log('amountWei:', amount.toString());
  console.log('secret:', secret);
  console.log('commitTxHash:', commitTxHash);
  console.log('---');
  console.log('Core:', addresses.MarcasinoCore);
  console.log('Treasury:', addresses.TreasuryManager);
  console.log('Game:', addresses.CoinFlipGame);
  console.log('==================================================');

  const core = await hre.ethers.getContractAt('MarcasinoCore', addresses.MarcasinoCore);
  const treasury = await hre.ethers.getContractAt('TreasuryManager', addresses.TreasuryManager);
  const game = await hre.ethers.getContractAt('CoinFlipGame', addresses.CoinFlipGame);

  // 0) Commit tx status (if provided)
  console.log('\n[0] commit tx receipt');
  try {
    const receipt = await hre.ethers.provider.getTransactionReceipt(commitTxHash);
    if (!receipt) {
      console.log('  ❌ receipt not found yet (tx not mined or wrong hash)');
    } else {
      const blk = await hre.ethers.provider.getBlock(receipt.blockNumber);
      console.log('  status     :', receipt.status);
      console.log('  blockNumber:', receipt.blockNumber);
      console.log('  blockTime  :', Number(blk.timestamp));
      console.log('  to         :', receipt.to);
    }
  } catch (e) {
    console.log('  ❌ failed to fetch receipt');
    console.log('  message:', e?.message || String(e));
  }

  // 1) Operational
  const operational = await core.isOperational();
  console.log('\n[1] core.isOperational =', operational);

  // 1.5) Treasury config / roles
  console.log('\n[1.5] treasury config / roles');
  try {
    const paused = await treasury.paused();
    const minBet = await treasury.minBetAmount();
    const maxBet = await treasury.maxBetAmount();
    const gameRole = await treasury.GAME_ROLE();
    const hasGameRole = await treasury.hasRole(gameRole, addresses.CoinFlipGame);
    console.log('  paused      :', paused);
    console.log('  minBetAmount:', minBet.toString());
    console.log('  maxBetAmount:', maxBet.toString());
    console.log('  GAME_ROLE   :', gameRole);
    console.log('  game has GAME_ROLE:', hasGameRole);
  } catch (e) {
    console.log('  ❌ failed to read treasury config/roles');
    console.log('  message:', e?.message || String(e));
  }

  // 2) Commitment
  const c = await game.commitments(me);
  console.log('\n[2] game.commitments(me) =');
  console.log('  hash     :', c.hash);
  console.log('  timestamp:', c.timestamp.toString());
  console.log('  deposit  :', c.deposit.toString());

  // 2.5) VRF config sanity check
  console.log('\n[2.5] VRF config');
  try {
    const coordinator = await game.vrfCoordinator();
    const keyHash = await game.keyHash();
    const subId = await game.subscriptionId();
    const cbGas = await game.callbackGasLimit();
    console.log('  vrfCoordinator :', coordinator);
    console.log('  keyHash        :', keyHash);
    console.log('  subscriptionId :', subId.toString());
    console.log('  callbackGas    :', cbGas.toString());

    const coordAbi = [
      'function getRequestConfig() view returns (uint16 minimumRequestConfirmations, uint32 maxGasLimit, bytes32[] provingKeyHashes)',
      'function getSubscription(uint256 subId) view returns (uint96 balance, uint96 nativeBalance, uint64 reqCount, address owner, address[] consumers)',
      'function pendingRequestExists(uint256 subId) view returns (bool)',
    ];
    const coord = new hre.ethers.Contract(coordinator, coordAbi, hre.ethers.provider);
    const cfg = await coord.getRequestConfig();
    const minConf = cfg.minimumRequestConfirmations ?? cfg[0];
    const maxGasLimit = cfg.maxGasLimit ?? cfg[1];
    const provingKeyHashes = cfg.provingKeyHashes ?? cfg[2] ?? [];
    const keyHashSupported = provingKeyHashes.map((x) => x.toLowerCase()).includes(keyHash.toLowerCase());

    console.log('  cfg.minConfirmations:', minConf.toString());
    console.log('  cfg.maxGasLimit      :', maxGasLimit.toString());
    console.log('  cfg.keyHashes.count  :', provingKeyHashes.length);
    console.log('  cfg.keyHashSupported :', keyHashSupported);
    console.log('  cfg.callbackGasOk    :', BigInt(cbGas.toString()) <= BigInt(maxGasLimit.toString()));

    try {
      const sub = await coord.getSubscription(subId);
      const consumers = sub.consumers || sub[4] || [];
      console.log('  sub.owner        :', sub.owner || sub[3]);
      console.log('  sub.balance      :', (sub.balance || sub[0]).toString());
      console.log('  sub.nativeBalance:', (sub.nativeBalance || sub[1]).toString());
      console.log('  sub.reqCount     :', (sub.reqCount || sub[2]).toString());
      console.log('  sub.consumersCnt :', consumers.length);
      console.log('  sub.hasGame      :', consumers.map((x) => x.toLowerCase()).includes(addresses.CoinFlipGame.toLowerCase()));
      const pending = await coord.pendingRequestExists(subId);
      console.log('  sub.pendingRequestExists:', pending);
    } catch (eSub) {
      console.log('  ⚠️  getSubscription/pendingRequestExists failed:', eSub?.message || String(eSub));
      if (eSub?.data) console.log('  sub.error.data:', eSub.data);
    }

    // Try simulating the exact coordinator call with from=CoinFlipGame
    console.log('  sim.requestRandomWords(from=game) ...');
    try {
      const vrfClientPath = require.resolve('@chainlink/contracts/src/v0.8/vrf/dev/libraries/VRFV2PlusClient.sol');
      void vrfClientPath;
    } catch {
      // ignore: only here to ensure dependency exists
    }

    const vrfReq = {
      keyHash,
      subId,
      requestConfirmations: 3,
      callbackGasLimit: Number(cbGas),
      numWords: 1,
      extraArgs: (() => {
        // VRFV2PlusClient._argsToBytes(ExtraArgsV1({nativePayment:false}))
        // == abi.encodeWithSelector(bytes4(keccak256("VRF ExtraArgsV1")), extraArgs)
        const tag = `0x${hre.ethers.id('VRF ExtraArgsV1').slice(2, 10)}`; // bytes4
        const encoded = hre.ethers.AbiCoder.defaultAbiCoder().encode(['bool'], [false]);
        return tag + encoded.slice(2);
      })(),
    };

    const coordReqAbi = [
      'function requestRandomWords((bytes32 keyHash,uint256 subId,uint16 requestConfirmations,uint32 callbackGasLimit,uint32 numWords,bytes extraArgs) req) returns (uint256 requestId)',
    ];
    const coordReq = new hre.ethers.Interface(coordReqAbi);
    const callData = coordReq.encodeFunctionData('requestRandomWords', [vrfReq]);
    try {
      const ret = await hre.ethers.provider.call({
        to: coordinator,
        from: addresses.CoinFlipGame,
        data: callData,
      });
      console.log('    ✅ coordinator call success, raw return:', ret);
    } catch (e3) {
      const data3 = e3?.data || e3?.error?.data || e3?.info?.error?.data;
      console.log('    ❌ coordinator call reverted');
      console.log('    message:', e3?.shortMessage || e3?.message || String(e3));
      if (data3) console.log('    revert data:', data3);
      if (e3?.info?.error) console.log('    info.error:', e3.info.error);

      // Try raw RPC call (Alchemy) to capture revert data
      console.log('    rawRpc eth_call coordinator...');
      try {
        await rawRpc('eth_call', [
          {
            to: coordinator,
            from: addresses.CoinFlipGame,
            data: callData,
          },
          'latest',
        ]);
        console.log('    ✅ rawRpc coordinator eth_call success');
      } catch (re) {
        console.log('    ❌ rawRpc coordinator eth_call reverted');
        console.log('    message:', re.message);
        if (re.data) console.log('    data:', re.data);
        if (re.rpcError) {
          console.log('    rpcError:', re.rpcError);
          const nested = re.rpcError?.data?.data || re.rpcError?.data?.originalError?.data;
          if (nested) console.log('    nestedRevertData:', nested);
        }
      }
    }
  } catch (e) {
    console.log('  ❌ failed to read VRF subscription info (this is still useful)');
    console.log('  message:', e?.message || String(e));
    if (e?.data) console.log('  data:', e.data);
    if (e?.info?.error?.data) console.log('  info.error.data:', e.info.error.data);
  }

  // 3) Time window
  const latest = await hre.ethers.provider.getBlock('latest');
  const now = Number(latest.timestamp);
  const ts = Number(c.timestamp);
  const readyAt = ts + 120;
  const expiresAt = ts + 120 + 600;
  console.log('\n[3] time window');
  console.log('  now      :', now);
  console.log('  commitTs :', ts);
  console.log('  readyAt  :', readyAt, '(+120s)');
  console.log('  expiresAt:', expiresAt, '(+120+600s)');
  console.log('  tooEarly :', now < readyAt);
  console.log('  expired  :', now > expiresAt);

  // 4) Hash match
  const expected = hre.ethers.keccak256(
    hre.ethers.solidityPacked(
      ['address', 'uint8', 'address', 'uint256', 'bytes32'],
      [me, choice, wagerToken, amount, secret]
    )
  );
  console.log('\n[4] commitment hash check');
  console.log('  expected:', expected);
  console.log('  onchain  :', c.hash);
  console.log('  match    :', expected.toLowerCase() === c.hash.toLowerCase());

  // 5) Treasury balance checks
  if (wagerToken === '0x0000000000000000000000000000000000000000') {
    const bal = await treasury.playerBalances(me);
    console.log('\n[5] treasury.playerBalances(me) =', bal.toString());
    console.log('    sufficient for amount?', bal >= amount);
  } else {
    const bal = await treasury.playerTokenBalances(me, wagerToken);
    console.log('\n[5] treasury.playerTokenBalances(me, token) =', bal.toString());
    console.log('    sufficient for amount?', bal >= amount);
  }

  // 6) Static call revealBet to decode revert reason
  console.log('\n[6] game.revealBet.staticCall(...)');
  try {
    const requestId = await game.revealBet.staticCall(choice, wagerToken, amount, secret);
    console.log('  ✅ staticCall success, requestId =', requestId.toString());
  } catch (e) {
    console.log('  ❌ staticCall reverted');
    if (e && typeof e === 'object') {
      console.log('  name:', e.name);
      console.log('  message:', e.message);
      if (e.shortMessage) console.log('  shortMessage:', e.shortMessage);
      if (e.reason) console.log('  reason:', e.reason);
      if (e.data) console.log('  data:', e.data);
      if (e.error?.data) console.log('  error.data:', e.error.data);
      if (e.info?.error?.data) console.log('  info.error.data:', e.info.error.data);
      console.log('  keys:', Object.keys(e));
      console.log('  full error object (depth=4):');
      console.dir(e, { depth: 4 });
    } else {
      console.log(String(e));
    }

    // rawRpc eth_call revealBet (more likely to return revert data)
    console.log('  rawRpc eth_call revealBet...');
    try {
      const revealData = game.interface.encodeFunctionData('revealBet', [choice, wagerToken, amount, secret]);
      await rawRpc('eth_call', [{ to: addresses.CoinFlipGame, from: me, data: revealData }, 'latest']);
      console.log('  ✅ rawRpc revealBet eth_call success');
    } catch (re) {
      const data = re.data;
      console.log('  ❌ rawRpc revealBet eth_call reverted');
      console.log('  message:', re.message);
      if (data) console.log('  data:', data);
      if (re.rpcError) {
        console.log('  rpcError:', re.rpcError);
        const nested = re.rpcError?.data?.data || re.rpcError?.data?.originalError?.data;
        if (nested) {
          console.log('  nestedRevertData:', nested);
          const sel = decodeCoinFlipSelector(nested);
          if (sel?.selector) {
            console.log('  selector:', sel.selector);
            if (sel.decoded) console.log('  decoded:', sel.decoded);
          }
        }
      }

      const sel = decodeCoinFlipSelector(data);
      if (sel?.selector) {
        console.log('  selector:', sel.selector);
        if (sel.decoded) console.log('  decoded:', sel.decoded);
      }
    }
  }

  console.log('\nDone.');
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
