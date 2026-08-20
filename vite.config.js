import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import process from 'node:process'
import { fileURLToPath } from 'url'

// ESM-safe __dirname (this file runs as an ES module — no CommonJS __dirname).
const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Base path: '/' for local dev, '/<repo>/' when building for GitHub Pages.
// The Pages workflow sets BASE_PATH; everything else falls back to '/'.
const base = process.env.BASE_PATH || '/'

export default defineConfig({
  base,
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  optimizeDeps: {
    include: ['@tanstack/react-query'],
  },
  build: {
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          web3: ['wagmi', 'viem', 'ethers', '@rainbow-me/rainbowkit'],
        },
      },
    },
  },
  server: {
    host: true,
    port: 5173,
  },
})
