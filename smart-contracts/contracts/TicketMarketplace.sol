// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {ERC721Holder} from "@openzeppelin/contracts/token/ERC721/utils/ERC721Holder.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Ticket} from "./Types.sol";

interface IEventTicketInfo {
    function eventOrganizer() external view returns (address);
    function royaltyFeePercentage() external view returns (uint256);
    function eventCompleted() external view returns (bool);
    function eventCancelled() external view returns (bool);
    function getTicketInfo(uint256 tokenId) external view returns (Ticket memory);
}

/// @title TicketMarketplace
/// @notice Deposit-escrowed secondary market for event tickets. Enforces an
/// on-chain anti-scalping cap (max +20% over the ticket's last sale / mint price)
/// on fixed-price listings, and supports anti-snipe auctions. Buyers pre-deposit
/// into a per-event balance; trades settle against that ledger and real AVAX only
/// moves on deposit/withdraw.
contract TicketMarketplace is ERC721Holder, ReentrancyGuard {
    enum SaleType {
        FIXED_PRICE,
        AUCTION
    }

    enum AuctionStatus {
        ACTIVE,
        ENDED,
        CANCELLED
    }

    struct Listing {
        address seller;
        address tokenContract;
        uint256 tokenId;
        uint256 price;
        SaleType saleType;
        bool active;
        uint256 listedAt;
    }

    struct Auction {
        uint256 startTime;
        uint256 endTime;
        uint256 reservePrice;
        uint256 minBidIncrement;
        address highestBidder;
        uint256 highestBid;
        AuctionStatus status;
        uint256 extensionCount;
    }

    struct Balance {
        uint256 totalDeposited;
        uint256 availableBalance;
        uint256 lockedBalance;
        uint256 totalWithdrawn;
        uint256 totalProfits;
    }

    uint256 public constant MAX_MARKUP_BPS = 12000; // 120% => +20% cap
    uint256 public constant BPS = 10000;
    uint256 public constant EXTENSION_WINDOW = 5 minutes;
    uint256 public constant EXTENSION_TIME = 5 minutes;

    mapping(bytes32 => Listing) public listings;
    mapping(bytes32 => Auction) public auctions;
    mapping(bytes32 => uint256) public lastSalePrice; // listingId => last secondary price

    // user => eventContract => balance
    mapping(address => mapping(address => Balance)) private _balances;
    mapping(address => uint256) public eventTotalDeposited;

    event Deposited(address indexed user, address indexed eventContract, uint256 amount);
    event Withdrawn(address indexed user, address indexed eventContract, uint256 amount);
    event Listed(bytes32 indexed id, address indexed seller, uint256 price, SaleType saleType);
    event Sold(bytes32 indexed id, address indexed buyer, uint256 price);
    event AuctionCreated(bytes32 indexed id, address indexed seller, uint256 startingPrice, uint256 endTime);
    event BidPlaced(bytes32 indexed id, address indexed bidder, uint256 amount);
    event AuctionSettled(bytes32 indexed id, address indexed winner, uint256 amount);

    // ------------------------------------------------------------------
    // Deposits / balances
    // ------------------------------------------------------------------

    function depositForEvent(address eventContract) external payable {
        require(msg.value > 0, "no value");
        Balance storage b = _balances[msg.sender][eventContract];
        b.totalDeposited += msg.value;
        b.availableBalance += msg.value;
        eventTotalDeposited[eventContract] += msg.value;
        emit Deposited(msg.sender, eventContract, msg.value);
    }

    function withdrawFunds(address eventContract, uint256 amount) public nonReentrant {
        Balance storage b = _balances[msg.sender][eventContract];
        require(amount > 0 && amount <= b.availableBalance, "bad amount");
        b.availableBalance -= amount;
        b.totalWithdrawn += amount;
        (bool ok, ) = payable(msg.sender).call{value: amount}("");
        require(ok, "withdraw failed");
        emit Withdrawn(msg.sender, eventContract, amount);
    }

    /// @notice Withdraw the caller's entire available balance for an event.
    function collectProfits(address eventContract) external {
        withdrawFunds(eventContract, _balances[msg.sender][eventContract].availableBalance);
    }

    function getUserBalance(address user, address eventContract)
        external
        view
        returns (
            uint256 totalDeposited,
            uint256 availableBalance,
            uint256 lockedBalance,
            uint256 totalWithdrawn,
            uint256 totalProfits,
            uint256 maxWithdrawable
        )
    {
        Balance memory b = _balances[user][eventContract];
        return (
            b.totalDeposited,
            b.availableBalance,
            b.lockedBalance,
            b.totalWithdrawn,
            b.totalProfits,
            b.availableBalance
        );
    }

    function getEventInfo(address eventContract)
        external
        view
        returns (bool eventEnded, bool emergencyRefund, uint256 totalDeposited)
    {
        eventEnded = IEventTicketInfo(eventContract).eventCompleted();
        emergencyRefund = IEventTicketInfo(eventContract).eventCancelled();
        totalDeposited = eventTotalDeposited[eventContract];
    }

    // ------------------------------------------------------------------
    // Listing key
    // ------------------------------------------------------------------

    function getListingId(address tokenContract, uint256 tokenId) public pure returns (bytes32) {
        return keccak256(abi.encodePacked(tokenContract, tokenId));
    }

    /// @dev Baseline price the +20% cap is measured against: the last secondary
    /// sale, or the original price paid at mint if never resold.
    function _priceCeiling(address tokenContract, uint256 tokenId, bytes32 id) internal view returns (uint256) {
        uint256 baseline = lastSalePrice[id];
        if (baseline == 0) {
            baseline = IEventTicketInfo(tokenContract).getTicketInfo(tokenId).pricePaid;
        }
        if (baseline == 0) return type(uint256).max; // no reference price -> no cap
        return (baseline * MAX_MARKUP_BPS) / BPS;
    }

    // ------------------------------------------------------------------
    // Fixed-price listings
    // ------------------------------------------------------------------

    function listItemFixedPrice(address tokenContract, uint256 tokenId, uint256 price) external nonReentrant {
        require(price > 0, "price=0");
        require(IERC721(tokenContract).ownerOf(tokenId) == msg.sender, "not owner");
        bytes32 id = getListingId(tokenContract, tokenId);
        require(!listings[id].active, "already listed");
        require(price <= _priceCeiling(tokenContract, tokenId, id), "exceeds +20% cap");

        // Escrow the NFT (also enforces VIP holding-period lock in the token).
        IERC721(tokenContract).safeTransferFrom(msg.sender, address(this), tokenId);

        listings[id] = Listing({
            seller: msg.sender,
            tokenContract: tokenContract,
            tokenId: tokenId,
            price: price,
            saleType: SaleType.FIXED_PRICE,
            active: true,
            listedAt: block.timestamp
        });
        emit Listed(id, msg.sender, price, SaleType.FIXED_PRICE);
    }

    function buyItemWithDeposits(address tokenContract, uint256 tokenId) external nonReentrant {
        bytes32 id = getListingId(tokenContract, tokenId);
        Listing storage l = listings[id];
        require(l.active && l.saleType == SaleType.FIXED_PRICE, "not for sale");

        Balance storage buyer = _balances[msg.sender][tokenContract];
        require(buyer.availableBalance >= l.price, "insufficient deposit");

        buyer.availableBalance -= l.price;
        _settleSale(tokenContract, l.seller, l.price);

        l.active = false;
        lastSalePrice[id] = l.price;
        IERC721(tokenContract).safeTransferFrom(address(this), msg.sender, tokenId);
        emit Sold(id, msg.sender, l.price);
    }

    /// @notice Cancel a fixed-price listing and reclaim the NFT.
    function cancelListing(address tokenContract, uint256 tokenId) external nonReentrant {
        bytes32 id = getListingId(tokenContract, tokenId);
        Listing storage l = listings[id];
        require(l.active && l.saleType == SaleType.FIXED_PRICE, "not listed");
        require(l.seller == msg.sender, "not seller");
        l.active = false;
        IERC721(tokenContract).safeTransferFrom(address(this), msg.sender, tokenId);
    }

    // ------------------------------------------------------------------
    // Auctions
    // ------------------------------------------------------------------

    function createAuction(
        address tokenContract,
        uint256 tokenId,
        uint256 startingPrice,
        uint256 reservePrice,
        uint256 duration,
        uint256 minBidIncrement
    ) external nonReentrant {
        require(IERC721(tokenContract).ownerOf(tokenId) == msg.sender, "not owner");
        require(duration > 0, "bad duration");
        bytes32 id = getListingId(tokenContract, tokenId);
        require(!listings[id].active, "already listed");
        require(startingPrice <= _priceCeiling(tokenContract, tokenId, id), "start exceeds +20% cap");

        IERC721(tokenContract).safeTransferFrom(msg.sender, address(this), tokenId);

        listings[id] = Listing({
            seller: msg.sender,
            tokenContract: tokenContract,
            tokenId: tokenId,
            price: startingPrice,
            saleType: SaleType.AUCTION,
            active: true,
            listedAt: block.timestamp
        });
        auctions[id] = Auction({
            startTime: block.timestamp,
            endTime: block.timestamp + duration,
            reservePrice: reservePrice,
            minBidIncrement: minBidIncrement,
            highestBidder: address(0),
            highestBid: 0,
            status: AuctionStatus.ACTIVE,
            extensionCount: 0
        });
        emit AuctionCreated(id, msg.sender, startingPrice, block.timestamp + duration);
    }

    function placeBidWithDeposits(address tokenContract, uint256 tokenId, uint256 bidAmount) external nonReentrant {
        bytes32 id = getListingId(tokenContract, tokenId);
        Listing storage l = listings[id];
        Auction storage a = auctions[id];
        require(l.active && l.saleType == SaleType.AUCTION, "no auction");
        require(a.status == AuctionStatus.ACTIVE && block.timestamp < a.endTime, "auction over");
        require(msg.sender != l.seller, "seller cannot bid");

        uint256 minRequired = a.highestBid == 0 ? l.price : a.highestBid + a.minBidIncrement;
        require(bidAmount >= minRequired, "bid too low");
        require(bidAmount <= _priceCeiling(tokenContract, tokenId, id), "bid exceeds +20% cap");

        Balance storage bidder = _balances[msg.sender][tokenContract];
        require(bidder.availableBalance >= bidAmount, "insufficient deposit");

        // Lock new bid, release the previous highest bidder's lock.
        bidder.availableBalance -= bidAmount;
        bidder.lockedBalance += bidAmount;
        if (a.highestBidder != address(0)) {
            Balance storage prev = _balances[a.highestBidder][tokenContract];
            prev.lockedBalance -= a.highestBid;
            prev.availableBalance += a.highestBid;
        }
        a.highestBidder = msg.sender;
        a.highestBid = bidAmount;

        // Anti-snipe: extend if a bid lands in the final window.
        if (a.endTime - block.timestamp <= EXTENSION_WINDOW) {
            a.endTime += EXTENSION_TIME;
            a.extensionCount += 1;
        }
        emit BidPlaced(id, msg.sender, bidAmount);
    }

    function settleAuction(address tokenContract, uint256 tokenId) external nonReentrant {
        bytes32 id = getListingId(tokenContract, tokenId);
        Listing storage l = listings[id];
        Auction storage a = auctions[id];
        require(l.active && l.saleType == SaleType.AUCTION, "no auction");
        require(a.status == AuctionStatus.ACTIVE, "settled");
        require(block.timestamp >= a.endTime, "not ended");

        l.active = false;
        a.status = AuctionStatus.ENDED;

        bool hasWinner = a.highestBidder != address(0) && a.highestBid >= a.reservePrice;
        if (hasWinner) {
            Balance storage winner = _balances[a.highestBidder][tokenContract];
            winner.lockedBalance -= a.highestBid;
            _settleSale(tokenContract, l.seller, a.highestBid);
            lastSalePrice[id] = a.highestBid;
            IERC721(tokenContract).safeTransferFrom(address(this), a.highestBidder, tokenId);
            emit AuctionSettled(id, a.highestBidder, a.highestBid);
        } else {
            // No qualifying winner: refund the top bidder and return the NFT.
            if (a.highestBidder != address(0)) {
                Balance storage bidder = _balances[a.highestBidder][tokenContract];
                bidder.lockedBalance -= a.highestBid;
                bidder.availableBalance += a.highestBid;
            }
            IERC721(tokenContract).safeTransferFrom(address(this), l.seller, tokenId);
            emit AuctionSettled(id, address(0), 0);
        }
    }

    // ------------------------------------------------------------------
    // Internal settlement (splits proceeds between seller and organizer royalty)
    // ------------------------------------------------------------------

    function _settleSale(address tokenContract, address seller, uint256 price) internal {
        uint256 royalty;
        try IEventTicketInfo(tokenContract).royaltyFeePercentage() returns (uint256 bps) {
            royalty = (price * bps) / BPS;
        } catch {
            royalty = 0;
        }
        uint256 sellerProceeds = price - royalty;

        Balance storage sellerBal = _balances[seller][tokenContract];
        sellerBal.availableBalance += sellerProceeds;
        sellerBal.totalProfits += sellerProceeds;

        if (royalty > 0) {
            address organizer = IEventTicketInfo(tokenContract).eventOrganizer();
            Balance storage orgBal = _balances[organizer][tokenContract];
            orgBal.availableBalance += royalty;
            orgBal.totalProfits += royalty;
        }
    }
}
