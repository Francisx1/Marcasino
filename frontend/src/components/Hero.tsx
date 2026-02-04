'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import Image from 'next/image';

export default function Hero() {
  return (
    <section className="relative py-8 overflow-hidden">
      <div className="container mx-auto px-4 text-center relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          {/* Mario Character */}
          <div className="mb-8 flex justify-center">
            <Image 
              src="/Marcasino.png" 
              alt="Marcasino" 
              width={700} 
              height={700}
              className="pixelated"
              priority
              unoptimized
            />
          </div>

          {/* Main Title */}
          <h1 className="font-pixel text-white text-4xl md:text-6xl mb-6 text-outline">
            IT&apos;S-A ME, MARCASINO!
          </h1>
          
          <p className="font-game text-yellow-300 text-2xl md:text-3xl mb-8">
            Provably Fair Web3 Gaming 🎮
          </p>

          {/* Features */}
          <div className="flex flex-wrap justify-center gap-6 mb-12">
            <div className="game-card flex items-center gap-3">
              <span className="text-3xl">⚡</span>
              <div className="text-left">
                <p className="font-pixel text-sm text-mario-red">Chainlink VRF</p>
                <p className="font-game text-gray-600">Verifiable Randomness</p>
              </div>
            </div>

            <div className="game-card flex items-center gap-3">
              <span className="text-3xl">🎲</span>
              <div className="text-left">
                <p className="font-pixel text-sm text-mario-blue">Multiple Games</p>
                <p className="font-game text-gray-600">Choose Your Adventure</p>
              </div>
            </div>

            <div className="game-card flex items-center gap-3">
              <span className="text-3xl">🏆</span>
              <div className="text-left">
                <p className="font-pixel text-sm text-mario-green">Big Prizes</p>
                <p className="font-game text-gray-600">Win Real ETH</p>
              </div>
            </div>
          </div>

          {/* CTA Button */}
          <div className="flex flex-wrap justify-center gap-4">
            <Link href="/games">
              <motion.button
                className="retro-button"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                🍄 Start Playing
              </motion.button>
            </Link>
          </div>

          {/* Trust Indicators */}
          <div className="mt-12 flex flex-wrap justify-center gap-8 text-white font-game text-xl">
            <div className="flex items-center gap-2">
              <span>🔒</span>
              <span>Audited Smart Contracts</span>
            </div>
            <div className="flex items-center gap-2">
              <span>✅</span>
              <span>Provably Fair</span>
            </div>
            <div className="flex items-center gap-2">
              <span>🚀</span>
              <span>Instant Payouts</span>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
