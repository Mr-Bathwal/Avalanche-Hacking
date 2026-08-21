import React, { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { BrowserProvider, Contract, parseEther, formatEther } from 'ethers';
import { toast } from 'sonner';
import { 
  CONTRACT_ADDRESSES, 
  EVENT_FACTORY_ABI, 
  EVENT_TICKET_ABI, 
  TICKET_MARKETPLACE_ABI
} from '../lib/contracts';
import { sampleNFTs } from '../utils/sampleAssets';
import Banner3D from './Banner3D';
import { demoListings } from '../utils/demoData';

export default function EventMarketplace() {
  const { address, isConnected } = useAccount();
  const [marketplaceItems, setMarketplaceItems] = useState([]);
  const [userNFTs, setUserNFTs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('marketplace'); // 'marketplace' or 'mynfts'
  const [filters] = useState({
    eventType: 'all',
    priceRange: 'all',
    saleType: 'all',
  });

  useEffect(() => {
    if (isConnected) {
      fetchMarketplaceItems();
      fetchUserNFTs();
    }
    // eslint-disable-next-line
  }, [isConnected]);

  const fetchMarketplaceItems = async () => {
    setLoading(true);
    try {
      const provider = new BrowserProvider(window.ethereum);
      const eventFactory = new Contract(
        CONTRACT_ADDRESSES.EVENT_FACTORY,
        EVENT_FACTORY_ABI,
        provider
      );
      const marketplace = new Contract(
        CONTRACT_ADDRESSES.TICKET_MARKETPLACE,
        TICKET_MARKETPLACE_ABI,
        provider
      );

      const eventAddresses = await eventFactory.getAllDeployedEvents();
      const itemsData = [];

      for (const eventAddress of eventAddresses) {
        try {
          const eventContract = new Contract(eventAddress, EVENT_TICKET_ABI, provider);
          const totalSupply = await eventContract.nextTicketId();
          const venue = await eventContract.venue();
          const startTime = await eventContract.eventStartTime();

          for (let tokenId = 0; tokenId < Number(totalSupply); tokenId++) {
            try {
              const listingId = await marketplace.getListingId(eventAddress, tokenId);
              const listing = await marketplace.listings(listingId);

              if (listing.active) {
                const ticketInfo = await eventContract.getTicketInfo(tokenId);
                const tokenURI = await eventContract.tokenURI(tokenId);

                let metadata = {};
                try {
                  const response = await fetch(tokenURI);
                  metadata = await response.json();
                } catch { /* metadata unavailable — leave empty */ }

                itemsData.push({
                  eventAddress,
                  tokenId,
                  listing,
                  ticketInfo,
                  metadata,
                  venue,
                  startTime: new Date(Number(startTime) * 1000),
                  price: formatEther(listing.price),
                  saleType: Number(listing.saleType), // 0 = FIXED_PRICE, 1 = AUCTION
                });
              }
            } catch {
              // no active listing for this token — skip
            }
          }
        } catch (err) {
          console.error('Error fetching marketplace items for event:', eventAddress, err);
        }
      }
      setMarketplaceItems(itemsData);
    } catch (error) {
      console.error('Error fetching marketplace items:', error);
    }
    setLoading(false);
  };

  const fetchUserNFTs = async () => {
    if (!address) return;
    try {
      const provider = new BrowserProvider(window.ethereum);
      const eventFactory = new Contract(
        CONTRACT_ADDRESSES.EVENT_FACTORY,
        EVENT_FACTORY_ABI,
        provider
      );

      const eventAddresses = await eventFactory.getAllDeployedEvents();
      const userNFTData = [];

      for (const eventAddress of eventAddresses) {
        try {
          const eventContract = new Contract(eventAddress, EVENT_TICKET_ABI, provider);
          const balance = await eventContract.balanceOf(address);
          const venue = await eventContract.venue();

          if (Number(balance) > 0) {
            for (let i = 0; i < Number(balance); i++) {
              const tokenId = await eventContract.tokenOfOwnerByIndex(address, i);
              const ticketInfo = await eventContract.getTicketInfo(tokenId);
              const isUsed = await eventContract.isTicketUsed(tokenId);
              const tokenURI = await eventContract.tokenURI(tokenId);

              let metadata = {};
              try {
                const response = await fetch(tokenURI);
                metadata = await response.json();
              } catch { /* metadata unavailable — leave empty */ }

              userNFTData.push({
                eventAddress,
                tokenId: Number(tokenId),
                ticketInfo,
                metadata,
                venue,
                isUsed,
                isListed: false, // Will check this below
              });
            }
          }
        } catch (err) {
          console.error('Error fetching user NFTs for event:', eventAddress, err);
        }
      }

      setUserNFTs(userNFTData);
    } catch (error) {
      console.error('Error fetching user NFTs:', error);
    }
  };

  const buyItem = async (item) => {
    setLoading(true);
    try {
      const provider = new BrowserProvider(window.ethereum);
      await provider.send('eth_requestAccounts', []);
      const signer = await provider.getSigner();
      const marketplace = new Contract(
        CONTRACT_ADDRESSES.TICKET_MARKETPLACE,
        TICKET_MARKETPLACE_ABI,
        signer
      );

      if (item.saleType === 0) { // Fixed price
        const tx = await marketplace.buyItemWithDeposits(item.eventAddress, item.tokenId);
        await tx.wait();
        toast.success('Ticket purchased successfully!');
      } else { // Auction
        toast.info('This is an auction item. Use the Auction Chamber to bid.');
      }

      fetchMarketplaceItems();
      fetchUserNFTs();
    } catch (error) {
      console.error('Error buying item:', error);
      toast.error('Failed to purchase ticket');
    }
    setLoading(false);
  };

  const listItem = async (nft, price, _saleType = 0) => {
    setLoading(true);
    try {
      const provider = new BrowserProvider(window.ethereum);
      await provider.send('eth_requestAccounts', []);
      const signer = await provider.getSigner();
      const eventContract = new Contract(nft.eventAddress, EVENT_TICKET_ABI, signer);
      const marketplace = new Contract(
        CONTRACT_ADDRESSES.TICKET_MARKETPLACE,
        TICKET_MARKETPLACE_ABI,
        signer
      );

      // Anti-inflation: cap at +20% over previous price if metadata.lastSale present
      try {
        if (nft.metadata?.attributes) {
          const lastSaleAttr = nft.metadata.attributes.find(a => String(a.trait_type).toLowerCase() === 'last_sale');
          if (lastSaleAttr && lastSaleAttr.value) {
            const last = parseFloat(lastSaleAttr.value);
            const maxAllowed = last * 1.2;
            if (parseFloat(price) > maxAllowed) {
              toast.error(`Listing exceeds +20% cap. Max allowed: ${maxAllowed.toFixed(4)} AVAX`);
              setLoading(false);
              return;
            }
          }
        }
      } catch { /* price-cap check is best-effort */ }

      // First approve marketplace to handle the NFT
      const isApproved = await eventContract.isApprovedForAll(address, CONTRACT_ADDRESSES.TICKET_MARKETPLACE);
      if (!isApproved) {
        const approveTx = await eventContract.setApprovalForAll(CONTRACT_ADDRESSES.TICKET_MARKETPLACE, true);
        await approveTx.wait();
        toast.success('NFT approved for marketplace');
      }

      // List the item
      const priceWei = parseEther(price);
      const tx = await marketplace.listItemFixedPrice(nft.eventAddress, nft.tokenId, priceWei);
      await tx.wait();
      toast.success('Item listed successfully!');

      fetchMarketplaceItems();
      fetchUserNFTs();
    } catch (error) {
      console.error('Error listing item:', error);
      toast.error('Failed to list item');
    }
    setLoading(false);
  };

  const filteredItems = marketplaceItems.filter(item => {
    if (filters.saleType !== 'all' && item.saleType !== parseInt(filters.saleType)) return false;
    if (filters.priceRange !== 'all') {
      const price = parseFloat(item.price);
      if (filters.priceRange === 'low' && price >= 1) return false;
      if (filters.priceRange === 'medium' && (price < 1 || price >= 5)) return false;
      if (filters.priceRange === 'high' && price < 5) return false;
    }
    return true;
  });

  // Recruiter-friendly demo when no wallet is connected
  if (!isConnected) {
    return (
      <div className="sc-wrap">
        <Banner3D
          kicker="Secondary market"
          title="Ticket Marketplace"
          subtitle="Buy & resell NFT tickets — resale is capped at +20% over the last sale price, on-chain."
        />
        <div className="sc-demo">✦ <b>Demo preview</b> — connect a wallet to trade live listings.</div>
        <div className="sc-grid">
          {demoListings.map((l) => (
            <div className="sc-card" key={l.id}>
              <div className="sc-card-media" style={{ backgroundImage: `url(${l.image})` }}>
                <span className="sc-card-tag">Seat {l.seat}</span>
              </div>
              <div className="sc-card-body">
                <h3>{l.event}</h3>
                <p className="sc-card-sub">
                  <span className={`sc-badge ${l.tier === 'VIP' ? 'vip' : 'normal'}`}>{l.tier}</span>
                  {l.capped && <span className="sc-badge capped" style={{ marginLeft: 6 }}>+20% cap</span>}
                </p>
                <div className="sc-card-foot">
                  <span className="sc-price"><small>{l.lastPrice}</small>{l.price} AVAX</span>
                  <button className="sc-btn primary">Buy</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="marketplace-container">
      {/* Tab Navigation */}
      <div className="tab-navigation">
        <button 
          className={`tab-btn ${activeTab === 'marketplace' ? 'active' : ''}`}
          onClick={() => setActiveTab('marketplace')}
        >
          Marketplace
        </button>
        <button 
          className={`tab-btn ${activeTab === 'mynfts' ? 'active' : ''}`}
          onClick={() => setActiveTab('mynfts')}
        >
          My NFTs
        </button>
      </div>

      {activeTab === 'marketplace' ? (
        <div className="listings-grid">
          {loading && (
            Array.from({length:6}).map((_,i)=> <div key={i} className="card skeleton skeleton-img" />)
          )}
          {!loading && filteredItems.length === 0 && (
            <div className="card">
              <div className="form-header">
                <h3>No listings found</h3>
                <p>Here are some trending tickets you might like</p>
              </div>
              <TrendingSamples />
            </div>
          )}
          {!loading && filteredItems.map((item)=> (
            <div key={`${item.eventAddress}-${item.tokenId}`} className="ticket-card">
              <img src={item.metadata?.image || 'https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=600'} alt="NFT" style={{width:'100%',borderRadius:10,marginBottom:8}} />
              <div className="title">{item.metadata?.name || `Ticket #${item.tokenId}`}</div>
              <div className="meta">{item.ticketInfo?.isVIP ? 'VIP' : 'Normal'} • {item.venue}</div>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <span>{item.price} AVAX</span>
                <button className="btn btn-primary" onClick={()=>buyItem(item)}>Buy</button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="listings-grid">
          {loading && (
            Array.from({length:6}).map((_,i)=> <div key={i} className="card skeleton skeleton-img" />)
          )}
          {!loading && userNFTs.length === 0 && (
            <div className="card">
              <div className="form-header">
                <h3>You don’t own any tickets yet</h3>
                <p>Discover a few curated NFTs below</p>
              </div>
              <TrendingSamples />
            </div>
          )}
          {!loading && userNFTs.map((nft)=> (
            <div key={`${nft.eventAddress}-${nft.tokenId}`} className="ticket-card">
              <img src={nft.metadata?.image || 'https://images.unsplash.com/photo-1506157786151-b8491531f063?w=600'} alt="NFT" style={{width:'100%',borderRadius:10,marginBottom:8}} />
              <div className="title">{nft.metadata?.name || `Ticket #${nft.tokenId}`}</div>
              <div className="meta">{nft.ticketInfo?.isVIP ? 'VIP' : 'Normal'} • {nft.venue}</div>
              <div className="form-row">
                <button className="btn" onClick={()=>listItem(nft, '0.25', 0)}>List at 0.25</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  function TrendingSamples() {
    return (
      <div className="listings-grid">
        {sampleNFTs.map((s)=> (
          <div key={s.id} className="ticket-card">
            <img src={s.image} alt={s.name} style={{width:'100%',borderRadius:10,marginBottom:8}} />
            <div className="title">{s.name}</div>
            <div className="meta">{s.tier} • {s.venue}</div>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <span>{s.price} AVAX</span>
              <button className="btn">View</button>
            </div>
          </div>
        ))}
      </div>
    );
  }
}

// MarketplaceItemCard and UserNFTCard remain the same as your existing implementation, just ensure they’re below this export.

