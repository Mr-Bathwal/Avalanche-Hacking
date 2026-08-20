import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { avalancheFuji } from 'wagmi/chains';
import { http } from 'wagmi';

// Config is read from env so no secrets live in source (see .env.example).
// Defaults are the public Avalanche Fuji RPC and a demo WalletConnect id.
const RPC_URL =
  import.meta.env.VITE_FUJI_RPC_URL || 'https://api.avax-test.network/ext/bc/C/rpc';
const WC_PROJECT_ID =
  import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || '165b4e8850ea73b9832013ffe306116c';

// Avalanche Fuji testnet configuration
export const config = getDefaultConfig({
  appName: 'TicketVerse',
  projectId: WC_PROJECT_ID,
  chains: [avalancheFuji],
  transports: {
    [avalancheFuji.id]: http(RPC_URL),
  },
  ssr: true, // Enable this if you're using SSR
});

export { avalancheFuji } from 'wagmi/chains';
