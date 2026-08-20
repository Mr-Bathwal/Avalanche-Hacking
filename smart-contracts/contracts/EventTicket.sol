// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC721Enumerable} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import {CreateEventParams, VIPConfig, Ticket} from "./Types.sol";

/// @title EventTicket
/// @notice One ERC-721 collection per event. Tickets carry a seat number, tier
/// (VIP / normal), and venue on-chain. VIP tickets are non-transferable during a
/// configurable holding period to blunt instant scalping.
contract EventTicket is ERC721, ERC721Enumerable, ReentrancyGuard {
    using Strings for uint256;

    // --- Event configuration ---
    address public immutable eventOrganizer;
    uint256 public immutable maxSupply;
    uint256 public immutable baseMintPrice;
    uint256 public immutable vipMintPrice;
    uint256 public immutable organizerPercentage;  // basis points
    uint256 public immutable royaltyFeePercentage; // basis points
    uint256 public immutable eventStartTime;
    uint256 public immutable eventEndTime;
    uint256 public immutable maxMintsPerUser;
    uint256 public immutable seatCount;
    bool public immutable waitlistEnabled;
    uint256 public immutable whitelistEndTime;

    string public venue;
    string public eventDescription;
    string public vipTokenURIBase;
    string public nonVipTokenURIBase;

    VIPConfig public vipConfig;

    // --- Mutable state ---
    bool public eventCancelled;
    bool public eventCompleted;
    uint256 public nextTicketId; // id of the next ticket to mint (starts at 0)

    mapping(uint256 => Ticket) public tickets;      // tokenId => Ticket
    mapping(uint256 => bool) public seatMinted;     // seatNumber => taken
    mapping(address => uint256) public userMintCount;
    mapping(address => bool) public whitelisted;

    event TicketMinted(address indexed to, uint256 indexed tokenId, uint256 seatNumber, bool isVIP);
    event TicketUsed(uint256 indexed tokenId);
    event TicketRefunded(address indexed holder, uint256 indexed tokenId, uint256 amount);
    event EventCancelled();
    event EventCompleted();

    modifier onlyOrganizer() {
        require(msg.sender == eventOrganizer, "not organizer");
        _;
    }

    constructor(CreateEventParams memory p, address organizer)
        ERC721(p.name, p.symbol)
    {
        require(organizer != address(0), "bad organizer");
        require(p.maxSupply > 0, "maxSupply=0");
        require(p.eventEndTime > p.eventStartTime, "bad times");
        require(p.organizerPercentage <= 10000 && p.royaltyFeePercentage <= 10000, "bad bps");

        eventOrganizer = organizer;
        maxSupply = p.maxSupply;
        baseMintPrice = p.baseMintPrice;
        vipMintPrice = p.vipMintPrice;
        organizerPercentage = p.organizerPercentage;
        royaltyFeePercentage = p.royaltyFeePercentage;
        eventStartTime = p.eventStartTime;
        eventEndTime = p.eventEndTime;
        maxMintsPerUser = p.maxMints == 0 ? type(uint256).max : p.maxMints;
        seatCount = p.seatCount == 0 ? p.maxSupply : p.seatCount;
        waitlistEnabled = p.waitlistEnabled;
        whitelistEndTime = block.timestamp + p.whitelistDuration;

        venue = p.venue;
        eventDescription = p.description;
        vipTokenURIBase = p.vipTokenURI;
        nonVipTokenURIBase = p.nonVipTokenURI;
        vipConfig = p.vipConfig;

        for (uint256 i = 0; i < p.initialWhitelist.length; i++) {
            whitelisted[p.initialWhitelist[i]] = true;
        }
    }

    // ------------------------------------------------------------------
    // Minting
    // ------------------------------------------------------------------

    /// @notice Mint a ticket for a specific seat. Pays `getSeatPrice`; excess is refunded.
    function mintTicket(string calldata _eventName, uint256 _seatNumber)
        external
        payable
        nonReentrant
    {
        require(!eventCancelled, "event cancelled");
        require(block.timestamp < eventEndTime, "event ended");
        require(nextTicketId < maxSupply, "sold out");
        require(_seatNumber >= 1 && _seatNumber <= seatCount, "invalid seat");
        require(!seatMinted[_seatNumber], "seat taken");
        require(userMintCount[msg.sender] < maxMintsPerUser, "mint limit reached");

        if (waitlistEnabled && block.timestamp < whitelistEndTime) {
            require(whitelisted[msg.sender], "whitelist only");
        }

        bool isVIP = _isVipSeat(_seatNumber);
        uint256 price = getSeatPrice(_seatNumber, isVIP);
        require(msg.value >= price, "insufficient payment");

        uint256 tokenId = nextTicketId;
        nextTicketId += 1;
        seatMinted[_seatNumber] = true;
        userMintCount[msg.sender] += 1;

        tickets[tokenId] = Ticket({
            eventName: _eventName,
            seatNumber: _seatNumber,
            isVIP: isVIP,
            mintedAt: block.timestamp,
            pricePaid: price,
            isUsed: false,
            isTransferable: true,
            venue: venue
        });

        _safeMint(msg.sender, tokenId);
        emit TicketMinted(msg.sender, tokenId, _seatNumber, isVIP);

        if (msg.value > price) {
            (bool ok, ) = payable(msg.sender).call{value: msg.value - price}("");
            require(ok, "refund excess failed");
        }
    }

    function _isVipSeat(uint256 seatNumber) internal view returns (bool) {
        return
            vipConfig.vipEnabled &&
            seatNumber >= vipConfig.vipSeatStart &&
            seatNumber <= vipConfig.vipSeatEnd;
    }

    // ------------------------------------------------------------------
    // Views
    // ------------------------------------------------------------------

    function getSeatPrice(uint256 seatNumber, bool isVIP) public view returns (uint256) {
        // isVIP is honored if passed; otherwise fall back to seat-based tiering.
        if (isVIP || _isVipSeat(seatNumber)) {
            return vipMintPrice;
        }
        return baseMintPrice;
    }

    function isSeatAvailable(uint256 seatNumber) external view returns (bool) {
        return seatNumber >= 1 && seatNumber <= seatCount && !seatMinted[seatNumber];
    }

    function getTicketInfo(uint256 tokenId) external view returns (Ticket memory) {
        _requireOwned(tokenId);
        return tickets[tokenId];
    }

    function isTicketUsed(uint256 tokenId) external view returns (bool) {
        return tickets[tokenId].isUsed;
    }

    function getEventInfo()
        external
        view
        returns (
            uint256 startTime,
            uint256 endTime,
            string memory venueInfo,
            string memory description,
            bool cancelled,
            bool completed
        )
    {
        return (eventStartTime, eventEndTime, venue, eventDescription, eventCancelled, eventCompleted);
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);
        string memory base = tickets[tokenId].isVIP ? vipTokenURIBase : nonVipTokenURIBase;
        return bytes(base).length == 0 ? "" : string.concat(base, tokenId.toString());
    }

    // ------------------------------------------------------------------
    // Lifecycle
    // ------------------------------------------------------------------

    /// @notice Organizer marks a ticket as used at entry.
    function useTicket(uint256 tokenId) external onlyOrganizer {
        require(_ownerOf(tokenId) != address(0), "no ticket");
        require(!tickets[tokenId].isUsed, "already used");
        tickets[tokenId].isUsed = true;
        emit TicketUsed(tokenId);
    }

    function cancelEvent() external onlyOrganizer {
        eventCancelled = true;
        emit EventCancelled();
    }

    function markEventCompleted() external onlyOrganizer {
        eventCompleted = true;
        emit EventCompleted();
    }

    /// @notice Refund percentage (0–100) for a holder based on timing / cancellation.
    function calculateRefundPercentage(address, uint256 tokenId) public view returns (uint256) {
        if (tickets[tokenId].isUsed) return 0;
        if (eventCancelled) return 100;
        if (block.timestamp >= eventStartTime) return 0;
        uint256 timeLeft = eventStartTime - block.timestamp;
        if (timeLeft >= 7 days) return 90;
        if (timeLeft >= 1 days) return 50;
        return 0;
    }

    /// @notice Burn a ticket and refund the eligible portion of the price paid.
    function refundTicket(uint256 tokenId) external nonReentrant {
        require(ownerOf(tokenId) == msg.sender, "not ticket owner");
        Ticket memory t = tickets[tokenId];
        require(!t.isUsed, "ticket used");

        uint256 pct = calculateRefundPercentage(msg.sender, tokenId);
        uint256 amount = (t.pricePaid * pct) / 100;

        seatMinted[t.seatNumber] = false;
        if (userMintCount[msg.sender] > 0) {
            userMintCount[msg.sender] -= 1;
        }
        _burn(tokenId);
        delete tickets[tokenId];

        if (amount > 0) {
            require(address(this).balance >= amount, "insufficient escrow");
            (bool ok, ) = payable(msg.sender).call{value: amount}("");
            require(ok, "refund failed");
        }
        emit TicketRefunded(msg.sender, tokenId, amount);
    }

    /// @notice Organizer withdraws proceeds not reserved for refunds.
    function withdrawProceeds(uint256 amount) external onlyOrganizer nonReentrant {
        require(amount <= address(this).balance, "too much");
        (bool ok, ) = payable(eventOrganizer).call{value: amount}("");
        require(ok, "withdraw failed");
    }

    // ------------------------------------------------------------------
    // Transfer restrictions + OZ v5 required overrides
    // ------------------------------------------------------------------

    function _update(address to, uint256 tokenId, address auth)
        internal
        override(ERC721, ERC721Enumerable)
        returns (address)
    {
        address from = _ownerOf(tokenId);
        // Restrict only real transfers (not mint or burn).
        if (from != address(0) && to != address(0)) {
            Ticket memory t = tickets[tokenId];
            require(t.isTransferable, "non-transferable");
            if (t.isVIP && vipConfig.vipEnabled) {
                require(
                    block.timestamp >= t.mintedAt + vipConfig.vipHoldingPeriod,
                    "VIP holding period"
                );
            }
        }
        return super._update(to, tokenId, auth);
    }

    function _increaseBalance(address account, uint128 value)
        internal
        override(ERC721, ERC721Enumerable)
    {
        super._increaseBalance(account, value);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, ERC721Enumerable)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    receive() external payable {}
}
