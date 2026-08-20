# TicketVerse — Smart Contracts

Solidity contracts powering [TicketVerse](../README.md): NFT event ticketing on
Avalanche with **on-chain anti-scalping**. Built with Hardhat + OpenZeppelin v5.

> These sources were reconstructed to match the ABIs the frontend integrates
> against (`src/abifiles/` and `src/lib/contracts.js`), so the existing UI works
> against them unchanged after redeployment.

## Contracts

| Contract | Responsibility |
|--|--|
| `EventFactory.sol` | Deploys one `EventTicket` per event; registry of all events + per-organizer events; fee / faucet. |
| `EventTicket.sol` | ERC-721 (Enumerable) tickets — seat/tier/venue on-chain, seat pricing, mint limits, refunds, and a **VIP holding-period transfer lock**. |
| `TicketMarketplace.sol` | Deposit-escrowed resale — fixed-price + anti-snipe auctions, **+20% max-markup cap**, organizer royalties. |
| `UserVerifier.sol` | On-chain human/identity verification with levels, expiry, and suspensions. |
| `Types.sol` | Shared structs (`CreateEventParams`, `VIPConfig`, `Ticket`) whose field order matches the frontend tuples. |

## Quick start

```bash
cd smart-contracts
npm install
npm run compile
npm test           # runs the Hardhat test suite (mint, cap, resale, royalties)
```

## Deploy (Avalanche Fuji)

```bash
cp .env.example .env      # add a testnet PRIVATE_KEY
npm run deploy:fuji
```

The script prints the three addresses; paste them into
`../src/lib/contracts.js` (`CONTRACT_ADDRESSES`) to point the frontend at your
deployment.

## Design notes

- **Anti-scalping** is enforced in `TicketMarketplace`: a resale (fixed-price or
  auction start/bid) may not exceed **120%** of the ticket's last sale price, or
  its original mint price if never resold.
- **VIP tickets** are non-transferable during `vipHoldingPeriod` — enforced in
  `EventTicket._update`, so it also blocks listing them for early resale.
- **Escrow model**: buyers pre-deposit into a per-event balance; trades move an
  internal ledger and real AVAX only moves on deposit / withdraw, which keeps
  settlement gas-light and reentrancy-safe (`ReentrancyGuard` throughout).
