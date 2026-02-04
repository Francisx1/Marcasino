'use client';

import { motion } from 'framer-motion';

const stats = [
  { label: 'Total Bets', value: '12,345', icon: '🎲', color: 'bg-mario-red' },
  { label: 'Total Winnings', value: '543 ETH', icon: '💰', color: 'bg-mario-yellow' },
  { label: 'Active Players', value: '1,234', icon: '👥', color: 'bg-mario-blue' },
  { label: 'Games Played', value: '45,678', icon: '🎮', color: 'bg-mario-green' },
];

export default function Stats() {
  return (
    <section className="py-12">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {stats.map((stat, index) => (
            <motion.div
              key={stat.label}
              className="stat-card"
              initial={{ opacity: 0, scale: 0.8 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
            >
              <div className="text-4xl mb-2">{stat.icon}</div>
              <p className="font-pixel text-2xl text-black mb-1">{stat.value}</p>
              <p className="font-game text-gray-600 text-lg">{stat.label}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
