'use client';

export default function Footer() {
  return (
    <footer className="bg-black text-white py-8 mt-auto">
      <div className="container mx-auto px-4">
        {/* Bottom Bar */}
        <div className="border-t-2 border-gray-800 pt-6 text-center">
          <p className="font-game text-gray-400 text-base">
            © 2026 Marcasino
          </p>
          <p className="font-game text-gray-500 text-sm mt-2">
            Powered by Chainlink VRF | Deployed on Ethereum
          </p>
        </div>
      </div>
    </footer>
  );
}
