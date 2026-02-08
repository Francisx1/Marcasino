export const CoinFlipGameAbi = [
  {
    type: 'event',
    name: 'RandomnessRequested',
    inputs: [
      { indexed: true, name: 'requestId', type: 'uint256' },
      { indexed: true, name: 'player', type: 'address' },
    ],
    anonymous: false,
  },
  {
    type: 'function',
    name: 'commitBet',
    stateMutability: 'payable',
    inputs: [{ name: 'commitment', type: 'bytes32' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'revealBet',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'choice', type: 'uint8' },
      { name: 'wagerToken', type: 'address' },
      { name: 'amount', type: 'uint256' },
      { name: 'secret', type: 'bytes32' },
    ],
    outputs: [{ name: 'requestId', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'settleRequest',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'requestId', type: 'uint256' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'retryRequest',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'requestId', type: 'uint256' }],
    outputs: [{ name: 'newRequestId', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'refundRequest',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'requestId', type: 'uint256' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'getRequest',
    stateMutability: 'view',
    inputs: [{ name: 'requestId', type: 'uint256' }],
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          { name: 'fulfilled', type: 'bool' },
          { name: 'exists', type: 'bool' },
          { name: 'settled', type: 'bool' },
          { name: 'refunded', type: 'bool' },
          { name: 'replacedBy', type: 'uint256' },
          { name: 'randomWord', type: 'uint256' },
          { name: 'player', type: 'address' },
          { name: 'wagerToken', type: 'address' },
          { name: 'betAmount', type: 'uint256' },
          { name: 'timestamp', type: 'uint256' },
          { name: 'gameChoice', type: 'uint8' },
        ],
      },
    ],
  },
  {
    type: 'function',
    name: 'getOutcome',
    stateMutability: 'view',
    inputs: [{ name: 'requestId', type: 'uint256' }],
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          { name: 'exists', type: 'bool' },
          { name: 'win', type: 'bool' },
          { name: 'playerChoice', type: 'uint8' },
          { name: 'outcome', type: 'uint8' },
          { name: 'player', type: 'address' },
          { name: 'wagerToken', type: 'address' },
          { name: 'betAmount', type: 'uint256' },
          { name: 'payoutAmount', type: 'uint256' },
        ],
      },
    ],
  },
] as const;

export const PowerUpLotteryAbi = [
  {
    type: 'event',
    name: 'DrawRequested',
    inputs: [
      { indexed: true, name: 'roundId', type: 'uint256' },
      { indexed: true, name: 'requestId', type: 'uint256' },
      { indexed: false, name: 'ticketCount', type: 'uint256' },
      { indexed: false, name: 'prizePool', type: 'uint256' },
    ],
    anonymous: false,
  },
  {
    type: 'function',
    name: 'buyTickets',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'count', type: 'uint256' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'requestDraw',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: [{ name: 'requestId', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'settleRequest',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'requestId', type: 'uint256' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'getCurrentRound',
    stateMutability: 'view',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          { name: 'startTime', type: 'uint256' },
          { name: 'endTime', type: 'uint256' },
          { name: 'ticketCount', type: 'uint256' },
          { name: 'prizePool', type: 'uint256' },
          { name: 'drawRequested', type: 'bool' },
          { name: 'settled', type: 'bool' },
          { name: 'requestId', type: 'uint256' },
          { name: 'winner', type: 'address' },
        ],
      },
    ],
  },
  {
    type: 'function',
    name: 'getRequest',
    stateMutability: 'view',
    inputs: [{ name: 'requestId', type: 'uint256' }],
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          { name: 'fulfilled', type: 'bool' },
          { name: 'exists', type: 'bool' },
          { name: 'settled', type: 'bool' },
          { name: 'refunded', type: 'bool' },
          { name: 'replacedBy', type: 'uint256' },
          { name: 'randomWord', type: 'uint256' },
          { name: 'player', type: 'address' },
          { name: 'wagerToken', type: 'address' },
          { name: 'betAmount', type: 'uint256' },
          { name: 'timestamp', type: 'uint256' },
          { name: 'gameChoice', type: 'uint8' },
        ],
      },
    ],
  },
  {
    type: 'function',
    name: 'resultsByRequestId',
    stateMutability: 'view',
    inputs: [{ name: 'requestId', type: 'uint256' }],
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          { name: 'exists', type: 'bool' },
          { name: 'roundId', type: 'uint256' },
          { name: 'winningTicketIndex', type: 'uint256' },
          { name: 'winner', type: 'address' },
          { name: 'prizePool', type: 'uint256' },
        ],
      },
    ],
  },
] as const;

export const DiceGameAbi = [
  {
    type: 'event',
    name: 'RandomnessRequested',
    inputs: [
      { indexed: true, name: 'requestId', type: 'uint256' },
      { indexed: true, name: 'player', type: 'address' },
    ],
    anonymous: false,
  },
  {
    type: 'function',
    name: 'commitBet',
    stateMutability: 'payable',
    inputs: [{ name: 'commitment', type: 'bytes32' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'revealBet',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'tier', type: 'uint8' },
      { name: 'wagerToken', type: 'address' },
      { name: 'amount', type: 'uint256' },
      { name: 'secret', type: 'bytes32' },
    ],
    outputs: [{ name: 'requestId', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'settleRequest',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'requestId', type: 'uint256' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'retryRequest',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'requestId', type: 'uint256' }],
    outputs: [{ name: 'newRequestId', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'refundRequest',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'requestId', type: 'uint256' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'getRequest',
    stateMutability: 'view',
    inputs: [{ name: 'requestId', type: 'uint256' }],
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          { name: 'fulfilled', type: 'bool' },
          { name: 'exists', type: 'bool' },
          { name: 'settled', type: 'bool' },
          { name: 'refunded', type: 'bool' },
          { name: 'replacedBy', type: 'uint256' },
          { name: 'randomWord', type: 'uint256' },
          { name: 'player', type: 'address' },
          { name: 'wagerToken', type: 'address' },
          { name: 'betAmount', type: 'uint256' },
          { name: 'timestamp', type: 'uint256' },
          { name: 'gameChoice', type: 'uint8' },
        ],
      },
    ],
  },
  {
    type: 'function',
    name: 'getOutcome',
    stateMutability: 'view',
    inputs: [{ name: 'requestId', type: 'uint256' }],
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          { name: 'exists', type: 'bool' },
          { name: 'win', type: 'bool' },
          { name: 'tier', type: 'uint8' },
          { name: 'roll', type: 'uint256' },
          { name: 'player', type: 'address' },
          { name: 'wagerToken', type: 'address' },
          { name: 'betAmount', type: 'uint256' },
          { name: 'payoutAmount', type: 'uint256' },
        ],
      },
    ],
  },
] as const;

export const TreasuryManagerAbi = [
  {
    type: 'function',
    name: 'deposit',
    stateMutability: 'payable',
    inputs: [],
    outputs: [],
  },
  {
    type: 'function',
    name: 'depositToken',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'token', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'playerBalances',
    stateMutability: 'view',
    inputs: [{ name: 'player', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'playerTokenBalances',
    stateMutability: 'view',
    inputs: [
      { name: 'player', type: 'address' },
      { name: 'token', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const;

export const MockERC20Abi = [
  {
    type: 'function',
    name: 'faucet',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: [],
  },
  {
    type: 'function',
    name: 'approve',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [{ name: 'owner', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const;
