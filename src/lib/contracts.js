// Contract addresses on Avalanche Fuji testnet
export const CONTRACT_ADDRESSES = {
  USER_VERIFIER: '0xD8d2412e32cB638CCBdD297F75eC091f09d9E943',
  EVENT_FACTORY: '0xBdfD55f12efCBd84Fc5851b7e9E1931b5381edBe',
  TICKET_MARKETPLACE: '0x4C64044450e5f5F05Bbb5c462DBc3d32B7c1dED7',
};

// Minimal/optimized ABIs for main contracts
export const USER_VERIFICATION_ABI = [
  'function isVerifiedAndActive(address user) external view returns (bool)',
  'function getUserStatus(address user) external view returns (bool isVerified, uint8 level, uint256 verifiedAt, uint256 expiresAt, bool suspended, uint256 suspendedUntil, uint8 suspendedReason)',
  'function verifyUser(address user) external',
  'function hasMinimumLevel(address user, uint8 minLevel) external view returns (bool)',
];

export const EVENT_FACTORY_ABI = [
  'function createEvent((string,string,uint256,uint256,uint256,uint256,uint256,uint256,uint256,(uint256,uint256,uint256,uint256,bool),uint256,bool,uint256,address[],string,string,uint256,string,string)) external payable returns (address)',
  'function getAllDeployedEvents() external view returns (address[])',
  'function getAllOrganizerEvents(address organizer) external view returns (address[])',
  'function authorizedOrganizers(address) external view returns (bool)',
  'function eventCreationFee() external view returns (uint256)',
  'function requestFaucet() external',
  'event EventCreated(address indexed organizer, address indexed eventContract)',
];

export const TICKET_MARKETPLACE_ABI = [
  'function depositForEvent(address eventContract) external payable',
  'function buyItemWithDeposits(address tokenContract, uint256 tokenId) external',
  'function listItemFixedPrice(address tokenContract, uint256 tokenId, uint256 price) external',
  'function createAuction(address tokenContract, uint256 tokenId, uint256 startingPrice, uint256 reservePrice, uint256 duration, uint256 minBidIncrement) external',
  'function placeBidWithDeposits(address tokenContract, uint256 tokenId, uint256 bidAmount) external',
  'function settleAuction(address tokenContract, uint256 tokenId) external',
  'function withdrawFunds(address eventContract, uint256 amount) external',
  'function collectProfits(address eventContract) external',
  'function getUserBalance(address user, address eventContract) external view returns (uint256 totalDeposited, uint256 availableBalance, uint256 lockedBalance, uint256 totalWithdrawn, uint256 totalProfits, uint256 maxWithdrawable)',
  'function getListingId(address tokenContract, uint256 tokenId) external pure returns (bytes32)',
  'function listings(bytes32) external view returns (address seller, address tokenContract, uint256 tokenId, uint256 price, uint8 saleType, bool active, uint256 listedAt)',
  'function auctions(bytes32) external view returns (uint256 startTime, uint256 endTime, uint256 reservePrice, uint256 minBidIncrement, address highestBidder, uint256 highestBid, uint8 status, uint256 extensionCount)',
];

export const EVENT_TICKET_ABI = [
  'function mintTicket(string memory eventName, uint256 seatNumber) external payable',
  'function getSeatPrice(uint256 seatNumber, bool isVIP) external view returns (uint256)',
  'function useTicket(uint256 tokenId) external',
  'function refundTicket(uint256 tokenId) external',
  'function calculateRefundPercentage(address user, uint256 tokenId) external view returns (uint256)',
  'function ownerOf(uint256 tokenId) external view returns (address)',
  'function tokenURI(uint256 tokenId) external view returns (string)',
  'function balanceOf(address owner) external view returns (uint256)',
  'function tokenOfOwnerByIndex(address owner, uint256 index) external view returns (uint256)',
  'function totalSupply() external view returns (uint256)',
  'function approve(address to, uint256 tokenId) external',
  'function setApprovalForAll(address operator, bool approved) external',
  'function isApprovedForAll(address owner, address operator) external view returns (bool)',
  'function getApproved(uint256 tokenId) external view returns (address)',
  'function transferFrom(address from, address to, uint256 tokenId) external',
  'function safeTransferFrom(address from, address to, uint256 tokenId) external',
  'function maxSupply() external view returns (uint256)',
  'function baseMintPrice() external view returns (uint256)',
  'function vipMintPrice() external view returns (uint256)',
  'function eventOrganizer() external view returns (address)',
  'function eventStartTime() external view returns (uint256)',
  'function eventEndTime() external view returns (uint256)',
  'function eventCancelled() external view returns (bool)',
  'function eventCompleted() external view returns (bool)',
  'function venue() external view returns (string)',
  'function eventDescription() external view returns (string)',
  'function nextTicketId() external view returns (uint256)',
  'function seatCount() external view returns (uint256)',
  'function userMintCount(address) external view returns (uint256)',
  'function maxMintsPerUser() external view returns (uint256)',
  'function vipConfig() external view returns (uint256 totalVIPSeats, uint256 vipSeatStart, uint256 vipSeatEnd, uint256 vipHoldingPeriod, bool vipEnabled)',
  'function tickets(uint256) external view returns (string eventName, uint256 seatNumber, bool isVIP, uint256 mintedAt, uint256 pricePaid, bool isUsed, bool isTransferable, string venue)',
  'function seatMinted(uint256) external view returns (bool)',
  // ... you can add more as needed for UI purposes
];

// Enums as plain objects (for frontend logic)
export const SaleType = {
  FIXED_PRICE: 0,
  AUCTION: 1,
};
export const AuctionStatus = {
  ACTIVE: 0,
  ENDED: 1,
  CANCELLED: 2,
};
export const VerificationLevel = {
  None: 0,
  Basic: 1,
  Premium: 2,
  VIP: 3,
  Admin: 4,
};

// --- FULL DETAILED ABI for event ticket contracts ---
// Make sure the path is correct relative to this file!
import EventTicketFullABI from '../abifiles/EventTicketABI.json';
export { EventTicketFullABI };
