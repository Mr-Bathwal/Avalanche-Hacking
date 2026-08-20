import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAccount } from 'wagmi';
import { BrowserProvider, Contract, formatEther } from 'ethers';
import { toast } from 'sonner';
import { EVENT_TICKET_ABI, TICKET_MARKETPLACE_ABI, CONTRACT_ADDRESSES } from '../lib/contracts';

export default function EventDetails() {
  const { eventAddress } = useParams();
  const { address, isConnected } = useAccount();
  const [eventInfo, setEventInfo] = useState(null);
  const [eventStats, setEventStats] = useState(null);
  const [userTickets, setUserTickets] = useState([]);
  const [marketplaceListings, setMarketplaceListings] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (eventAddress) {
      fetchEventDetails();
    }
    // eslint-disable-next-line
  }, [eventAddress]);

  useEffect(() => {
    if (eventAddress && isConnected && address) {
      fetchUserTickets();
      fetchMarketplaceListings();
    }
    // eslint-disable-next-line
  }, [eventAddress, isConnected, address]);

  const fetchEventDetails = async () => {
    setLoading(true);
    try {
      const provider = new BrowserProvider(window.ethereum);
      const eventContract = new Contract(eventAddress, EVENT_TICKET_ABI, provider);

      const [
        venue,
        description,
        startTime,
        endTime,
        baseMintPrice,
        vipMintPrice,
        maxSupply,
        nextTicketId,
        organizer,
        vipConfig,
        eventCancelled,
        eventCompleted
      ] = await Promise.all([
        eventContract.venue(),
        eventContract.eventDescription(),
        eventContract.eventStartTime(),
        eventContract.eventEndTime(),
        eventContract.baseMintPrice(),
        eventContract.vipMintPrice(),
        eventContract.maxSupply(),
        eventContract.nextTicketId(),
        eventContract.eventOrganizer(),
        eventContract.vipConfig(),
        eventContract.eventCancelled(),
        eventContract.eventCompleted(),
      ]);

      setEventInfo({
        venue,
        description,
        startTime: new Date(Number(startTime) * 1000),
        endTime: new Date(Number(endTime) * 1000),
        baseMintPrice: formatEther(baseMintPrice),
        vipMintPrice: formatEther(vipMintPrice),
        organizer,
        eventCancelled,
        eventCompleted,
      });

      setEventStats({
        maxSupply: Number(maxSupply),
        totalMinted: Number(nextTicketId),
        vipConfig: {
          vipEnabled: vipConfig.vipEnabled,
          totalVIPSeats: Number(vipConfig.totalVIPSeats),
          vipSeatStart: Number(vipConfig.vipSeatStart),
          vipSeatEnd: Number(vipConfig.vipSeatEnd),
        },
      });

    } catch (error) {
      console.error('Error fetching event details:', error);
      toast.error('Failed to load event details');
    }
    setLoading(false);
  };

  const fetchUserTickets = async () => {
    try {
      const provider = new BrowserProvider(window.ethereum);
      const eventContract = new Contract(eventAddress, EVENT_TICKET_ABI, provider);

      const balance = await eventContract.balanceOf(address);
      const ticketsData = [];

      if (Number(balance) > 0) {
        for (let i = 0; i < Number(balance); i++) {
          const tokenId = await eventContract.tokenOfOwnerByIndex(address, i);
          const ticketInfo = await eventContract.getTicketInfo(tokenId);
          const isUsed = await eventContract.isTicketUsed(tokenId);

          ticketsData.push({
            tokenId: Number(tokenId),
            ticketInfo,
            isUsed,
          });
        }
      }
      setUserTickets(ticketsData);
    } catch (error) {
      console.error('Error fetching user tickets:', error);
    }
  };

  const fetchMarketplaceListings = async () => {
    try {
      const provider = new BrowserProvider(window.ethereum);
      const marketplace = new Contract(
        CONTRACT_ADDRESSES.TICKET_MARKETPLACE,
        TICKET_MARKETPLACE_ABI,
        provider
      );
      const eventContract = new Contract(eventAddress, EVENT_TICKET_ABI, provider);

      const totalSupply = await eventContract.nextTicketId();
      const listingsData = [];

      for (let tokenId = 0; tokenId < Number(totalSupply); tokenId++) {
        try {
          const listingId = await marketplace.getListingId(eventAddress, tokenId);
          const listing = await marketplace.listings(listingId);
          if (listing.active) {
            const ticketInfo = await eventContract.getTicketInfo(tokenId);
            listingsData.push({
              tokenId,
              listing,
              ticketInfo,
              price: formatEther(listing.price),
              saleType: Number(listing.saleType), // 0 = FIXED_PRICE, 1 = AUCTION
            });
          }
        } catch (err) {
          // Skip if no listing exists
        }
      }
      setMarketplaceListings(listingsData);
    } catch (error) {
      console.error('Error fetching marketplace listings:', error);
    }
  };

  const cancelEvent = async () => {
    if (!window.confirm('Are you sure you want to cancel this event? This action cannot be undone.')) {
      return;
    }
    setLoading(true);
    try {
      const provider = new BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const eventContract = new Contract(eventAddress, EVENT_TICKET_ABI, signer);

      const tx = await eventContract.cancelEvent('Event cancelled by organizer');
      await tx.wait();

      toast.success('Event cancelled successfully');
      fetchEventDetails();
    } catch (error) {
      console.error('Error cancelling event:', error);
      toast.error('Failed to cancel event');
    }
    setLoading(false);
  };

  const completeEvent = async () => {
    setLoading(true);
    try {
      const provider = new BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const eventContract = new Contract(eventAddress, EVENT_TICKET_ABI, signer);

      const tx = await eventContract.markEventCompleted();
      await tx.wait();

      toast.success('Event marked as completed');
      fetchEventDetails();
    } catch (error) {
      console.error('Error completing event:', error);
      toast.error('Failed to complete event');
    }
    setLoading(false);
  };

  const buyTicket = async (tokenId, _price) => {
    setLoading(true);
    try {
      const provider = new BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const marketplace = new Contract(
        CONTRACT_ADDRESSES.TICKET_MARKETPLACE,
        TICKET_MARKETPLACE_ABI,
        signer
      );

      const tx = await marketplace.buyItemWithDeposits(eventAddress, tokenId);
      await tx.wait();

      toast.success('Ticket purchased successfully!');
      fetchUserTickets();
      fetchMarketplaceListings();
    } catch (error) {
      console.error('Error buying ticket:', error);
      toast.error('Failed to purchase ticket');
    }
    setLoading(false);
  };

  if (loading && !eventInfo) {
    return (
      <div className="loading-container">
        <div className="loading">Loading event details...</div>
      </div>
    );
  }

  if (!eventInfo) {
    return (
      <div className="error-container">
        <h2>Event Not Found</h2>
        <p>The event you're looking for doesn't exist or couldn't be loaded.</p>
        <Link to="/" className="back-btn">Back to Events</Link>
      </div>
    );
  }

  const isOrganizer = isConnected && address && address.toLowerCase() === eventInfo.organizer.toLowerCase();
  return (
    <div className="event-details-container">
      <div className="form-page" style={{padding:0}}>
        <div className="card" style={{marginBottom:16}}>
          <div className="event-header-card">
            <div className="event-cover"/>
            <div style={{flex:1}}>
              <h2 style={{marginBottom:6}}>{eventInfo.venue}</h2>
              <p style={{color:'#cbd5e1', marginBottom:8}}>{eventInfo.description}</p>
              <div className="kpi-grid">
                <div className="kpi-card">Base: {eventInfo.baseMintPrice} AVAX</div>
                <div className="kpi-card">VIP: {eventInfo.vipMintPrice} AVAX</div>
                <div className="kpi-card">Supply: {eventStats.maxSupply}</div>
                <div className="kpi-card">Minted: {eventStats.totalMinted}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Deposit to marketplace for this event */}
        <EventDepositPanel eventAddress={eventAddress} />

        {/* Listings available for this event */}
        <div className="card" style={{marginTop:16}}>
          <div className="form-header">
            <h3>Live Listings</h3>
            <p>Mint, bid or buy tickets listed for this event</p>
          </div>
          <div className="listings-grid">
            {marketplaceListings.length === 0 && <div className="help-text">No active listings yet.</div>}
            {marketplaceListings.map(item => (
              <div key={`l-${item.tokenId}`} className="ticket-card">
                <div className="title">Token #{item.tokenId}</div>
                <div className="meta">Seat #{item.ticketInfo.seatNumber} • {item.ticketInfo.isVIP? <span className="badge vip">VIP</span> : <span className="badge norm">Normal</span>}</div>
                <div style={{marginBottom:8}}>Price: {item.price} AVAX</div>
                {item.saleType === 0 ? (
                  <button className="btn btn-primary" disabled={!isConnected} onClick={() => buyTicket(item.tokenId, item.price)}>
                    Buy with Deposits
                  </button>
                ) : (
                  <div className="help-text">Auction item — bid in Auction Chamber</div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Your tickets for this event with refund/use actions if available */}
        {userTickets.length > 0 && (
          <div className="card" style={{marginTop:16}}>
            <div className="form-header">
              <h3>My Tickets</h3>
              <p>Manage tickets you own for this event</p>
            </div>
            <div className="listings-grid">
              {userTickets.map(t => (
                <UserTicketCard key={`t-${t.tokenId}`} eventAddress={eventAddress} ticket={t} onAction={() => { fetchUserTickets(); fetchMarketplaceListings(); }} />
              ))}
            </div>
          </div>
        )}

        {isOrganizer && (
          <div className="form-row" style={{marginTop:16}}>
            {!eventInfo.eventCancelled && !eventInfo.eventCompleted && (
              <button className="btn btn-danger" onClick={cancelEvent} disabled={loading}>Cancel Event</button>
            )}
            {!eventInfo.eventCompleted && (
              <button className="btn" onClick={completeEvent} disabled={loading}>Mark Completed</button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function EventDepositPanel({ eventAddress }) {
  const [amount, setAmount] = React.useState('');
  const [loading, setLoading] = React.useState(false);

  const deposit = async () => {
    setLoading(true);
    try {
      const provider = new BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const marketplace = new Contract(
        CONTRACT_ADDRESSES.TICKET_MARKETPLACE,
        TICKET_MARKETPLACE_ABI,
        signer
      );
      const tx = await marketplace.depositForEvent(eventAddress, { value: (await import('ethers')).parseEther(String(amount||'0')) });
      await tx.wait();
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  return (
    <div className="card">
      <div className="form-header">
        <h3>Add Funds</h3>
        <p>Deposit AVAX to enable quick purchases and bids for this event.</p>
      </div>
      <div className="deposit-card">
        <input className="input" type="number" min={0} step={0.001} value={amount} placeholder="Amount in AVAX" onChange={(e)=>setAmount(e.target.value)} />
        <button className="btn btn-primary" onClick={deposit} disabled={!amount || loading}>{loading? 'Depositing...' : 'Deposit'}</button>
      </div>
    </div>
  );
}

function UserTicketCard({ eventAddress, ticket, onAction }) {
  const [working, setWorking] = React.useState(false);

  const refund = async () => {
    setWorking(true);
    try {
      const provider = new BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const eventContract = new Contract(eventAddress, EVENT_TICKET_ABI, signer);
      const tx = await eventContract.refundTicket(ticket.tokenId);
      await tx.wait();
      onAction?.();
    } catch (e) { console.error(e); }
    setWorking(false);
  };

  const useTicket = async () => {
    setWorking(true);
    try {
      const provider = new BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const eventContract = new Contract(eventAddress, EVENT_TICKET_ABI, signer);
      const tx = await eventContract.useTicket(ticket.tokenId);
      await tx.wait();
      onAction?.();
    } catch (e) { console.error(e); }
    setWorking(false);
  };

  return (
    <div className="ticket-card">
      <div className="title">Seat #{ticket.ticketInfo.seatNumber}</div>
      <div className="meta">{ticket.ticketInfo.isVIP ? <span className="badge vip">VIP</span> : <span className="badge norm">Normal</span>} • {ticket.isUsed ? 'Used' : 'Active'}</div>
      <div className="form-row">
        {!ticket.isUsed && (
          <button className="btn" onClick={useTicket} disabled={working}>Use Ticket</button>
        )}
        <button className="btn btn-danger" onClick={refund} disabled={working}>Request Refund</button>
      </div>
    </div>
  );
}
