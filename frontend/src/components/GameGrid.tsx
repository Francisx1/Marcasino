'use client';

import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';

const games = [
  {
    id: 1,
    name: 'Coin Flip',
    subtitle: 'Mario vs Luigi',
    description: 'Pick a side and flip! 50/50 chance to double your coins.',
    icon: '🪙',
    multiplier: '1.98x',
    difficulty: 'Easy',
    color: 'bg-mario-red',
  },
  {
    id: 2,
    name: 'Mystery Dice',
    subtitle: 'Roll for Glory',
    description: 'Choose your target and roll the dice. Higher risk, higher rewards!',
    icon: '🎲',
    multiplier: 'Up to 98x',
    difficulty: 'Medium',
    color: 'bg-mario-blue',
  },
  {
    id: 3,
    name: 'Power-Up Lottery',
    subtitle: 'Weekly Draw',
    description: 'Buy tickets and win the jackpot. Someone always wins!',
    icon: '⭐',
    multiplier: 'Jackpot',
    difficulty: 'Lucky',
    color: 'bg-mario-yellow',
  },
  {
    id: 4,
    name: 'Bowser\'s Challenge',
    subtitle: 'Coming Soon',
    description: 'Face Bowser in an epic prediction market. Community vs. House!',
    icon: '🐉',
    multiplier: 'Variable',
    difficulty: 'Hard',
    color: 'bg-mario-green',
  },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

export default function GameGrid() {
  const router = useRouter();

  return (
    <section className="py-16 bg-gradient-to-b from-transparent to-black/20">
      <div className="container mx-auto px-4">
        {/* Section Header */}
        <div className="text-center mb-12">
          <h2 className="font-pixel text-white text-3xl md:text-4xl mb-4 text-outline">
            🎮 CHOOSE YOUR GAME 🎮
          </h2>
          <p className="font-game text-yellow-300 text-xl">
            All games use Chainlink VRF for provably fair outcomes
          </p>
        </div>

        {/* Games Grid */}
        <motion.div
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
        >
          {games.map((game) => (
            <motion.div
              key={game.id}
              className="game-card group cursor-pointer"
              variants={itemVariants}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.98 }}
            >
              {/* Game Icon */}
              <div className="text-center mb-4">
                <div className="text-6xl mb-2 inline-block group-hover:animate-bounce">
                  {game.icon}
                </div>
                <h3 className="font-pixel text-lg mb-1">{game.name}</h3>
                <p className="font-game text-gray-600 text-sm">{game.subtitle}</p>
              </div>

              {/* Game Info */}
              <div className="space-y-3 mb-4">
                <p className="font-game text-gray-700 text-base">
                  {game.description}
                </p>

                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-game text-xs text-gray-500">Multiplier</p>
                    <p className="font-pixel text-sm text-mario-red">{game.multiplier}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-game text-xs text-gray-500">Difficulty</p>
                    <p className="font-pixel text-sm text-mario-blue">{game.difficulty}</p>
                  </div>
                </div>
              </div>

              {/* Play Button */}
              <button 
                className={`w-full ${game.color} text-white font-pixel text-xs py-3 px-4 
                          pixel-border hover:brightness-110 transition-all`}
                disabled={game.id > 3}
                onClick={() => {
                  if (game.id === 1) router.push('/games/coinflip');
                  if (game.id === 2) router.push('/games/dice');
                  if (game.id === 3) router.push('/games/lottery');
                }}
              >
                {game.id > 3 ? '🔒 LOCKED' : '▶️ PLAY NOW'}
              </button>

              {/* Ribbon for featured games */}
              {game.id === 1 && (
                <div className="absolute -top-2 -right-2 bg-mario-yellow text-black 
                              font-pixel text-xs px-3 py-1 pixel-border rotate-12">
                  HOT 🔥
                </div>
              )}
            </motion.div>
          ))}
        </motion.div>

        {/* Info Banner */}
        <div className="mt-12 mystery-block p-6 text-center">
          <p className="font-game text-black text-xl">
            <span className="font-pixel text-2xl">❓</span>
            <span className="ml-2">
              New games unlock as the platform grows! Stay tuned for more adventures!
            </span>
            <span className="font-pixel text-2xl ml-2">❓</span>
          </p>
        </div>
      </div>
    </section>
  );
}
