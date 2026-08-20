import React, { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useHumanVerification } from "../hooks/useHumanVerification";
import HumanVerification from "./HumanVerification";
import { BrowserProvider, Contract, parseEther } from "ethers";
import EventFactoryAbi from "../abifiles/EventFactory.json";

const EVENT_FACTORY_ADDRESS = "0xYourEventFactoryAddress"; // Replace with your contract

const ExternalEventMint = () => {
  const { state } = useLocation();
  const navigate = useNavigate();
  const eventData = state?.eventData;

  const [selectedTier, setSelectedTier] = useState('general');
  const [quantity, setQuantity] = useState(1);
  const [isProcessing, setIsProcessing] = useState(false);

  const {
    isVerificationOpen,
    requestVerification,
    handleVerified,
    handleClose
  } = useHumanVerification();

  if (!eventData) {
    return (
      <div className="section">
        <div className="error-state">
          <h2>❌ Event Not Found</h2>
          <p>No event data available for minting.</p>
          <button className="btn btn-primary" onClick={() => navigate('/')}>
            🏠 Go Home
          </button>
        </div>
      </div>
    );
  }

  const tiers = {
    general: {
      name: "General Access",
      price: eventData.price ? Math.round(eventData.price * 0.01 * 1e6) / 1e6 : 0.1,
      icon: "🎫",
      description: "Standard event access as NFT ticket"
    },
    premium: {
      name: "Premium NFT",
      price: eventData.price ? Math.round(eventData.price * 0.015 * 1e6) / 1e6 : 0.15,
      icon: "⭐",
      description: "Enhanced NFT with additional metadata"
    },
    collector: {
      name: "Collector's Edition",
      price: eventData.price ? Math.round(eventData.price * 0.02 * 1e6) / 1e6 : 0.2,
      icon: "💎",
      description: "Limited edition NFT with exclusive artwork"
    }
  };

  const handleMintNFT = async () => {
    try {
      const verified = await requestVerification(
        "🎟️ Verify NFT Minting",
        `Mint ${selectedTier} NFT ticket for ${eventData.name}`
      );

      if (verified) {
        setIsProcessing(true);

        if (window.ethereum) {
          const provider = new BrowserProvider(window.ethereum);
          await provider.send("eth_requestAccounts", []);
          const signer = await provider.getSigner();

          const eventFactory = new Contract(EVENT_FACTORY_ADDRESS, EventFactoryAbi, signer);

          const tierData = tiers[selectedTier];
          // v6: parseEther returns bigint
          const mintValue = parseEther((tierData.price * quantity).toString());

          // Prepare struct as array in ethers v6 (parameter order matches ABI exactly!)
          // You MUST match your actual createEvent struct parameter order & nesting!
          // Example ABI:
          // [
          //   string name, string symbol, uint256 maxSupply, ...
          // ]
          const structParams = [
            eventData.name,
            eventData.symbol || "EVT",
            quantity,
            parseEther(tierData.price.toString()),
            eventData.organizerPercentage || 10,
            eventData.royaltyFeePercentage || 5,
            Math.floor(new Date(eventData.date).getTime() / 1000),
            Math.floor(new Date(eventData.date).getTime() / 1000) + 10800,
            1,
            // vipConfig struct
            [
              0, // totalVIPSeats
              0, // vipSeatStart
              0, // vipSeatEnd
              0, // vipHoldingPeriod
              false // vipEnabled
            ],
            // Next fields
            0,       // vipMintPrice
            false,   // waitlistEnabled
            0,       // whitelistSaleDuration
            [],      // initialWhitelist
            eventData.venue || "",
            eventData.description || "",
            0,       // seatCount (could be quantity or match maxSupply as in your factory)
            "",      // vipTokenURIBase
            ""       // nonVipTokenURIBase
          ];

          // The entire struct is the single argument!
          const tx = await eventFactory.createEvent(structParams, { value: mintValue });
          await tx.wait();

          alert(`🎉 Successfully minted ${selectedTier} NFT ticket for ${eventData.name}!`);
          navigate('/profile');
        } else {
          alert("MetaMask is not available. Please install or unlock your wallet.");
        }
      }
    } catch (err) {
      console.error('Minting failed:', err);
      alert("❌ Failed to mint NFT. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const totalPrice = tiers[selectedTier].price * quantity;

  return (
    <>
      <div className="section external-mint-section">
        <h2>{eventData.icon || "🎫"} {eventData.name}</h2>
        <p>{eventData.description}</p>
        <div>
          <strong>Date:</strong> {formatDate(eventData.date)}
        </div>
        <div>
          <strong>Venue:</strong> {eventData.venue}
        </div>
        <hr />
        <div>
          <strong>Select Ticket Type:</strong>
          <div style={{ display: 'flex', gap: '1rem', margin: '1rem 0' }}>
            {Object.entries(tiers).map(([tier, data]) => (
              <button
                key={tier}
                className={`btn ${selectedTier === tier ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setSelectedTier(tier)}
                disabled={isProcessing}
              >
                {data.icon} {data.name} ({data.price} ◎)
              </button>
            ))}
          </div>
        </div>
        <div>
          <label>Quantity:</label>
          <input
            type="number"
            min={1}
            style={{ width: 60, marginLeft: 8, marginRight: 16 }}
            value={quantity}
            onChange={e => setQuantity(Math.max(1, parseInt(e.target.value)))}
            disabled={isProcessing}
          />
        </div>
        <div className="mint-actions" style={{ marginTop: 24 }}>
          <button
            className="btn btn-primary btn-large"
            onClick={handleMintNFT}
            disabled={isProcessing}
          >
            {isProcessing ? "🔄 Minting..." : `🎟️ Mint NFT Ticket (${totalPrice.toFixed(3)} ◎)`}
          </button>
        </div>
      </div>

      <HumanVerification
        isOpen={isVerificationOpen}
        onVerified={handleVerified}
        onClose={handleClose}
      />
    </>
  );
};

export default ExternalEventMint;
