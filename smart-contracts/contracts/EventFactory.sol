// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {EventTicket} from "./EventTicket.sol";
import {CreateEventParams} from "./Types.sol";

/// @title EventFactory
/// @notice Deploys a dedicated `EventTicket` (ERC-721) contract per event and
/// keeps a registry of every deployed event and each organizer's events.
contract EventFactory is Ownable {
    struct EventMetrics {
        uint256 createdAt;
        uint256 totalMinted; // optional, updated off-chain/by future hooks
        uint256 totalVolume;
    }

    /// @notice Fee (in wei) to create an event. Waived for authorized organizers.
    uint256 public eventCreationFee;

    /// @notice Optional reference to the on-chain verifier (may be address(0)).
    address public userVerifier;

    mapping(address => bool) public authorizedOrganizers;
    mapping(address => EventMetrics) public eventMetrics;

    address[] private _deployedEvents;
    mapping(address => address[]) private _organizerEvents;

    event EventCreated(address indexed organizer, address indexed eventContract);
    event OrganizerAuthorized(address indexed organizer);
    event EventCreationFeeUpdated(uint256 newFee);

    constructor(uint256 _eventCreationFee, address _userVerifier) Ownable(msg.sender) {
        eventCreationFee = _eventCreationFee;
        userVerifier = _userVerifier;
    }

    /// @notice Deploy a new event. The tuple order/types match the frontend.
    function createEvent(CreateEventParams calldata p) external payable returns (address deployed) {
        if (!authorizedOrganizers[msg.sender]) {
            require(msg.value >= eventCreationFee, "creation fee required");
        }

        EventTicket ev = new EventTicket(p, msg.sender);
        deployed = address(ev);

        _deployedEvents.push(deployed);
        _organizerEvents[msg.sender].push(deployed);
        eventMetrics[deployed] = EventMetrics({createdAt: block.timestamp, totalMinted: 0, totalVolume: 0});

        emit EventCreated(msg.sender, deployed);
    }

    // --- Registry views (both names kept for frontend compatibility) ---

    function getAllDeployedEvents() external view returns (address[] memory) {
        return _deployedEvents;
    }

    function getAllDeployed() external view returns (address[] memory) {
        return _deployedEvents;
    }

    function getAllOrganizerEvents(address organizer) external view returns (address[] memory) {
        return _organizerEvents[organizer];
    }

    function getTotalEventsCreated() external view returns (uint256) {
        return _deployedEvents.length;
    }

    // --- Organizer onboarding ---

    /// @notice Testnet convenience: self-authorize so you can create events fee-free.
    function requestFaucet() external {
        authorizedOrganizers[msg.sender] = true;
        emit OrganizerAuthorized(msg.sender);
    }

    // --- Admin ---

    function setAuthorizedOrganizer(address organizer, bool allowed) external onlyOwner {
        authorizedOrganizers[organizer] = allowed;
    }

    function setEventCreationFee(uint256 newFee) external onlyOwner {
        eventCreationFee = newFee;
        emit EventCreationFeeUpdated(newFee);
    }

    function setUserVerifier(address verifier) external onlyOwner {
        userVerifier = verifier;
    }

    function withdraw() external onlyOwner {
        (bool ok, ) = payable(owner()).call{value: address(this).balance}("");
        require(ok, "withdraw failed");
    }
}
