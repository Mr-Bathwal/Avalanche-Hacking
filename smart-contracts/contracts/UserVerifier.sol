// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title UserVerifier
/// @notice On-chain human/identity verification used to gate sensitive actions
/// (minting, listing) and deter bots and bulk-buying. Users can self-verify at
/// the Basic level after passing the off-chain challenge; the owner can grant
/// higher levels or suspend abusive accounts.
contract UserVerifier is Ownable {
    enum Level {
        None,
        Basic,
        Premium,
        VIP,
        Admin
    }

    enum SuspendReason {
        None,
        Fraud,
        Chargeback,
        Abuse,
        Other
    }

    struct Status {
        bool isVerified;
        uint8 level;
        uint256 verifiedAt;
        uint256 expiresAt;
        bool suspended;
        uint256 suspendedUntil;
        uint8 suspendedReason;
    }

    mapping(address => Status) private _status;

    /// @notice How long a verification stays valid (0 = never expires).
    uint256 public verificationValidity = 365 days;

    event UserVerified(address indexed user, uint8 level, uint256 expiresAt);
    event UserSuspended(address indexed user, uint256 until, uint8 reason);
    event UserUnsuspended(address indexed user);

    constructor() Ownable(msg.sender) {}

    /// @notice Verify a user at Basic level. Callable by the user themselves
    /// (after the off-chain challenge) or by the owner.
    function verifyUser(address user) external {
        require(msg.sender == user || msg.sender == owner(), "not authorized");
        _verify(user, uint8(Level.Basic));
    }

    /// @notice Owner-only: verify a user at a specific level.
    function verifyUserWithLevel(address user, uint8 level) external onlyOwner {
        require(level <= uint8(Level.Admin), "bad level");
        _verify(user, level);
    }

    function _verify(address user, uint8 level) internal {
        uint256 expiry = verificationValidity == 0 ? 0 : block.timestamp + verificationValidity;
        _status[user] = Status({
            isVerified: true,
            level: level,
            verifiedAt: block.timestamp,
            expiresAt: expiry,
            suspended: false,
            suspendedUntil: 0,
            suspendedReason: uint8(SuspendReason.None)
        });
        emit UserVerified(user, level, expiry);
    }

    /// @notice Owner-only: suspend a user until `until` for a given reason.
    function suspendUser(address user, uint256 until, uint8 reason) external onlyOwner {
        Status storage s = _status[user];
        s.suspended = true;
        s.suspendedUntil = until;
        s.suspendedReason = reason;
        emit UserSuspended(user, until, reason);
    }

    /// @notice Owner-only: lift a suspension.
    function unsuspendUser(address user) external onlyOwner {
        Status storage s = _status[user];
        s.suspended = false;
        s.suspendedUntil = 0;
        s.suspendedReason = uint8(SuspendReason.None);
        emit UserUnsuspended(user);
    }

    function setVerificationValidity(uint256 seconds_) external onlyOwner {
        verificationValidity = seconds_;
    }

    /// @notice Full status tuple (order matches the frontend's `getUserStatus`).
    function getUserStatus(address user)
        external
        view
        returns (
            bool isVerified,
            uint8 level,
            uint256 verifiedAt,
            uint256 expiresAt,
            bool suspended,
            uint256 suspendedUntil,
            uint8 suspendedReason
        )
    {
        Status memory s = _status[user];
        return (
            s.isVerified,
            s.level,
            s.verifiedAt,
            s.expiresAt,
            s.suspended,
            s.suspendedUntil,
            s.suspendedReason
        );
    }

    /// @notice True if the user is verified, not expired, and not actively suspended.
    function isVerifiedAndActive(address user) public view returns (bool) {
        Status memory s = _status[user];
        if (!s.isVerified) return false;
        if (s.expiresAt != 0 && block.timestamp > s.expiresAt) return false;
        if (s.suspended && block.timestamp < s.suspendedUntil) return false;
        return true;
    }

    /// @notice True if the user is active and at least `minLevel`.
    function hasMinimumLevel(address user, uint8 minLevel) external view returns (bool) {
        return isVerifiedAndActive(user) && _status[user].level >= minLevel;
    }
}
