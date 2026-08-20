import React, { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import { BrowserProvider, Contract, formatEther } from "ethers";
import { Link } from "react-router-dom";
import {
  CONTRACT_ADDRESSES,
  EVENT_FACTORY_ABI,
  EVENT_TICKET_ABI,
  TICKET_MARKETPLACE_ABI,
  USER_VERIFICATION_ABI,
} from "../lib/contracts";
import { sampleNFTs as curatedSamples } from "../utils/sampleAssets";

export default function Dashboard() {
  const { address, isConnected } = useAccount();

  const [userStats, setUserStats] = useState({
    totalEvents: 0,
    totalTickets: 0,
    totalRevenue: "0",
    verificationStatus: null,
    walletAVAX: "0",
  });

  const [userEvents, setUserEvents] = useState([]);
  const [userTickets, setUserTickets] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isConnected && address) {
      fetchDashboardData();
    } else {
      setUserEvents([]);
      setUserTickets([]);
      setUserStats({
        totalEvents: 0,
        totalTickets: 0,
        totalRevenue: "0",
        verificationStatus: null,
        walletAVAX: "0",
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected, address]);

  async function fetchDashboardData() {
    setLoading(true);
    try {
      const provider = new BrowserProvider(window.ethereum);
      await Promise.all([
        fetchVerificationStatus(provider),
        fetchUserEvents(provider),
        fetchUserTickets(provider),
        fetchMarketplaceBalance(provider),
        fetchWalletBalance(provider),
      ]);
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    }
    setLoading(false);
  }

  // FIXED: Use correct ABI for user verification
  async function fetchVerificationStatus(provider) {
    try {
      const verifier = new Contract(
        CONTRACT_ADDRESSES.USER_VERIFIER,
        USER_VERIFICATION_ABI,  // Fixed: Use correct ABI
        provider
      );
      const status = await verifier.getUserStatus(address);
      setUserStats((prev) => ({
        ...prev,
        verificationStatus: {
          isVerified: status[0],
          level: Number(status[1]),
          verifiedAt: new Date(Number(status[2]) * 1000),
          expiresAt: new Date(Number(status[3]) * 1000),
          suspended: status[4],
        },
      }));
    } catch (error) {
      console.error("Error fetching verification status:", error);
    }
  }

  async function fetchUserEvents(provider) {
    try {
      const factory = new Contract(
        CONTRACT_ADDRESSES.EVENT_FACTORY,
        EVENT_FACTORY_ABI,
        provider
      );
      const organizerEvents = await factory.getAllOrganizerEvents(address);

      const events = await Promise.all(
        organizerEvents.map(async (addr) => {
          try {
            const eventContract = new Contract(addr, EVENT_TICKET_ABI, provider); // Fixed: Use correct ABI
            const venue = await eventContract.venue();
            const description = await eventContract.eventDescription();
            const startTime = await eventContract.eventStartTime();
            const totalSupply = await eventContract.maxSupply();
            const minted = await eventContract.nextTicketId();
            return {
              address: addr,
              venue,
              description,
              startTime: new Date(Number(startTime) * 1000),
              totalSupply: Number(totalSupply),
              minted: Number(minted),
            };
          } catch (error) {
            console.error("Error fetching event:", error);
            return null;
          }
        })
      );
      setUserEvents(events.filter(Boolean));
      setUserStats((prev) => ({ ...prev, totalEvents: events.filter(Boolean).length }));
    } catch (err) {
      console.error("Error fetching user events:", err);
    }
  }

  async function fetchUserTickets(provider) {
    try {
      const factory = new Contract(
        CONTRACT_ADDRESSES.EVENT_FACTORY,
        EVENT_FACTORY_ABI,
        provider
      );
      const allEvents = await factory.getAllDeployedEvents();
      
      const tickets = [];
      for (const eventAddr of allEvents) {
        try {
          const eventContract = new Contract(eventAddr, EVENT_TICKET_ABI, provider); // Fixed: Use correct ABI
          const balance = await eventContract.balanceOf(address);
          
          for (let i = 0; i < Number(balance); i++) {
            const tokenId = await eventContract.tokenOfOwnerByIndex(address, i);
            const ticketInfo = await eventContract.tickets(tokenId);
            const venue = await eventContract.venue();
            const startTime = await eventContract.eventStartTime();
            
            tickets.push({
              eventAddress: eventAddr,
              tokenId: Number(tokenId),
              ticketInfo: {
                seatNumber: Number(ticketInfo.seatNumber),
                isVIP: ticketInfo.isVIP,
                used: ticketInfo.isUsed,
              },
              venue,
              startTime: new Date(Number(startTime) * 1000),
            });
          }
        } catch (error) {
          continue;
        }
      }
      setUserTickets(tickets);
      setUserStats((prev) => ({ ...prev, totalTickets: tickets.length }));
    } catch (err) {
      console.error("Error fetching user tickets:", err);
    }
  }

  async function fetchMarketplaceBalance(provider) {
    try {
      const marketplace = new Contract(
        CONTRACT_ADDRESSES.TICKET_MARKETPLACE,
        TICKET_MARKETPLACE_ABI, // Fixed: Use correct ABI
        provider
      );
      let totalRevenue = 0n;
      for (const event of userEvents) {
        try {
          const balance = await marketplace.getUserBalance(address, event.address);
          totalRevenue += BigInt(balance[4]); // total profits
        } catch (error) {
          continue;
        }
      }
      setUserStats((prev) => ({ ...prev, totalRevenue: formatEther(totalRevenue) }));
    } catch (error) {
      console.error("Error fetching marketplace balance:", error);
    }
  }

  async function fetchWalletBalance(provider) {
    try {
      const balance = await provider.getBalance(address);
      setUserStats((prev) => ({
        ...prev,
        walletAVAX: formatEther(balance),
      }));
    } catch (error) {
      setUserStats((prev) => ({
        ...prev,
        walletAVAX: "0",
      }));
    }
  }

  function verificationName(level) {
    const levels = ["None", "Basic", "Premium", "VIP", "Admin"];
    return levels[level] || "Unknown";
  }

  // Hardcoded sample data for graphs and NFTs
  const sampleNFTs = [
    { id: 1, name: "Concert Hall VIP", image: "🎭", price: "2.5 AVAX", rarity: "Legendary" },
    { id: 2, name: "Sports Arena Premium", image: "⚽", price: "1.8 AVAX", rarity: "Epic" },
    { id: 3, name: "Theater Front Row", image: "🎪", price: "3.2 AVAX", rarity: "Rare" },
    { id: 4, name: "Festival VIP Pass", image: "🎵", price: "4.1 AVAX", rarity: "Legendary" },
    { id: 5, name: "Art Gallery Opening", image: "🎨", price: "1.5 AVAX", rarity: "Common" },
  ];

  const trendingEvents = [
    { name: "Crypto Conference 2025", volume: "125.4 AVAX", change: "+15.2%", trend: "🔥" },
    { name: "Music Festival", volume: "89.7 AVAX", change: "+8.5%", trend: "📈" },
    { name: "Art Exhibition", volume: "67.3 AVAX", change: "-2.1%", trend: "📉" },
    { name: "Sports Championship", volume: "234.8 AVAX", change: "+25.7%", trend: "🚀" },
  ];

  if (!isConnected) {
    return (
      <div className="app-container">
        <div className="main-content">
          <div className="hero-collection">
            <div className="hero-content">
              <h2>Please connect your wallet</h2>
              <p>Connect to view your dashboard and start exploring TicketVerse</p>
              <button className="connect-wallet-btn">Connect Wallet</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      <div className="main-content">
        {/* Header */}
        <header className="header">
          <div className="search-container">
            <span className="search-icon">🔍</span>
            <input type="text" className="search-input" placeholder="Search events, tickets..." />
          </div>
          <div className="header-actions">
            <div className="wallet-info">
              <span>{Number(userStats.walletAVAX).toFixed(4)} AVAX</span>
            </div>
          </div>
        </header>

        <div className="content-layout">
          <div className="main-panel">
            {/* Hero Collection - Dashboard Stats */}
            <div className="hero-collection">
              <div className="hero-content">
                <div className="collection-header">
                  <div className="collection-avatar" style={{background: 'linear-gradient(135deg, #667eea, #764ba2)'}}></div>
                  <div className="collection-info">
                    <h1>
                      Dashboard
                      <span className="verified-badge">✓</span>
                    </h1>
                    <p className="collection-by">Welcome back, {address?.slice(0, 6)}...{address?.slice(-4)}</p>
                  </div>
                </div>
                <div className="collection-stats">
                  <div className="stat-item">
                    <div className="stat-label">My Events</div>
                    <div className="stat-value">{userStats.totalEvents}</div>
                  </div>
                  <div className="stat-item">
                    <div className="stat-label">My Tickets</div>
                    <div className="stat-value">{userStats.totalTickets}</div>
                  </div>
                  <div className="stat-item">
                    <div className="stat-label">Revenue</div>
                    <div className="stat-value eth">{Number(userStats.totalRevenue).toFixed(4)} AVAX</div>
                  </div>
                  <div className="stat-item">
                    <div className="stat-label">Wallet Balance</div>
                    <div className="stat-value eth">{Number(userStats.walletAVAX).toFixed(4)} AVAX</div>
                  </div>
                  <div className="stat-item">
                    <div className="stat-label">Verification</div>
                    <div className="stat-value">
                      {userStats.verificationStatus?.isVerified
                        ? verificationName(userStats.verificationStatus.level)
                        : "Not Verified"}
                    </div>
                  </div>
                </div>
                {/* Magic Eden style trending widgets */}
                <div className="collections-grid" style={{marginTop:16}}>
{curatedSamples.slice(0,4).map(s => (
                    <div key={s.id} className="ticket-card">
                      <img src={s.image} alt={s.name} style={{width:'100%',borderRadius:10,marginBottom:8}} />
                      <div className="title">{s.name}</div>
                      <div className="meta">{s.tier} • {s.venue}</div>
                      <div className="help-text">From {s.price} AVAX</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Activity Graph when no events */}
            {userStats.totalEvents === 0 && (
              <div style={{marginBottom: '32px'}}>
                <section className="section-header">
                  <div>
                    <h2 className="section-title">Platform Activity</h2>
                    <p className="section-subtitle">Live marketplace metrics</p>
                  </div>
                </section>
                
                <div className="hero-collection" style={{padding: '24px'}}>
                  <div className="hero-content">
                    {/* Hardcoded Activity Graph */}
                    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'end', height: '200px', padding: '20px', background: 'linear-gradient(135deg, #1e3a8a, #3b82f6)', borderRadius: '16px', marginBottom: '20px'}}>
                      <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px'}}>
                        <div style={{height: '80px', width: '20px', background: '#60a5fa', borderRadius: '4px'}}></div>
                        <span style={{fontSize: '12px', color: '#94a3b8'}}>Mon</span>
                      </div>
                      <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px'}}>
                        <div style={{height: '120px', width: '20px', background: '#3b82f6', borderRadius: '4px'}}></div>
                        <span style={{fontSize: '12px', color: '#94a3b8'}}>Tue</span>
                      </div>
                      <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px'}}>
                        <div style={{height: '90px', width: '20px', background: '#60a5fa', borderRadius: '4px'}}></div>
                        <span style={{fontSize: '12px', color: '#94a3b8'}}>Wed</span>
                      </div>
                      <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px'}}>
                        <div style={{height: '160px', width: '20px', background: '#1d4ed8', borderRadius: '4px'}}></div>
                        <span style={{fontSize: '12px', color: '#94a3b8'}}>Thu</span>
                      </div>
                      <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px'}}>
                        <div style={{height: '140px', width: '20px', background: '#2563eb', borderRadius: '4px'}}></div>
                        <span style={{fontSize: '12px', color: '#94a3b8'}}>Fri</span>
                      </div>
                      <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px'}}>
                        <div style={{height: '100px', width: '20px', background: '#60a5fa', borderRadius: '4px'}}></div>
                        <span style={{fontSize: '12px', color: '#94a3b8'}}>Sat</span>
                      </div>
                      <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px'}}>
                        <div style={{height: '110px', width: '20px', background: '#3b82f6', borderRadius: '4px'}}></div>
                        <span style={{fontSize: '12px', color: '#94a3b8'}}>Sun</span>
                      </div>
                    </div>
                    
                    <div style={{display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px'}}>
                      {trendingEvents.map((event, index) => (
                        <div key={index} style={{padding: '16px', background: 'rgba(255,255,255,0.05)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)'}}>
                          <div style={{display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px'}}>
                            <span style={{fontSize: '16px'}}>{event.trend}</span>
                            <span style={{fontSize: '14px', fontWeight: '600', color: '#ffffff'}}>{event.name}</span>
                          </div>
                          <div style={{fontSize: '12px', color: '#94a3b8', marginBottom: '4px'}}>Volume: {event.volume}</div>
                          <div style={{fontSize: '12px', color: event.change.startsWith('+') ? '#10b981' : '#ef4444'}}>{event.change}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Quick Actions */}
            <section className="section-header">
              <div>
                <h2 className="section-title">Quick Actions</h2>
                <p className="section-subtitle">Manage your events and tickets</p>
              </div>
            </section>

            <div className="collections-grid">
              <Link to="/marketplace" className="collection-card">
                <div className="collection-preview">
                  <div className="collection-main-image" style={{background: 'linear-gradient(135deg, #667eea, #764ba2)'}}></div>
                </div>
                <div className="collection-card-info">
                  <h3>🛍️ Browse Marketplace</h3>
                  <p className="collection-card-subtitle">Buy and sell event tickets</p>
                </div>
              </Link>

              <Link to="/auction-chamber" className="collection-card">
                <div className="collection-preview">
                  <div className="collection-main-image" style={{background: 'linear-gradient(135deg, #f093fb, #f5576c)'}}></div>
                </div>
                <div className="collection-card-info">
                  <h3>⚡ Auction Chamber</h3>
                  <p className="collection-card-subtitle">Bid on exclusive tickets</p>
                </div>
              </Link>

              <Link to="/profile" className="collection-card">
                <div className="collection-preview">
                  <div className="collection-main-image" style={{background: 'linear-gradient(135deg, #a8edea, #fed6e3)'}}></div>
                </div>
                <div className="collection-card-info">
                  <h3>👤 Profile</h3>
                  <p className="collection-card-subtitle">Manage your account</p>
                </div>
              </Link>

              <Link to="/create-event" className="collection-card">
                <div className="collection-preview">
                  <div className="collection-main-image" style={{background: 'linear-gradient(135deg, #ffecd2, #fcb69f)'}}></div>
                </div>
                <div className="collection-card-info">
                  <h3>➕ Create Event</h3>
                  <p className="collection-card-subtitle">Launch a new event with NFT tickets</p>
                </div>
              </Link>
            </div>

            {/* My Events Section */}
            <section className="section-header">
              <div>
                <h2 className="section-title">My Events</h2>
                <p className="section-subtitle">Events you've created</p>
              </div>
              <div className="section-filters">
                <Link to="/create-event" className="filter-btn active">Create Event</Link>
              </div>
            </section>

            {loading ? (
              <div className="loading">
                <div className="spinner"></div>
              </div>
            ) : userEvents.length === 0 ? (
              <div className="hero-collection" style={{textAlign: 'center', padding: '60px 32px'}}>
                <div className="hero-content">
                  <h3>You haven't created any events yet.</h3>
                  <p style={{marginBottom: '24px', color: '#8a8b8f'}}>Start your journey as an event organizer!</p>
                  <Link to="/create-event" className="connect-wallet-btn">
                    Create Your First Event
                  </Link>
                </div>
              </div>
            ) : (
              <div className="collections-grid">
                {userEvents.map((event) => (
                  <Link to={`/event/${event.address}`} key={event.address} className="collection-card">
                    <div className="collection-preview">
                      <div className="collection-main-image"></div>
                    </div>
                    <div className="collection-card-info">
                      <h3>{event.venue}</h3>
                      <p className="collection-card-subtitle">{event.description}</p>
                      <div className="collection-card-stats">
                        <div className="card-stat">
                          <div className="card-stat-label">Tickets Sold</div>
                          <div className="card-stat-value">{event.minted} / {event.totalSupply}</div>
                        </div>
                        <div className="card-stat">
                          <div className="card-stat-label">Event Date</div>
                          <div className="card-stat-value">{event.startTime.toLocaleDateString()}</div>
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Right Panel - Enhanced with NFTs and Activity */}
          <div className="right-panel">
            <div className="trending-panel">
              <div className="panel-header">
                <h3 className="panel-title">My Tickets</h3>
                <div className="panel-tabs">
                  <button className="tab-btn active">All</button>
                  <button className="tab-btn">VIP</button>
                </div>
              </div>
              
              {userTickets.length === 0 ? (
                <>
                  <div style={{textAlign: 'center', padding: '20px 0', color: '#8a8b8f'}}>
                    <p>No tickets yet</p>
                    <Link to="/" style={{color: '#2081e2', textDecoration: 'none', fontSize: '14px'}}>
                      Browse Events
                    </Link>
                  </div>
                  
                  {/* Sample NFTs Section */}
                  <div style={{marginTop: '24px'}}>
                    <div className="panel-header">
                      <h3 className="panel-title">Featured NFT Tickets</h3>
                    </div>
                    <div className="trending-list">
                      {sampleNFTs.slice(0, 5).map((nft) => (
                        <div key={nft.id} className="trending-item">
                          <div className="trending-rank" style={{fontSize: '24px'}}>{nft.image}</div>
                          <div className="trending-avatar" style={{background: 'linear-gradient(135deg, #667eea, #764ba2)'}}></div>
                          <div className="trending-info">
                            <div className="trending-name">{nft.name}</div>
                            <div className="trending-floor">
                              <span style={{fontSize: '12px', color: '#8a8b8f'}}>Floor: {nft.price}</span>
                              <span style={{fontSize: '10px', padding: '2px 6px', background: nft.rarity === 'Legendary' ? '#f59e0b' : nft.rarity === 'Epic' ? '#8b5cf6' : '#6b7280', borderRadius: '4px', color: 'white'}}>{nft.rarity}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <div className="trending-list">
                  {userTickets.slice(0, 10).map(({ eventAddress, tokenId, ticketInfo, venue, startTime }) => (
                    <Link to={`/event/${eventAddress}`} key={`${eventAddress}-${tokenId}`} className="trending-item" style={{textDecoration: 'none', color: 'inherit'}}>
                      <div className="trending-rank">#{ticketInfo.seatNumber}</div>
                      <div className="trending-avatar"></div>
                      <div className="trending-info">
                        <div className="trending-name">
                          {venue}
                          {ticketInfo.isVIP && <span style={{color: '#f59e0b', fontSize: '12px'}}>👑</span>}
                        </div>
                        <div className="trending-floor">
                          <span style={{fontSize: '12px', color: '#8a8b8f'}}>
                            {startTime.toLocaleDateString()}
                          </span>
                          <span className={`price-change ${ticketInfo.used ? 'negative' : 'positive'}`}>
                            {ticketInfo.used ? 'Used' : 'Active'}
                          </span>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
