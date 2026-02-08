'use client';

import { WagmiProvider, createConfig, http } from 'wagmi';
import { sepolia, hardhat } from 'wagmi/chains';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RainbowKitProvider, getDefaultConfig } from '@rainbow-me/rainbowkit';
import '@rainbow-me/rainbowkit/styles.css';
import { Toaster } from 'react-hot-toast';

const config = getDefaultConfig({
  appName: 'Marcasino',
  projectId: process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID || 'YOUR_PROJECT_ID',
  chains: [hardhat, sepolia],
  transports: {
    [hardhat.id]: http(),
    [sepolia.id]: http(process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL),
  },
});

const queryClient = new QueryClient();

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider>
          {children}
          <Toaster 
            position="top-right"
            toastOptions={{
              className: 'font-game',
              style: {
                border: '4px solid #000',
                padding: '16px',
                color: '#000',
              },
              success: {
                iconTheme: {
                  primary: '#43B047',
                  secondary: '#fff',
                },
              },
              error: {
                iconTheme: {
                  primary: '#E52521',
                  secondary: '#fff',
                },
              },
            }}
          />
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
