import { hardhat, sepolia } from 'wagmi/chains';

const SEPOLIA_FALLBACK_DEPLOYMENT: Deployment = {
  network: 'sepolia',
  timestamp: '2026-02-11T15:02:00.000Z',
  contracts: {
    MarcasinoCore: '0xDD024a72771A1abA6F1e0fa707bc76d2E62e785d',
    TreasuryManager: '0xDa06f87B0EC232015f330282ddf117b69C427682',
    CoinFlipGame: '0x7eaE3b83360bC913b1EDDdFe120c9B3241104B3E',
    DiceGame: '0x196483DBf75B6228F8905e21484B34B38dED62FE',
    PowerUpLottery: '0x9F72a2Ca162088A01d9bb68d6fC17b2Ac3d4a1F1',
    MockToken: '0xE4157368F05415b6Ed4447c8b2bf184883f130E0',
  },
  config: {
    houseEdge: 100,
    minBet: '10000000000000000',
    maxBet: '1000000000000000000000',
    vrfCoordinator: '0x9DdfaCa8183c41ad55329BdeeD9F6A8d53168B1B',
    vrfKeyHash: '0x787d74caea10b2b357790d5b5247c2f63d1d91572a9846f780606e4d953677ae',
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
