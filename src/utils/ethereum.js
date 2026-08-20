// src/utils/ethereum.js
import { BrowserProvider } from 'ethers';
import { avalancheFuji } from 'wagmi/chains';

export const NETWORK_CONFIG = {
  chainId: avalancheFuji.id,
  chainName: avalancheFuji.name,
  nativeCurrency: avalancheFuji.nativeCurrency,
  rpcUrls: [avalancheFuji.rpcUrls.default.http[0]],
  blockExplorerUrls: [avalancheFuji.blockExplorers.default.url],
};

export const checkNetwork = async () => {
  if (!window.ethereum) {
    throw new Error('MetaMask not installed');
  }

  const provider = new BrowserProvider(window.ethereum);
  const network = await provider.getNetwork();

  // ethers v6 returns chainId as a bigint; compare numerically to avoid a
  // bigint-vs-number mismatch that would always report the "wrong" network.
  if (Number(network.chainId) !== NETWORK_CONFIG.chainId) {
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: `0x${NETWORK_CONFIG.chainId.toString(16)}` }],
      });
    } catch (switchError) {
      // This error code indicates that the chain has not been added to MetaMask
      if (switchError.code === 4902) {
        try {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [
              {
                chainId: `0x${NETWORK_CONFIG.chainId.toString(16)}`,
                chainName: NETWORK_CONFIG.chainName,
                nativeCurrency: NETWORK_CONFIG.nativeCurrency,
                rpcUrls: NETWORK_CONFIG.rpcUrls,
                blockExplorerUrls: NETWORK_CONFIG.blockExplorerUrls,
              },
            ],
          });
        } catch (addError) {
          throw new Error('Failed to add network to MetaMask');
        }
      } else {
        throw new Error('Failed to switch network');
      }
    }
  }
};

export const formatAddress = (address) => {
  if (!address) return '';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

export const formatPrice = (price, decimals = 4) => {
  return parseFloat(price).toFixed(decimals);
};

export const getExplorerUrl = (txHash) => {
  return `${NETWORK_CONFIG.blockExplorerUrls[0]}/tx/${txHash}`;
};

export const getAddressUrl = (address) => {
  return `${NETWORK_CONFIG.blockExplorerUrls[0]}/address/${address}`;
};
