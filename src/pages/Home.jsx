import React, { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { BrowserProvider, Contract, formatEther } from 'ethers';
import { Link } from 'react-router-dom';
import { CONTRACT_ADDRESSES, EVENT_FACTORY_ABI, EVENT_TICKET_ABI } from '../lib/contracts';
import { sampleCollections } from '../utils/sampleAssets';

export default function Home() {
  const { isConnected } = useAccount();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isConnected) {
      fetchEvents();
    }
  }, [isConnected]);

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const provider = new BrowserProvider(window.ethereum);
      const eventFactory = new Contract(CONTRACT_ADDRESSES.EVENT_FACTORY, EVENT_FACTORY_ABI, provider);

      const eventAddresses = await eventFactory.getAllDeployedEvents();

      const eventsData = await Promise.all(
        eventAddresses.map(async (eventAddress) => {
          try {
            const eventContract = new Contract(eventAddress, EVENT_TICKET_ABI, provider);
            const [venue, description, startTime, endTime, baseMintPrice, maxSupply] = await Promise.all([
              eventContract.venue(),
              eventContract.eventDescription(),
              eventContract.eventStartTime(),
              eventContract.eventEndTime(),
              eventContract.baseMintPrice(),
              eventContract.maxSupply(),
            ]);
            return {
              address: eventAddress,
              venue,
              description,
              startTime: new Date(Number(startTime) * 1000),
              endTime: new Date(Number(endTime) * 1000),
              price: formatEther(baseMintPrice),
              totalSeats: Number(maxSupply),
            };
          } catch (err) {
            console.error('Error fetching event data:', err);
            return null;
          }
        })
      );

      setEvents(eventsData.filter(Boolean));
    } catch (error) {
      console.error('Error fetching events:', error);
    }
    setLoading(false);
  };

  return (
    <div className="app-container">
      <div className="main-content">
        {/* Header */}
        <header className="header">
          <div className="search-container">
            <span className="search-icon">🔍</span>
            <input type="text" className="search-input" placeholder="Search TicketVerse" />
          </div>
          <div className="header-actions">
            {!isConnected && (
              <button className="connect-wallet-btn">Connect Wallet</button>
            )}
          </div>
        </header>

        <div className="content-layout">
          <div className="main-panel">
            {/* Hero Section */}
            <div className="hero-collection">
              <div className="hero-content">
                <div className="collection-header">
                  <div className="collection-avatar" style={{background: 'linear-gradient(135deg, #667eea, #764ba2)'}}></div>
                  <div className="collection-info">
                    <h1>
                      TicketVerse
                      <span className="verified-badge">✓</span>
                    </h1>
                    <p className="collection-by">Decentralized Event Ticketing & NFT Marketplace</p>
                  </div>
                </div>

                {!isConnected ? (
                  <div style={{textAlign: 'center', marginTop: '40px'}}>
                    <h3 style={{marginBottom: '16px'}}>Connect your wallet to explore</h3>
                    <button className="connect-wallet-btn">Connect Wallet</button>
                  </div>
                ) : (
                  <div className="collection-stats">
                    <div className="stat-item">
                      <div className="stat-label">Total Events</div>
                      <div className="stat-value">{events.length}</div>
                    </div>
                    <div className="stat-item">
                      <div className="stat-label">Active</div>
                      <div className="stat-value">{events.filter(e => new Date() < e.startTime).length}</div>
                    </div>
                    <div className="stat-item">
                      <div className="stat-label">Live Now</div>
                      <div className="stat-value">{events.filter(e => new Date() >= e.startTime && new Date() <= e.endTime).length}</div>
                    </div>
                    <div className="stat-item">
                      <div className="stat-label">Platform</div>
                      <div className="stat-value eth">Avalanche</div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {isConnected && (
              <>
                {/* Section Header */}
                <section className="section-header">
                  <div>
                    <h2 className="section-title">Live Events</h2>
                    <p className="section-subtitle">Discover and book tickets for amazing events</p>
                  </div>
                  <div className="section-filters">
                    <Link to="/create-event" className="filter-btn active">Create Event</Link>
                    <button className="filter-btn">All Events</button>
                    <button className="filter-btn">This Week</button>
                  </div>
                </section>

                {/* Events Grid */}
                {loading ? (
                  <div className="loading">
                    <div className="spinner"></div>
                  </div>
                ) : events.length === 0 ? (
                  <div className="hero-collection" style={{textAlign: 'center', padding: '60px 32px'}}>
                    <div className="hero-content">
                      <h3>No events found</h3>
                      <p style={{marginBottom: '24px', color: '#8a8b8f'}}>Be the first to create an amazing event!</p>
                      <Link to="/create-event" className="connect-wallet-btn">
                        Create Event
                      </Link>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="collections-grid">
                      {events.map((event, idx) => {
                        const showcase = sampleCollections[idx % sampleCollections.length];
                        return (
                          <div key={event.address} className="collection-card">
                            <div className="collection-preview">
                              <div className="collection-main-image" style={{ backgroundImage: `url(${showcase.tiles[0]})`, backgroundSize: 'cover' }}></div>
                              <div className="collection-thumbnails">
                                <div className="thumbnail" style={{ backgroundImage: `url(${showcase.tiles[1]})`, backgroundSize: 'cover' }}></div>
                                <div className="thumbnail" style={{ backgroundImage: `url(${showcase.tiles[2]})`, backgroundSize: 'cover' }}></div>
                                <div className="thumbnail"></div>
                                <div className="thumbnail"></div>
                              </div>
                            </div>
                            <div className="collection-card-info">
                              <h3>
                                {event.venue}
                                <span className="verified-badge">✓</span>
                              </h3>
                              <p className="collection-card-subtitle">{event.description}</p>
                              <div className="collection-card-stats">
                                <div className="card-stat">
                                  <div className="card-stat-label">Start Date</div>
                                  <div className="card-stat-value">{event.startTime.toLocaleDateString()}</div>
                                </div>
                                <div className="card-stat">
                                  <div className="card-stat-label">Price From</div>
                                  <div className="card-stat-value">{Number(event.price).toFixed(3)} AVAX</div>
                                </div>
                                <div className="card-stat">
                                  <div className="card-stat-label">Total Seats</div>
                                  <div className="card-stat-value">{event.totalSeats}</div>
                                </div>
                              </div>
                              <div style={{display: 'flex', gap: '8px', marginTop: '16px'}}>
                                <Link to={`/event/${event.address}`} className="filter-btn" style={{flex: 1, textAlign: 'center'}}>
                                  View Event
                                </Link>
                                <Link to={`/book-seat/${event.address}`} className="connect-wallet-btn" style={{flex: 1, textAlign: 'center', fontSize: '14px', padding: '8px 16px'}}>
                                  Book Ticket
                                </Link>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Magic Eden-inspired banner row (sample collections) */}
                    <div className="hero-collection" style={{marginTop: 8}}>
                      <div className="hero-content">
                        <div className="collection-header">
                          <div className="collection-avatar" style={{backgroundImage: `url(${sampleCollections[0].banner})`, backgroundSize: 'cover'}}></div>
                          <div className="collection-info">
                            <h1>Featured Collections <span className="verified-badge">★</span></h1>
                            <p className="collection-by">Curated tickets & passes</p>
                          </div>
                        </div>
                        <div className="collections-grid">
                          {sampleCollections.map((c) => (
                            <div key={c.id} className="collection-card">
                              <div className="collection-preview">
                                <div className="collection-main-image" style={{ backgroundImage:`url(${c.banner})`, backgroundSize:'cover' }}></div>
                                <div className="collection-thumbnails">
                                  {c.tiles.map((t, i) => (
                                    <div key={i} className="thumbnail" style={{ backgroundImage:`url(${t})`, backgroundSize:'cover' }}></div>
                                  ))}
                                </div>
                              </div>
                              <div className="collection-card-info">
                                <h3>{c.title} <span className="verified-badge">✓</span></h3>
                                <p className="collection-card-subtitle">{c.subtitle}</p>
                                <div className="collection-card-stats">
                                  <div className="card-stat"><div className="card-stat-label">Floor</div><div className="card-stat-value">{c.stats.floor} AVAX</div></div>
                                  <div className="card-stat"><div className="card-stat-label">Listed</div><div className="card-stat-value">{c.stats.listed}</div></div>
                                  <div className="card-stat"><div className="card-stat-label">Volume</div><div className="card-stat-value">{c.stats.volume} AVAX</div></div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </>
            )}
          </div>

          {/* Right Panel - Quick Links */}
          {isConnected && (
            <div className="right-panel">
              <div className="trending-panel">
                <div className="panel-header">
                  <h3 className="panel-title">Quick Links</h3>
                </div>
                <div className="trending-list">
                  <Link to="/dashboard" className="trending-item" style={{textDecoration: 'none', color: 'inherit'}}>
                    <div className="trending-rank">📊</div>
                    <div className="trending-info">
                      <div className="trending-name">Dashboard</div>
                      <div className="trending-floor">
                        <span style={{fontSize: '12px', color: '#8a8b8f'}}>View your stats</span>
                      </div>
                    </div>
                  </Link>
                  
                  <Link to="/marketplace" className="trending-item" style={{textDecoration: 'none', color: 'inherit'}}>
                    <div className="trending-rank">🛍️</div>
                    <div className="trending-info">
                      <div className="trending-name">Marketplace</div>
                      <div className="trending-floor">
                        <span style={{fontSize: '12px', color: '#8a8b8f'}}>Buy & sell tickets</span>
                      </div>
                    </div>
                  </Link>

                  <Link to="/auction-chamber" className="trending-item" style={{textDecoration: 'none', color: 'inherit'}}>
                    <div className="trending-rank">⚡</div>
                    <div className="trending-info">
                      <div className="trending-name">Auction Chamber</div>
                      <div className="trending-floor">
                        <span style={{fontSize: '12px', color: '#8a8b8f'}}>Bid on exclusive tickets</span>
                      </div>
                    </div>
                  </Link>

                  <Link to="/profile" className="trending-item" style={{textDecoration: 'none', color: 'inherit'}}>
                    <div className="trending-rank">👤</div>
                    <div className="trending-info">
                      <div className="trending-name">Profile</div>
                      <div className="trending-floor">
                        <span style={{fontSize: '12px', color: '#8a8b8f'}}>Manage account</span>
                      </div>
                    </div>
                  </Link>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
