import React, { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { BrowserProvider, Contract, parseEther, formatEther } from 'ethers';
import { toast } from 'sonner';
import {
  CONTRACT_ADDRESSES,
  USER_VERIFICATION_ABI,
  TICKET_MARKETPLACE_ABI,
  EVENT_FACTORY_ABI,
} from '../lib/contracts';
import Banner3D from './Banner3D';
import { demoProfile, demoTickets } from '../utils/demoData';

export default function Profile() {
  const { address, isConnected } = useAccount();
  const [userProfile, setUserProfile] = useState({
    verificationStatus: null,
    balances: [],
  });
  const [loading, setLoading] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [selectedEvent, setSelectedEvent] = useState('');

  useEffect(() => {
    if (isConnected && address) {
      fetchProfile();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected, address]);

  const fetchProfile = async () => {
    setLoading(true);
    if (!window.ethereum) {
      toast.error('Ethereum provider not found');
      setLoading(false);
      return;
    }
    try {
      const provider = new BrowserProvider(window.ethereum);

      // Verification Status
      const verifier = new Contract(
        CONTRACT_ADDRESSES.USER_VERIFIER,
        USER_VERIFICATION_ABI,
        provider
      );
      const statusArr = await verifier.getUserStatus(address);

      const status = {
        isVerified: statusArr[0],
        level: Number(statusArr[1]),
        verifiedAt: new Date(Number(statusArr[2]) * 1000),
        expiresAt: new Date(Number(statusArr[3]) * 1000),
        suspended: statusArr[4],
        suspendedUntil:
          Number(statusArr[5]) > 0 ? new Date(Number(statusArr[5]) * 1000) : null,
        suspendedReason: Number(statusArr[6]),
      };

      // Events Created
      const factory = new Contract(
        CONTRACT_ADDRESSES.EVENT_FACTORY,
        EVENT_FACTORY_ABI,
        provider
      );
      let userEvents = [];
      try {
        userEvents = await factory.getAllOrganizerEvents(address);
      } catch {
        userEvents = [];
      }

      // Balances for each event
      const marketplace = new Contract(
        CONTRACT_ADDRESSES.TICKET_MARKETPLACE,
        TICKET_MARKETPLACE_ABI,
        provider
      );
      const balances = [];
      for (let ev of userEvents) {
        try {
          const res = await marketplace.getUserBalance(address, ev);
          balances.push({
            event: ev,
            totalDeposited: Number(formatEther(res[0])),
            available: Number(formatEther(res[1])),
            locked: Number(formatEther(res[2])),
            totalWithdrawn: Number(formatEther(res[3])),
            profits: Number(formatEther(res[4])),
            maxWithdrawable: Number(formatEther(res[5])),
          });
        } catch {
          balances.push({
            event: ev,
            totalDeposited: 0,
            available: 0,
            locked: 0,
            totalWithdrawn: 0,
            profits: 0,
            maxWithdrawable: 0,
          });
        }
      }

      setUserProfile({ verificationStatus: status, balances });
      if (userEvents.length > 0) setSelectedEvent(userEvents[0]);
    } catch (e) {
      toast.error('Failed to load profile');
      console.error(e);
    }
    setLoading(false);
  };

  const withdrawFunds = async () => {
    if (!withdrawAmount || isNaN(withdrawAmount) || Number(withdrawAmount) <= 0) {
      toast.error('Enter valid withdraw amount');
      return;
    }
    if (!selectedEvent) {
      toast.error('Select an event');
      return;
    }
    setLoading(true);
    try {
      const provider = new BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const marketplace = new Contract(
        CONTRACT_ADDRESSES.TICKET_MARKETPLACE,
        TICKET_MARKETPLACE_ABI,
        signer
      );
      const tx = await marketplace.withdrawFunds(selectedEvent, parseEther(withdrawAmount));
      await tx.wait();
      toast.success('Withdrawal successful');
      setWithdrawAmount('');
      fetchProfile();
    } catch (e) {
      toast.error('Failed to withdraw');
      console.error(e);
    }
    setLoading(false);
  };

  const collectProfits = async () => {
    if (!selectedEvent) {
      toast.error('Select an event');
      return;
    }
    setLoading(true);
    try {
      const provider = new BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const marketplace = new Contract(
        CONTRACT_ADDRESSES.TICKET_MARKETPLACE,
        TICKET_MARKETPLACE_ABI,
        signer
      );
      const tx = await marketplace.collectProfits(selectedEvent);
      await tx.wait();
      toast.success('Profits collected');
      fetchProfile();
    } catch (e) {
      toast.error('Failed to collect profits');
      console.error(e);
    }
    setLoading(false);
  };

  const getLevelName = (lvl) => {
    const levels = ['None', 'Basic', 'Premium', 'VIP', 'Admin'];
    return levels[lvl] || 'Unknown';
  };

  const getLevelColor = (lvl) => {
    const colors = {
      0: '#6c757d',
      1: '#28a745', 
      2: '#007bff',
      3: '#ffc107',
      4: '#dc3545'
    };
    return colors[lvl] || '#6c757d';
  };

  if (!isConnected) {
    return (
      <div className="sc-wrap">
        <Banner3D kicker="Your account" title="Profile" subtitle="Verification, tickets and earnings — all in one place." />
        <div className="sc-demo">✦ <b>Demo preview</b> — connect a wallet to see your real profile &amp; balances.</div>
        <div className="sc-stats">
          <div className="sc-stat"><b>{demoProfile.levelName}</b><span>Verification</span></div>
          <div className="sc-stat"><b>{demoProfile.stats.ticketsOwned}</b><span>Tickets owned</span></div>
          <div className="sc-stat"><b>{demoProfile.stats.eventsCreated}</b><span>Events created</span></div>
          <div className="sc-stat"><b>{demoProfile.stats.revenue} AVAX</b><span>Revenue</span></div>
        </div>
        <h2 className="sc-h2">My tickets</h2>
        <div className="sc-grid">
          {demoTickets.map((t) => (
            <div className="sc-card" key={t.id}>
              <div className="sc-card-media" style={{ backgroundImage: `url(${t.image})` }}>
                <span className="sc-card-tag">Seat {t.seat}</span>
              </div>
              <div className="sc-card-body">
                <h3>{t.event}</h3>
                <p className="sc-card-sub">
                  <span className={`sc-badge ${t.tier === 'VIP' ? 'vip' : 'normal'}`}>{t.tier}</span>
                  <span className="sc-badge" style={{ marginLeft: 6 }}>{t.status}</span>
                </p>
                <div className="sc-card-foot">
                  <span className="sc-price" style={{ fontSize: 13 }}>NFT · {t.id.toUpperCase()}</span>
                  <button className="sc-btn">View</button>
                </div>
              </div>
            </div>
          ))}
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
            <input type="text" className="search-input" placeholder="Search..." />
          </div>
          <div className="header-actions">
            <div className="wallet-info">
              <span>👤 Profile</span>
            </div>
          </div>
        </header>

        <div className="content-layout">
          <div className="main-panel">
            {/* Profile Hero */}
            <div className="hero-collection">
              <div className="hero-content">
                <div className="collection-header">
                  <div className="collection-avatar" style={{background: 'linear-gradient(135deg, #f093fb, #f5576c)'}}></div>
                  <div className="collection-info">
                    <h1>
                      My Profile
                      <span className="verified-badge">✓</span>
                    </h1>
                    <p className="collection-by">{address}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Verification Status */}
            <section className="section-header">
              <div>
                <h2 className="section-title">Verification Status</h2>
                <p className="section-subtitle">Your account verification level</p>
              </div>
            </section>

            <div className="verification-card">
              {userProfile.verificationStatus ? (
                <div className="verification-content">
                  <div className="verification-main">
                    <div className="status-badge" style={{
                      backgroundColor: getLevelColor(userProfile.verificationStatus.level),
                      color: 'white'
                    }}>
                      {userProfile.verificationStatus.isVerified ? '✓ Verified' : '✗ Not Verified'}
                    </div>
                    <div className="status-level">
                      {getLevelName(userProfile.verificationStatus.level)}
                    </div>
                  </div>
                  {userProfile.verificationStatus.isVerified && (
                    <div className="verification-details">
                      <div className="detail-item">
                        <span className="detail-label">Verified:</span>
                        <span className="detail-value">
                          {userProfile.verificationStatus.verifiedAt.toLocaleDateString()}
                        </span>
                      </div>
                      <div className="detail-item">
                        <span className="detail-label">Expires:</span>
                        <span className="detail-value">
                          {userProfile.verificationStatus.expiresAt.toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="loading">
                  <div className="spinner"></div>
                </div>
              )}
            </div>

            {/* Account Features */}
            <section className="section-header">
              <div>
                <h2 className="section-title">Account Features</h2>
                <p className="section-subtitle">Available features based on verification</p>
              </div>
            </section>

            <div className="features-grid">
              <FeatureCard
                icon="🎫"
                title="Event Creation"
                enabled={userProfile.verificationStatus?.isVerified}
                description={userProfile.verificationStatus?.isVerified ? "Create events" : "Requires verification"}
              />
              <FeatureCard
                icon="🛍️"
                title="Marketplace Trading"
                enabled={userProfile.verificationStatus?.isVerified}
                description={userProfile.verificationStatus?.isVerified ? "Buy & sell tickets" : "Limited access"}
              />
              <FeatureCard
                icon="⚡"
                title="Auction Participation"
                enabled={userProfile.verificationStatus?.isVerified}
                description={userProfile.verificationStatus?.isVerified ? "Bid & create auctions" : "View only"}
              />
              <FeatureCard
                icon="👑"
                title="VIP Benefits"
                enabled={userProfile.verificationStatus?.level >= 3}
                description={userProfile.verificationStatus?.level >= 3 ? "VIP member perks" : "Standard access"}
              />
            </div>

            {/* Financial Overview */}
            {userProfile.balances.length > 0 && (
              <>
                <section className="section-header">
                  <div>
                    <h2 className="section-title">Financial Overview</h2>
                    <p className="section-subtitle">Manage your balances and earnings</p>
                  </div>
                </section>

                <div className="financial-section">
                  <div className="event-selector">
                    <label className="selector-label">Select Event:</label>
                    <select
                      className="event-select"
                      value={selectedEvent}
                      onChange={(e) => setSelectedEvent(e.target.value)}
                    >
                      {userProfile.balances.map((b) => (
                        <option key={b.event} value={b.event}>
                          {`${b.event.slice(0, 8)}...${b.event.slice(-6)}`}
                        </option>
                      ))}
                    </select>
                  </div>

                  <FinancialCards
                    balances={userProfile.balances}
                    selected={selectedEvent}
                    withdrawAmount={withdrawAmount}
                    setWithdrawAmount={setWithdrawAmount}
                    onWithdraw={withdrawFunds}
                    onCollect={collectProfits}
                    loading={loading}
                  />
                </div>
              </>
            )}

            {/* Account Actions */}
            <section className="section-header">
              <div>
                <h2 className="section-title">Account Actions</h2>
                <p className="section-subtitle">Manage your account settings</p>
              </div>
            </section>

            <div className="actions-grid">
              <button className="action-btn primary" disabled={!userProfile.verificationStatus?.isVerified}>
                Request Verification Upgrade
              </button>
              <button className="action-btn secondary">
                View Transaction History
              </button>
              <button className="action-btn secondary">
                Export Account Data
              </button>
              <button className="action-btn danger">
                Deactivate Account
              </button>
            </div>
          </div>

          {/* Right Panel */}
          <div className="right-panel">
            <div className="trending-panel">
              <div className="panel-header">
                <h3 className="panel-title">Account Overview</h3>
              </div>
              <div className="overview-stats">
                <div className="overview-item">
                  <div className="overview-icon">🎫</div>
                  <div className="overview-info">
                    <div className="overview-label">Events Created</div>
                    <div className="overview-value">{userProfile.balances.length}</div>
                  </div>
                </div>
                <div className="overview-item">
                  <div className="overview-icon">💰</div>
                  <div className="overview-info">
                    <div className="overview-label">Total Revenue</div>
                    <div className="overview-value">
                      {userProfile.balances.reduce((sum, b) => sum + b.profits, 0).toFixed(4)} AVAX
                    </div>
                  </div>
                </div>
                <div className="overview-item">
                  <div className="overview-icon">🔒</div>
                  <div className="overview-info">
                    <div className="overview-label">Locked Funds</div>
                    <div className="overview-value">
                      {userProfile.balances.reduce((sum, b) => sum + b.locked, 0).toFixed(4)} AVAX
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <ProfileCSS />
    </div>
  );
}

function FeatureCard({ icon, title, enabled, description }) {
  return (
    <div className={`feature-card ${enabled ? 'enabled' : 'disabled'}`}>
      <div className="feature-icon">{icon}</div>
      <div className="feature-content">
        <h3 className="feature-title">{title}</h3>
        <p className="feature-description">{description}</p>
      </div>
      <div className={`feature-status ${enabled ? 'active' : 'inactive'}`}>
        {enabled ? '✓' : '○'}
      </div>
    </div>
  );
}

function FinancialCards({
  balances,
  selected,
  withdrawAmount,
  setWithdrawAmount,
  onWithdraw,
  onCollect,
  loading,
}) {
  const selectedBalance = balances.find((b) => b.event === selected) || balances[0] || {
    available: 0,
    locked: 0,
    profits: 0,
  };

  return (
    <div className="financial-cards">
      <div className="financial-card">
        <div className="card-header">
          <h3>Available Balance</h3>
          <div className="card-amount">{selectedBalance.available.toFixed(4)} AVAX</div>
        </div>
        <div className="card-actions">
          <input
            type="number"
            className="withdraw-input"
            placeholder="Amount to withdraw"
            value={withdrawAmount}
            onChange={(e) => setWithdrawAmount(e.target.value)}
            disabled={loading}
            min="0"
            step="0.0001"
          />
          <button
            className="action-btn primary"
            onClick={onWithdraw}
            disabled={loading || selectedBalance.available === 0}
          >
            {loading ? 'Processing...' : 'Withdraw'}
          </button>
        </div>
      </div>

      <div className="financial-card">
        <div className="card-header">
          <h3>Locked Balance</h3>
          <div className="card-amount">{selectedBalance.locked.toFixed(4)} AVAX</div>
        </div>
        <p className="card-description">Funds in active listings and bids</p>
      </div>

      <div className="financial-card">
        <div className="card-header">
          <h3>Profits</h3>
          <div className="card-amount">{selectedBalance.profits.toFixed(4)} AVAX</div>
        </div>
        <button
          className="action-btn primary full-width"
          onClick={onCollect}
          disabled={loading || selectedBalance.profits === 0}
        >
          {loading ? 'Processing...' : 'Collect Profits'}
        </button>
        <p className="card-description">Lifetime earnings from sales</p>
      </div>
    </div>
  );
}

function ProfileCSS() {
  return (
    <style jsx>{`
      .app-container {
        min-height: 100vh;
        background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #1a1a2e 100%);
        color: #ffffff;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      }

      .main-content {
        max-width: 1400px;
        margin: 0 auto;
        padding: 0 20px;
      }

      /* Header */
      .header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 24px 0;
        margin-bottom: 32px;
      }

      .search-container {
        position: relative;
        max-width: 500px;
        flex: 1;
        margin-right: 24px;
      }

      .search-input {
        width: 100%;
        padding: 12px 16px 12px 44px;
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 12px;
        color: #ffffff;
        font-size: 14px;
        transition: all 0.2s ease;
      }

      .search-input:focus {
        outline: none;
        border-color: rgba(32, 129, 226, 0.5);
        background: rgba(255, 255, 255, 0.08);
      }

      .search-input::placeholder {
        color: rgba(255, 255, 255, 0.5);
      }

      .search-icon {
        position: absolute;
        left: 16px;
        top: 50%;
        transform: translateY(-50%);
        color: rgba(255, 255, 255, 0.5);
        font-size: 16px;
      }

      .header-actions {
        display: flex;
        align-items: center;
        gap: 16px;
      }

      .wallet-info {
        padding: 8px 16px;
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 20px;
        font-size: 14px;
        font-weight: 500;
      }

      /* Content Layout */
      .content-layout {
        display: flex;
        gap: 32px;
      }

      .main-panel {
        flex: 1;
      }

      .right-panel {
        width: 320px;
        flex-shrink: 0;
      }

      /* Hero Collection */
      .hero-collection {
        background: rgba(255, 255, 255, 0.02);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 16px;
        padding: 32px;
        margin-bottom: 32px;
        backdrop-filter: blur(20px);
      }

      .hero-content {
        text-align: center;
      }

      .collection-header {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 24px;
        margin-bottom: 24px;
      }

      .collection-avatar {
        width: 120px;
        height: 120px;
        border-radius: 50%;
        border: 4px solid rgba(255, 255, 255, 0.1);
      }

      .collection-info h1 {
        font-size: 32px;
        font-weight: 700;
        margin: 0 0 8px 0;
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .verified-badge {
        background: #2081e2;
        color: white;
        border-radius: 50%;
        width: 24px;
        height: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 14px;
      }

      .collection-by {
        color: rgba(255, 255, 255, 0.7);
        font-size: 16px;
        margin: 0;
        word-break: break-all;
        font-family: 'Courier New', monospace;
      }

      .connect-wallet-btn {
        background: linear-gradient(135deg, #667eea, #764ba2);
        color: white;
        border: none;
        padding: 16px 32px;
        border-radius: 12px;
        font-size: 16px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s ease;
      }

      .connect-wallet-btn:hover {
        transform: translateY(-2px);
        box-shadow: 0 8px 25px rgba(102, 126, 234, 0.3);
      }

      /* Section Headers */
      .section-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin: 48px 0 24px 0;
      }

      .section-title {
        font-size: 24px;
        font-weight: 700;
        margin: 0 0 4px 0;
        color: #ffffff;
      }

      .section-subtitle {
        font-size: 14px;
        color: rgba(255, 255, 255, 0.6);
        margin: 0;
      }

      /* Verification Card */
      .verification-card {
        background: rgba(255, 255, 255, 0.02);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 16px;
        padding: 24px;
        margin-bottom: 32px;
      }

      .verification-content {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }

      .verification-main {
        display: flex;
        align-items: center;
        gap: 16px;
      }

      .status-badge {
        padding: 8px 16px;
        border-radius: 20px;
        font-size: 14px;
        font-weight: 600;
        display: inline-flex;
        align-items: center;
        gap: 6px;
      }

      .status-level {
        font-size: 20px;
        font-weight: 700;
        color: #ffffff;
      }

      .verification-details {
        display: flex;
        gap: 24px;
        flex-wrap: wrap;
      }

      .detail-item {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .detail-label {
        font-size: 12px;
        color: rgba(255, 255, 255, 0.6);
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }

      .detail-value {
        font-size: 14px;
        font-weight: 600;
        color: #ffffff;
      }

      /* Features Grid */
      .features-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
        gap: 16px;
        margin-bottom: 32px;
      }

      .feature-card {
        background: rgba(255, 255, 255, 0.02);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 16px;
        padding: 20px;
        display: flex;
        align-items: center;
        gap: 16px;
        transition: all 0.2s ease;
      }

      .feature-card.enabled {
        background: rgba(32, 129, 226, 0.1);
        border-color: rgba(32, 129, 226, 0.3);
      }

      .feature-card:hover {
        transform: translateY(-2px);
        background: rgba(255, 255, 255, 0.05);
      }

      .feature-icon {
        font-size: 32px;
        width: 48px;
        height: 48px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 12px;
        background: rgba(255, 255, 255, 0.05);
      }

      .feature-content {
        flex: 1;
      }

      .feature-title {
        font-size: 16px;
        font-weight: 600;
        margin: 0 0 4px 0;
        color: #ffffff;
      }

      .feature-description {
        font-size: 14px;
        color: rgba(255, 255, 255, 0.7);
        margin: 0;
      }

      .feature-status {
        width: 24px;
        height: 24px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 14px;
        font-weight: 600;
      }

      .feature-status.active {
        background: #10b981;
        color: white;
      }

      .feature-status.inactive {
        background: rgba(255, 255, 255, 0.1);
        color: rgba(255, 255, 255, 0.5);
      }

      /* Financial Section */
      .financial-section {
        margin-bottom: 32px;
      }

      .event-selector {
        margin-bottom: 24px;
      }

      .selector-label {
        display: block;
        font-size: 14px;
        font-weight: 600;
        color: #ffffff;
        margin-bottom: 8px;
      }

      .event-select {
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 12px;
        padding: 12px 16px;
        color: #ffffff;
        font-size: 14px;
        width: 300px;
        cursor: pointer;
      }

      .event-select:focus {
        outline: none;
        border-color: rgba(32, 129, 226, 0.5);
      }

      .financial-cards {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
        gap: 20px;
      }

      .financial-card {
        background: rgba(255, 255, 255, 0.02);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 16px;
        padding: 24px;
        transition: all 0.2s ease;
      }

      .financial-card:hover {
        transform: translateY(-2px);
        background: rgba(255, 255, 255, 0.05);
      }

      .card-header {
        margin-bottom: 16px;
      }

      .card-header h3 {
        font-size: 16px;
        font-weight: 600;
        color: #ffffff;
        margin: 0 0 8px 0;
      }

      .card-amount {
        font-size: 24px;
        font-weight: 700;
        color: #2081e2;
        font-family: 'Courier New', monospace;
      }

      .card-actions {
        display: flex;
        gap: 12px;
        align-items: center;
      }

      .withdraw-input {
        flex: 1;
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 8px;
        padding: 10px 12px;
        color: #ffffff;
        font-size: 14px;
      }

      .withdraw-input:focus {
        outline: none;
        border-color: rgba(32, 129, 226, 0.5);
      }

      .withdraw-input::placeholder {
        color: rgba(255, 255, 255, 0.5);
      }

      .card-description {
        font-size: 14px;
        color: rgba(255, 255, 255, 0.6);
        margin: 12px 0 0 0;
      }

      /* Action Buttons */
      .action-btn {
        padding: 12px 20px;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s ease;
        border: none;
        text-decoration: none;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
      }

      .action-btn.primary {
        background: linear-gradient(135deg, #2081e2, #1c7ed6);
        color: white;
      }

      .action-btn.primary:hover:not(:disabled) {
        background: linear-gradient(135deg, #1c7ed6, #1971c2);
        transform: translateY(-1px);
      }

      .action-btn.secondary {
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(255, 255, 255, 0.2);
        color: #ffffff;
      }

      .action-btn.secondary:hover {
        background: rgba(255, 255, 255, 0.1);
      }

      .action-btn.danger {
        background: #e74c3c;
        color: white;
      }

      .action-btn.danger:hover {
        background: #c0392b;
      }

      .action-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
        transform: none;
      }

      .action-btn.full-width {
        width: 100%;
        margin-top: 16px;
      }

      /* Actions Grid */
      .actions-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 16px;
        margin-bottom: 32px;
      }

      /* Right Panel */
      .trending-panel {
        background: rgba(255, 255, 255, 0.02);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 16px;
        padding: 20px;
      }

      .panel-header {
        margin-bottom: 20px;
      }

      .panel-title {
        font-size: 18px;
        font-weight: 600;
        color: #ffffff;
        margin: 0;
      }

      .overview-stats {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }

      .overview-item {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 16px;
        background: rgba(255, 255, 255, 0.02);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 12px;
      }

      .overview-icon {
        font-size: 24px;
        width: 40px;
        height: 40px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(255, 255, 255, 0.05);
        border-radius: 8px;
      }

      .overview-info {
        flex: 1;
      }

      .overview-label {
        font-size: 12px;
        color: rgba(255, 255, 255, 0.6);
        margin-bottom: 4px;
      }

      .overview-value {
        font-size: 16px;
        font-weight: 600;
        color: #ffffff;
        font-family: 'Courier New', monospace;
      }

      /* Loading */
      .loading {
        display: flex;
        justify-content: center;
        align-items: center;
        padding: 40px;
      }

      .spinner {
        width: 32px;
        height: 32px;
        border: 3px solid rgba(255, 255, 255, 0.1);
        border-top: 3px solid #2081e2;
        border-radius: 50%;
        animation: spin 1s linear infinite;
      }

      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }

      /* Responsive Design */
      @media (max-width: 1024px) {
        .content-layout {
          flex-direction: column;
        }

        .right-panel {
          width: 100%;
        }

        .collection-header {
          flex-direction: column;
          text-align: center;
        }

        .verification-main {
          flex-direction: column;
          align-items: flex-start;
        }
      }

      @media (max-width: 768px) {
        .main-content {
          padding: 0 16px;
        }

        .header {
          flex-direction: column;
          gap: 16px;
        }

        .search-container {
          margin-right: 0;
          max-width: 100%;
        }

        .features-grid {
          grid-template-columns: 1fr;
        }

        .financial-cards {
          grid-template-columns: 1fr;
        }

        .actions-grid {
          grid-template-columns: 1fr;
        }

        .verification-details {
          flex-direction: column;
          gap: 12px;
        }

        .card-actions {
          flex-direction: column;
          gap: 8px;
        }

        .withdraw-input {
          width: 100%;
        }
      }
    `}</style>
  );
}
