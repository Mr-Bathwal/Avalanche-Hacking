// Mock data so the whole flow is browsable without a wallet — lets a recruiter
// feel the design and journey. Shown only when not connected; live on-chain data
// takes over once a wallet is connected.

const img = (id) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=800&q=70`;

export const demoEvents = [
  { id: 'e1', name: 'Neon Nights Festival', venue: 'Skyline Arena', city: 'Mumbai', date: 'Sat, 14 Sep · 7:00 PM', priceFrom: 0.25, tier: 'Festival', seatsLeft: 42, totalSeats: 500, image: img('photo-1470229722913-7c0e2dbbafd3') },
  { id: 'e2', name: 'Midnight Techno', venue: 'The Warehouse', city: 'Berlin', date: 'Fri, 20 Sep · 11:00 PM', priceFrom: 0.18, tier: 'Club', seatsLeft: 8, totalSeats: 220, image: img('photo-1493225457124-a3eb161ffa5f') },
  { id: 'e3', name: 'Champions Final', venue: 'Grand Stadium', city: 'London', date: 'Sun, 22 Sep · 5:30 PM', priceFrom: 0.9, tier: 'Sports', seatsLeft: 130, totalSeats: 40000, image: img('photo-1459865264687-595d652de67e') },
  { id: 'e4', name: 'Symphony Under Stars', venue: 'Royal Theatre', city: 'Vienna', date: 'Thu, 26 Sep · 8:00 PM', priceFrom: 0.35, tier: 'Classical', seatsLeft: 60, totalSeats: 900, image: img('photo-1503095396549-807759245b35') },
  { id: 'e5', name: 'Standup Live', venue: 'Comedy Cellar', city: 'New York', date: 'Wed, 2 Oct · 9:00 PM', priceFrom: 0.12, tier: 'Comedy', seatsLeft: 3, totalSeats: 120, image: img('photo-1516280440614-37939bbacd81') },
  { id: 'e6', name: 'Hoops Showdown', venue: 'Downtown Court', city: 'Chicago', date: 'Sat, 5 Oct · 6:00 PM', priceFrom: 0.4, tier: 'Sports', seatsLeft: 210, totalSeats: 18000, image: img('photo-1546519638-68e109498ffc') },
];

export const demoListings = [
  { id: 'l1', event: 'Neon Nights Festival', seat: 'A-12', tier: 'VIP', price: 0.30, lastPrice: 0.25, image: img('photo-1470229722913-7c0e2dbbafd3'), capped: false },
  { id: 'l2', event: 'Midnight Techno', seat: 'GA', tier: 'Normal', price: 0.21, lastPrice: 0.18, image: img('photo-1493225457124-a3eb161ffa5f'), capped: false },
  { id: 'l3', event: 'Champions Final', seat: 'Blk 104 · R7', tier: 'Normal', price: 1.08, lastPrice: 0.90, image: img('photo-1459865264687-595d652de67e'), capped: true },
  { id: 'l4', event: 'Symphony Under Stars', seat: 'Box 3', tier: 'VIP', price: 0.42, lastPrice: 0.35, image: img('photo-1503095396549-807759245b35'), capped: false },
  { id: 'l5', event: 'Hoops Showdown', seat: 'Court-side', tier: 'VIP', price: 0.48, lastPrice: 0.40, image: img('photo-1546519638-68e109498ffc'), capped: false },
  { id: 'l6', event: 'Neon Nights Festival', seat: 'B-04', tier: 'Normal', price: 0.27, lastPrice: 0.25, image: img('photo-1514525253161-7a46d19cd819'), capped: false },
];

export const demoAuctions = [
  { id: 'a1', event: 'Champions Final', seat: 'Blk 101 · R1', currentBid: 1.15, reserve: 1.0, bids: 14, endsIn: '02:41:09', image: img('photo-1459865264687-595d652de67e') },
  { id: 'a2', event: 'Neon Nights Festival', seat: 'A-01 (VIP)', currentBid: 0.34, reserve: 0.30, bids: 9, endsIn: '00:12:55', image: img('photo-1470229722913-7c0e2dbbafd3') },
  { id: 'a3', event: 'Symphony Under Stars', seat: 'Box 1', currentBid: 0.40, reserve: 0.38, bids: 5, endsIn: '05:20:30', image: img('photo-1503095396549-807759245b35') },
  { id: 'a4', event: 'Hoops Showdown', seat: 'Court-side', currentBid: 0.52, reserve: 0.45, bids: 21, endsIn: '01:03:42', image: img('photo-1546519638-68e109498ffc') },
];

export const demoTickets = [
  { id: 't1', event: 'Neon Nights Festival', seat: 'A-12', tier: 'VIP', status: 'Active', image: img('photo-1470229722913-7c0e2dbbafd3') },
  { id: 't2', event: 'Midnight Techno', seat: 'GA', tier: 'Normal', status: 'Active', image: img('photo-1493225457124-a3eb161ffa5f') },
  { id: 't3', event: 'Standup Live', seat: 'R2-08', tier: 'Normal', status: 'Used', image: img('photo-1516280440614-37939bbacd81') },
];

export const demoProfile = {
  address: '0xF00D…Recruiter',
  verified: true,
  level: 3, // VIP
  levelName: 'VIP',
  verifiedAt: 'Aug 2025',
  expiresAt: 'Aug 2026',
  stats: { eventsCreated: 3, ticketsOwned: 3, revenue: 4.812, locked: 0.62 },
  balances: { available: 2.140, locked: 0.620, profits: 1.905 },
};
