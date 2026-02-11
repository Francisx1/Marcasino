'use client';

import { ConnectButton } from '@rainbow-me/rainbowkit';
import Link from 'next/link';

export default function Header() {
  return (
    <header className="sticky top-0 z-50 bg-mario-red pixel-border border-b-4">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 hover:scale-105 transition-transform">
            <div className="text-4xl">🍄</div>
            <div>
              <h1 className="font-pixel text-white text-xl text-outline">
                MARCASINO
              </h1>
              <p className="font-game text-yellow-300 text-sm">
                Web3 Casino
              </p>
            </div>
          </Link>

          {/* Navigation */}
          <nav className="hidden md:flex items-center gap-6">
            <Link href="/" className="font-game text-white text-xl hover:text-yellow-300 transition-colors">
              Home
            </Link>
            <Link href="/games" className="font-game text-white text-xl hover:text-yellow-300 transition-colors">
              Games
            </Link>
          </nav>

          {/* Wallet Connect */}
          <div className="flex items-center gap-4 shrink-0">
            <ConnectButton
              chainStatus="none"
              showBalance={true}
            />
          </div>
        </div>
      </div>
    </header>
  );
}
