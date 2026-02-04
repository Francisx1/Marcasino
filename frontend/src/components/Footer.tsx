'use client';

import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="bg-black text-white py-12 mt-20">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <span className="text-4xl">🍄</span>
              <h3 className="font-pixel text-xl">MARCASINO</h3>
            </div>
            <p className="font-game text-gray-400 text-base">
              Provably fair Web3 gaming platform with Super Mario theme.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="font-pixel text-sm mb-4 text-mario-yellow">QUICK LINKS</h4>
            <ul className="space-y-2 font-game text-base">
              <li><Link href="/" className="hover:text-mario-yellow transition-colors">Home</Link></li>
              <li><Link href="/games" className="hover:text-mario-yellow transition-colors">Games</Link></li>
              <li><Link href="/leaderboard" className="hover:text-mario-yellow transition-colors">Leaderboard</Link></li>
              <li><Link href="/docs" className="hover:text-mario-yellow transition-colors">Documentation</Link></li>
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h4 className="font-pixel text-sm mb-4 text-mario-yellow">RESOURCES</h4>
            <ul className="space-y-2 font-game text-base">
              <li><Link href="/docs/architecture" className="hover:text-mario-yellow transition-colors">Architecture</Link></li>
              <li><Link href="/docs/security" className="hover:text-mario-yellow transition-colors">Security</Link></li>
              <li><Link href="/docs/gas" className="hover:text-mario-yellow transition-colors">Gas Optimization</Link></li>
              <li><a href="https://github.com/Francisx1/Marcasino" target="_blank" rel="noopener noreferrer" className="hover:text-mario-yellow transition-colors">GitHub</a></li>
            </ul>
          </div>

          {/* Social & Info */}
          <div>
            <h4 className="font-pixel text-sm mb-4 text-mario-yellow">CONNECT</h4>
            <ul className="space-y-2 font-game text-base">
              <li><a href="#" className="hover:text-mario-yellow transition-colors">Twitter</a></li>
              <li><a href="#" className="hover:text-mario-yellow transition-colors">Discord</a></li>
              <li><a href="#" className="hover:text-mario-yellow transition-colors">Telegram</a></li>
            </ul>
            <div className="mt-6 pixel-border bg-mario-red p-3">
              <p className="font-game text-sm">
                🎓 Academic Project<br/>
                Blockchain Development Course
              </p>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t-2 border-gray-800 mt-8 pt-8 text-center">
          <p className="font-game text-gray-400 text-base">
            © 2026 Marcasino. Built with ❤️ and 🍄
          </p>
          <p className="font-game text-gray-500 text-sm mt-2">
            Powered by Chainlink VRF | Deployed on Ethereum
          </p>
        </div>
      </div>
    </footer>
  );
}
