import React, { useEffect, useState } from "react";
import { BrowserProvider, Contract, formatEther, parseEther } from "ethers";
import {
  CONTRACT_ADDRESSES,
  USER_VERIFICATION_ABI,
  EVENT_FACTORY_ABI,
  TICKET_MARKETPLACE_ABI,
  EVENT_TICKET_ABI,
} from "../lib/contracts";
import { sampleNFTs } from "../utils/sampleAssets";
import Banner3D from "./Banner3D";
import { demoAuctions } from "../utils/demoData";

const EVENT_FACTORY_ADDRESS = CONTRACT_ADDRESSES.EVENT_FACTORY;
const MARKETPLACE_ADDRESS = CONTRACT_ADDRESSES.TICKET_MARKETPLACE;

export default function AuctionChamber() {

  // State
  const [, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [account, setAccount] = useState("");
  const [network, setNetwork] = useState(null);
  const [marketplace, setMarketplace] = useState(null);
  const [eventFactory, setEventFactory] = useState(null);

  const [, setNfts] = useState([]);
  const [auctions, setAuctions] = useState([]);
  const [displayAuctions, setDisplayAuctions] = useState([]);
  const [heldNfts, setHeldNfts] = useState([]);
  const [selectedNft, setSelectedNft] = useState(null);
  const [showSellModal, setShowSellModal] = useState(false);
  const [listingType, setListingType] = useState("fixed");
  const [listPrice, setListPrice] = useState("");
  const [auctionDuration, setAuctionDuration] = useState(7);

  const [selectedAuction, setSelectedAuction] = useState(null);
  const [bidAmount, setBidAmount] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [warnMsg, setWarnMsg] = useState("");

  // Connect wallet and contracts
  async function connectWallet() {
    if (!window.ethereum) {
      alert("MetaMask not found. Please install MetaMask.");
      return;
    }
    try {
      const prov = new BrowserProvider(window.ethereum);
      await prov.send("eth_requestAccounts", []);
      const signer = await prov.getSigner();
      const acct = await signer.getAddress();
      const currentNetwork = await prov.getNetwork();

      // Defensive: log address and network
      console.log("Connected address:", acct);
      console.log("Connected network:", currentNetwork);

      const marketplaceContract = new Contract(
        MARKETPLACE_ADDRESS,
        TICKET_MARKETPLACE_ABI,
        signer
      );
      const eventFactoryContract = new Contract(
        EVENT_FACTORY_ADDRESS,
        EVENT_FACTORY_ABI,
        signer
      );
      setProvider(prov);
      setSigner(signer);
      setAccount(acct);
      setNetwork(currentNetwork?.name || currentNetwork?.chainId || "");
      setMarketplace(marketplaceContract);
      setEventFactory(eventFactoryContract);
      setErrorMsg("");
    } catch (e) {
      console.error("Wallet connection error", e);
      setErrorMsg("Failed to connect wallet.");
    }
  }

  function formatTime(timestamp) {
    if (!timestamp) return "--";
    const date = new Date(Number(timestamp) * 1000);
    return date.toLocaleString();
  }

  // Defensive asset loader
  async function loadUserAssets() {
    if (!eventFactory || !marketplace || !account) {
      setErrorMsg("Contract or wallet not loaded!");
      return;
    }
    setWarnMsg("");
    setErrorMsg("");
    setLoading(true);
    let eventAddresses;
    try {
      // Defensive pre-check - is account a valid Ethereum address?
      if (!/^0x[a-fA-F0-9]{40}$/.test(account)) {
        setErrorMsg("Wallet address invalid! (" + account + ")");
        setLoading(false);
        return;
      }

      // Defensive getAllOrganizerEvents
      console.log("Fetching organizer events for:", account, "via", eventFactory.target);

      // Extra: Check that account is authorized organizer; show a warning if not (but still try the call)
      try {
        const authorized = await eventFactory.authorizedOrganizers(account);
        if (!authorized) setWarnMsg("Warning: This address is NOT an authorized organizer.");
      } catch (e) {
        setWarnMsg("Warning: Could not verify organizer, but continuing...");
      }

      // Defensive: try-catch the fetch!
      try {
        eventAddresses = await eventFactory.getAllOrganizerEvents(account);
        console.log("Fetched events:", eventAddresses);
        if (!eventAddresses || !Array.isArray(eventAddresses)) throw new Error("Result not an array");
      } catch (e) {
        console.error("getAllOrganizerEvents failed:", e);
        setErrorMsg(
          "Failed to fetch organizer events! " +
            (e.reason || e.message || "") +
            " Is your address authorized? Is the contract deployed and ABI correct? Are you on right network?"
        );
        setLoading(false);
        return;
      }

      // Defensive: If no events, clear and exit early
      if (!eventAddresses.length) {
        setHeldNfts([]);
        setNfts([]);
        setAuctions([]);
        setDisplayAuctions([]);
        setWarnMsg("No events found for your account.");
        setLoading(false);
        return;
      }
    } catch (err) {
      setErrorMsg("Failed while reading event addresses: " + (err.message || err));
      setLoading(false);
      return;
    }

    // Load NFTs defensively
    let ownedNfts = [];
    let auctionedNfts = [];
    for (const eventAddress of eventAddresses) {
      try {
        const eventContract = new Contract(eventAddress, EVENT_TICKET_ABI, signer);
        let supply = 0;
        try {
          supply = await eventContract.totalSupply();
          supply = typeof supply === "bigint" ? Number(supply) : parseInt(supply);
        } catch {
          // skip if cannot get supply
          continue;
        }
        for (let idx = 0; idx < supply; idx++) {
          let tokenId = idx;
          try {
            const owner = await eventContract.ownerOf(tokenId);
            if (!owner || String(owner).toLowerCase() !== account.toLowerCase()) continue;

            // Metadata fetch
            let metadata = {};
            try {
              const uri = await eventContract.tokenURI(tokenId);
              const uriFixed = uri.startsWith("ipfs://")
                ? "https://gateway.pinata.cloud/ipfs/" + uri.replace("ipfs://", "")
                : uri;
              metadata = await fetch(uriFixed)
                .then((res) => res.json())
                .catch(() => ({}));
            } catch {
              metadata = {};
            }

            // Auction info
            let auctionInfo = {};
            let isListed = false;
            let currentBid = 0;
            let auctionEnd = 0;
            try {
              const listingId = await marketplace.getListingId(eventAddress, tokenId);
              auctionInfo = await marketplace.auctions(listingId);
              isListed = auctionInfo.status !== undefined && Number(auctionInfo.status) === 0;
              currentBid =
                auctionInfo.highestBid && auctionInfo.highestBid.toString() !== "0"
                  ? Number(formatEther(auctionInfo.highestBid))
                  : 0;
              auctionEnd = auctionInfo.endTime ? Number(auctionInfo.endTime) : 0;
            } catch { /* keep defaults if auction info is unavailable */ }
            const nftObj = {
              id: `${eventAddress}_${tokenId}`,
              eventAddress,
              tokenId: tokenId.toString(),
              name: metadata.name || "NFT",
              image: metadata.image || "",
              tier: metadata.tier || "Normal",
              seat: metadata.seat || `Seat #${tokenId}`,
              listed: isListed,
              currentBid,
              auctionEnd,
              auctionInfo,
            };
            ownedNfts.push(nftObj);
            if (isListed) auctionedNfts.push(nftObj);
          } catch (err) {
            // skip this NFT
            continue;
          }
        }
      } catch (outerErr) {
        // skip this event
        continue;
      }
    }
    setHeldNfts(ownedNfts);
    setNfts(ownedNfts);
    setAuctions(auctionedNfts);
    setDisplayAuctions(auctionedNfts);
    setLoading(false);
  }

  // List NFT (fixed or auction)
  async function listNFT() {
    if (!listPrice || isNaN(listPrice)) {
      setErrorMsg("Invalid price.");
      return;
    }
    setLoading(true);
    setErrorMsg("");
    try {
      if (listingType === "fixed") {
        const tx = await marketplace.listItemFixedPrice(
          selectedNft.eventAddress,
          BigInt(selectedNft.tokenId),
          parseEther(listPrice)
        );
        await tx.wait();
        alert("NFT listed at fixed price");
      } else {
        const durationSec = Number(auctionDuration) * 86400;
        if (durationSec < 3600 || durationSec > 2592000) throw new Error("Duration 1h to 30d.");
        const tx = await marketplace.createAuction(
          selectedNft.eventAddress,
          BigInt(selectedNft.tokenId),
          parseEther(listPrice),
          0, // reserve
          durationSec,
          parseEther("0.01")
        );
        await tx.wait();
        alert("NFT listed for auction!");
      }
      setShowSellModal(false);
      setSelectedNft(null);
      setListPrice("");
      setAuctionDuration(7);
      setListingType("fixed");
      await loadUserAssets();
    } catch (err) {
      setErrorMsg(err.message || "Listing failed.");
    }
    setLoading(false);
  }

  async function placeBid() {
    if (!bidAmount || isNaN(bidAmount)) {
      setErrorMsg("Invalid bid amount.");
      return;
    }
    if (Number(bidAmount) < selectedAuction.currentBid + 0.01) {
      setErrorMsg(
        `Bid must be at least ${(selectedAuction.currentBid + 0.01).toFixed(3)} AVAX`
      );
      return;
    }
    setLoading(true);
    setErrorMsg("");
    try {
      const tx = await marketplace.placeBidWithDeposits(
        selectedAuction.eventAddress,
        BigInt(selectedAuction.tokenId),
        parseEther(bidAmount)
      );
      await tx.wait();
      alert("Your bid was placed!");
      setSelectedAuction(null);
      setBidAmount("");
      await loadUserAssets();
    } catch (err) {
      setErrorMsg(err.message || "Bid failed");
    }
    setLoading(false);
  }


  useEffect(() => {
    connectWallet();
    if (window.ethereum) {
      const reload = () => window.location.reload();
      window.ethereum.on("accountsChanged", reload);
      window.ethereum.on("chainChanged", reload);
      return () => {
        window.ethereum.removeListener("accountsChanged", reload);
        window.ethereum.removeListener("chainChanged", reload);
      };
    }
  }, []);

  useEffect(() => {
    if (eventFactory && marketplace && account) {
      loadUserAssets();
    }
    // eslint-disable-next-line
  }, [eventFactory, marketplace, account]);

  useEffect(() => {
    if (!auctions) return;
    switch (activeFilter) {
      case "ending":
        setDisplayAuctions(
          auctions.filter(
            (a) =>
              a.auctionEnd &&
              a.auctionEnd * 1000 - Date.now() < 3600000
          )
        );
        break;
      case "vip":
        setDisplayAuctions(auctions.filter((a) => a.tier && a.tier.toLowerCase() === "vip"));
        break;
      case "popular":
        setDisplayAuctions([...auctions].sort((a, b) => b.currentBid - a.currentBid));
        break;
      default:
        setDisplayAuctions(auctions);
        break;
    }
  }, [activeFilter, auctions]);

  // Recruiter-friendly demo when no wallet is connected
  if (!account) {
    return (
      <div className="sc-wrap">
        <Banner3D
          kicker="Live bidding"
          title="Auction Chamber"
          subtitle="Bid on rare tickets — anti-snipe auctions with reserve prices, settled in escrow."
        />
        <div className="sc-demo">✦ <b>Demo preview</b> — connect a wallet to place real bids.</div>
        <div className="sc-grid">
          {demoAuctions.map((a) => (
            <div className="sc-card" key={a.id}>
              <div className="sc-card-media" style={{ backgroundImage: `url(${a.image})` }}>
                <span className="sc-card-tag">⏱ {a.endsIn}</span>
              </div>
              <div className="sc-card-body">
                <h3>{a.event}</h3>
                <p className="sc-card-sub">Seat {a.seat} · {a.bids} bids · reserve {a.reserve} AVAX</p>
                <div className="sc-card-foot">
                  <span className="sc-price">{a.currentBid} AVAX</span>
                  <button className="sc-btn primary">Place bid</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: 20, fontFamily: "Arial, sans-serif" }}>
      <h1>Your Auction Chamber</h1>
      {warnMsg && <div style={{ color: "#cc7e00", marginBottom: 10 }}>{warnMsg}</div>}
      {errorMsg && <div style={{ color: "red", marginBottom: 10 }}>{errorMsg}</div>}
      {loading && <div>Loading...</div>}
      <div style={{marginBottom: 7, color: "#333"}}>Address: <small>{account}</small> &nbsp;|&nbsp; Network: <small>{network}</small></div>
      <div style={{ marginBottom: 16, display:'flex', gap:8 }}>
        <button className="btn" onClick={() => setActiveFilter("all")} disabled={activeFilter === "all"}>
          All
        </button>
        <button className="btn" onClick={() => setActiveFilter("ending")} disabled={activeFilter === "ending"}>
          Ending Soon
        </button>
        <button className="btn" onClick={() => setActiveFilter("popular")} disabled={activeFilter === "popular"}>
          Popular
        </button>
        <button className="btn" onClick={() => setActiveFilter("vip")} disabled={activeFilter === "vip"}>
          VIP
        </button>
      </div>
      <ul style={{ listStyle: "none", padding: 0 }}>
        {displayAuctions.length === 0 && (
          <>
            <li>No auctions found for selected filter.</li>
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit, minmax(240px,1fr))',gap:12, marginTop:12}}>
{sampleNFTs.map(s => (
                <div key={s.id} className="ticket-card">
                  <img src={s.image} alt={s.name} style={{width:'100%',borderRadius:10,marginBottom:8}} />
                  <div className="title">{s.name}</div>
                  <div className="meta">{s.tier} • {s.venue}</div>
                  <div style={{display:'flex',gap:8}}>
                    <button className="btn">View</button>
                    <button className="btn btn-primary">Pre-bid</button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
        {displayAuctions.map((a) => (
          <li
            key={a.id}
            style={{
              border: "1px solid #bababa",
              borderRadius: 8,
              padding: 12,
              marginBottom: 14,
              cursor: "pointer",
              display: "flex",
              alignItems: "center"
            }}
            onClick={() => setSelectedAuction(a)}
          >
            <img
              src={a.image || "/default-nft.png"}
              alt={a.name}
              width={68}
              height={68}
              style={{ objectFit: "cover", borderRadius: 8, marginRight: 16 }}
            />
            <div>
              <b>{a.name}</b> (Token #{a.tokenId})<br />
              Seat: {a.seat} <br />
              Tier: {a.tier} <br />
              Current Bid: {a.currentBid?.toFixed(3) ?? "0"} AVAX <br />
              Auction Ends: {formatTime(a.auctionEnd)}
            </div>
          </li>
        ))}
      </ul>
      {selectedAuction && (
        <div style={modalStyle}>
          <h2>
            Place Bid for {selectedAuction.name} (Token #{selectedAuction.tokenId})
          </h2>
          <input
            type="number"
            step="0.01"
            min={selectedAuction.currentBid + 0.01}
            value={bidAmount}
            onChange={(e) => setBidAmount(e.target.value)}
            disabled={loading}
            style={inputStyle}
          />
          <div style={{ color: "red", marginBottom: 10 }}>{errorMsg}</div>
          <button
            onClick={placeBid}
            disabled={loading}
            style={buttonStyle}
          >
            {loading ? "Processing..." : "Place Bid"}
          </button>
          <button
            onClick={() => {
              setSelectedAuction(null);
              setBidAmount("");
              setErrorMsg("");
            }}
            style={{ ...buttonStyle, marginLeft: 10, background: "#aaa", color: "#222" }}
          >
            Cancel
          </button>
        </div>
      )}
      {showSellModal && selectedNft && (
        <div style={modalStyle}>
          <h2>
            List NFT for {selectedNft.name} (Token #{selectedNft.tokenId})
          </h2>
          <input
            type="number"
            step="0.01"
            placeholder="Price in AVAX"
            value={listPrice}
            onChange={(e) => setListPrice(e.target.value)}
            disabled={loading}
            style={inputStyle}
          />
          <div style={{ marginBottom: 10 }}>
            <label>
              <input
                type="radio"
                checked={listingType === "fixed"}
                onChange={() => setListingType("fixed")}
                disabled={loading}
              />
              Fixed Price
            </label>
            <label style={{ marginLeft: 10 }}>
              <input
                type="radio"
                checked={listingType === "auction"}
                onChange={() => setListingType("auction")}
                disabled={loading}
              />
              Auction
            </label>
          </div>
          {listingType === "auction" && (
            <input
              type="number"
              min={1}
              max={30}
              placeholder="Duration (days)"
              value={auctionDuration}
              onChange={(e) => setAuctionDuration(e.target.value)}
              disabled={loading}
              style={inputStyle}
            />
          )}
          <div style={{ color: "red", marginBottom: 10 }}>{errorMsg}</div>
          <button
            onClick={listNFT}
            disabled={loading}
            style={buttonStyle}
          >
            {loading ? "Processing..." : "List NFT"}
          </button>
          <button
            onClick={() => {
              setShowSellModal(false);
              setSelectedNft(null);
              setListPrice("");
              setAuctionDuration(7);
              setListingType("fixed");
              setErrorMsg("");
            }}
            style={{ ...buttonStyle, marginLeft: 10, background: "#aaa", color: "#222" }}
          >
            Cancel
          </button>
        </div>
      )}
      <h2>Your NFTs</h2>
      {heldNfts.length === 0 ? (
        <p>No owned NFTs found.</p>
      ) : (
        <ul style={{ maxHeight: 210, overflowY: "auto" }}>
          {heldNfts.map((nft) => (
            <li
              key={nft.id}
              onClick={() => {
                setSelectedNft(nft);
                setShowSellModal(true);
                setErrorMsg("");
                setListPrice("");
              }}
              style={{ cursor: "pointer", borderBottom: "1px solid #eee", padding: 6 }}
            >
              {nft.name} Token #{nft.tokenId}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const modalStyle = {
  backgroundColor: "#fff",
  padding: 20,
  position: "fixed",
  top: "50%",
  left: "50%",
  transform: "translate(-50%, -50%)",
  borderRadius: 8,
  boxShadow: "0 0 10px rgba(0,0,0,0.25)",
  zIndex: 1001,
  maxWidth: 390,
  width: "95%",
};
const inputStyle = {
  width: "100%",
  padding: 8,
  marginBottom: 10,
  fontSize: 16,
  borderRadius: 4,
  border: "1px solid #bbb",
};
const buttonStyle = {
  padding: "8px 16px",
  fontSize: 16,
  borderRadius: 4,
  border: "none",
  backgroundColor: "#007bff",
  color: "white",
  cursor: "pointer",
};
