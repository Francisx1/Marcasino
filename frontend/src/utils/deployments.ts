import { hardhat, sepolia } from 'wagmi/chains';

const SEPOLIA_FALLBACK_DEPLOYMENT: Deployment = {
  network: 'sepolia',
  timestamp: '2026-02-08T05:45:50.172Z',
  contracts: {
    MarcasinoCore: '0x2054ec7315138A2dBc8B9b51C15a5d2C8749c0C6',
    TreasuryManager: '0x54e09bc035F2dde6334187372412608550a15755',
    CoinFlipGame: '0x2095e8f169bCe2C4252a4E9B022f5f196F304958',
    DiceGame: '0xE03841B9F2843bc56ce348DcaEfa31A63BC4d2d8',
    PowerUpLottery: '0xB3d5330AD1DA68c108E458A079cD89eF32C5269a',
    MockToken: '0xe12814Ca5916A757E4eBEb7360aCdd34C086F327',
  },
  config: {
    houseEdge: 100,
    minBet: '10000000000000000',
    maxBet: '1000000000000000000000',
    vrfCoordinator: '0x8103B0A8A00be2DDC778e6e7eaa21791Cd364625',
    vrfKeyHash: '0x474e34a077df58807dbe9c96d3c009b23b3c6d0cce433e59bbf5b34f823bc56c',
    vrfSubscriptionId:
      '1983448149351078970646998783068266777241512301730753921521870836150867354700',
    revealDelay: 120,
    vrfTimeout: 600,
    slashingDeposit: '2000000000000000',
  },
};

export type Deployment = {
  network: string;
  timestamp: string;
  contracts: {
    MarcasinoCore: `0x${string}`;
    TreasuryManager: `0x${string}`;
    CoinFlipGame: `0x${string}`;
    DiceGame: `0x${string}`;
    PowerUpLottery: `0x${string}`;
    MockToken: `0x${string}`;
  };
  config: {
    houseEdge: number;
    minBet: string;
    maxBet: string;
    vrfCoordinator: `0x${string}`;
    vrfKeyHash: `0x${string}`;
    vrfSubscriptionId: string;
    revealDelay: number;
    vrfTimeout: number;
    slashingDeposit: string;
  };
};

export function getNetworkName(chainId?: number) {
  if (chainId === sepolia.id) return 'sepolia';
  if (chainId === hardhat.id) return 'hardhat';
  return 'hardhat';
}

export async function loadDeployment(chainId?: number): Promise<Deployment> {
  const network = getNetworkName(chainId);

  try {
    const res = await fetch(`/deployments/${network}.json`, { cache: 'no-store' });
    if (!res.ok) {
      throw new Error(`Missing deployments/${network}.json`);
    }
    return (await res.json()) as Deployment;
  } catch (e) {
    if (network === 'hardhat') {
      const res = await fetch(`/deployments/localhost.json`, { cache: 'no-store' });
      if (!res.ok) {
        throw new Error('Missing deployments/hardhat.json (also tried deployments/localhost.json)');
      }
      return (await res.json()) as Deployment;
    }
    if (network === 'sepolia') return SEPOLIA_FALLBACK_DEPLOYMENT;
    throw e;
  }
}

export function getChainlinkVrfRequestUrl(params: {
  chainId?: number;
  subscriptionId: string;
  requestId: string;
}) {
  const network = params.chainId === sepolia.id ? 'sepolia' : 'ethereum';
  return `https://vrf.chain.link/${network}/${params.subscriptionId}/${params.requestId}`;
}
