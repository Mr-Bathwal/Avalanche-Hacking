// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice VIP seat configuration for an event.
/// Field order MUST match the tuple the frontend encodes in `createEvent`.
struct VIPConfig {
    uint256 totalVIPSeats;
    uint256 vipSeatStart;
    uint256 vipSeatEnd;
    uint256 vipHoldingPeriod; // seconds a VIP ticket is non-transferable after mint
    bool vipEnabled;
}

/// @notice Parameters for creating an event. The field order and types MUST
/// match the 19-field tuple the frontend passes to `EventFactory.createEvent`.
struct CreateEventParams {
    string name;
    string symbol;
    uint256 maxSupply;
    uint256 baseMintPrice;
    uint256 organizerPercentage;   // basis points (e.g. 7000 = 70%)
    uint256 royaltyFeePercentage;  // basis points (e.g. 500 = 5%)
    uint256 eventStartTime;
    uint256 eventEndTime;
    uint256 maxMints;              // max mints per user
    VIPConfig vipConfig;
    uint256 vipMintPrice;
    bool waitlistEnabled;
    uint256 whitelistDuration;     // seconds the whitelist-only window lasts
    address[] initialWhitelist;
    string venue;
    string description;
    uint256 seatCount;
    string vipTokenURI;            // base URI for VIP ticket metadata
    string nonVipTokenURI;         // base URI for regular ticket metadata
}

/// @notice A minted ticket. Field order MUST match the frontend's
/// `getTicketInfo` / `tickets(tokenId)` tuple.
struct Ticket {
    string eventName;
    uint256 seatNumber;
    bool isVIP;
    uint256 mintedAt;
    uint256 pricePaid;
    bool isUsed;
    bool isTransferable;
    string venue;
}
