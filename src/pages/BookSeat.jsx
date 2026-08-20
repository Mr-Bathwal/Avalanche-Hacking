import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useAccount } from 'wagmi';
import { BrowserProvider, Contract, formatEther, parseEther } from 'ethers';
import { toast } from 'sonner';
import { EVENT_TICKET_ABI } from '../lib/contracts';

export default function BookSeat() {
  const { eventAddress } = useParams();
  const { isConnected } = useAccount();
  const [eventInfo, setEventInfo] = useState(null);
  const [seats, setSeats] = useState([]);
  const [selectedSeat, setSelectedSeat] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isConnected && eventAddress) {
      fetchEventInfo();
    }
    // eslint-disable-next-line
  }, [isConnected, eventAddress]);

  const fetchEventInfo = async () => {
    try {
      const provider = new BrowserProvider(window.ethereum);
      const eventContract = new Contract(eventAddress, EVENT_TICKET_ABI, provider);

      const [venue, description, seatCount, baseMintPrice, vipMintPrice, vipConfigStruct] = await Promise.all([
        eventContract.venue(),
        eventContract.eventDescription(),
        eventContract.seatCount(),
        eventContract.baseMintPrice(),
        eventContract.vipMintPrice(),
        eventContract.vipConfig(),
      ]);

      const seatCountInt = Number(seatCount);
      const baseMintPriceStr = formatEther(baseMintPrice);
      const vipMintPriceStr = formatEther(vipMintPrice);

      // VIP struct: ethers v6 decodes as properties
      const vipConfig = {
        vipEnabled: vipConfigStruct.vipEnabled,
        totalVIPSeats: Number(vipConfigStruct.totalVIPSeats),
        vipSeatStart: Number(vipConfigStruct.vipSeatStart),
        vipSeatEnd: Number(vipConfigStruct.vipSeatEnd),
      };

      setEventInfo({
        venue,
        description,
        seatCount: seatCountInt,
        baseMintPrice: baseMintPriceStr,
        vipMintPrice: vipMintPriceStr,
        vipConfig,
      });

      // Generate seats
      const seatData = [];
      for (let i = 1; i <= seatCountInt; i++) {
        const isMinted = await eventContract.seatMinted(i);
        const isVIP = vipConfig.vipEnabled && i >= vipConfig.vipSeatStart && i <= vipConfig.vipSeatEnd;
        seatData.push({
          number: i,
          isVIP,
          isMinted,
          price: isVIP ? vipMintPriceStr : baseMintPriceStr,
        });
      }
      setSeats(seatData);
    } catch (error) {
      console.error('Error fetching event info:', error);
      toast.error('Failed to load event information');
    }
  };

  const mintTicket = async () => {
    if (!selectedSeat) return;

    setLoading(true);
    try {
      const provider = new BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const eventContract = new Contract(eventAddress, EVENT_TICKET_ABI, signer);

      const seatPrice = parseEther(selectedSeat.price);
      const tx = await eventContract.mintTicket(eventInfo.venue, selectedSeat.number, {
        value: seatPrice,
      });

      await tx.wait();
      toast.success(`Ticket minted for seat ${selectedSeat.number}!`);

      // Refresh seat availability
      fetchEventInfo();
      setSelectedSeat(null);
    } catch (error) {
      console.error('Error minting ticket:', error);
      toast.error('Failed to mint ticket');
    }
    setLoading(false);
  };

  if (!eventInfo) {
    return <div className="loading">Loading event information...</div>;
  }

  return (
    <div className="book-seat-container">
      <div className="event-header">
        <h1>{eventInfo.venue}</h1>
        <p>{eventInfo.description}</p>
      </div>

      <div className="seat-selection">
        <div className="seat-map">
          <div className="stage">STAGE</div>
          <div className="seats-grid">
            {seats.map((seat) => (
              <div
                key={seat.number}
                className={`seat ${seat.isVIP ? 'vip' : 'regular'} ${seat.isMinted ? 'taken' : 'available'} ${selectedSeat?.number === seat.number ? 'selected' : ''}`}
                onClick={() => !seat.isMinted && setSelectedSeat(seat)}
              >
                {seat.number}
              </div>
            ))}
          </div>

          <div className="legend">
            <div className="legend-item">
              <div className="seat regular available"></div>
              <span>Regular ({eventInfo.baseMintPrice} AVAX)</span>
            </div>
            <div className="legend-item">
              <div className="seat vip available"></div>
              <span>VIP ({eventInfo.vipMintPrice} AVAX)</span>
            </div>
            <div className="legend-item">
              <div className="seat taken"></div>
              <span>Taken</span>
            </div>
          </div>
        </div>

        <div className="booking-panel">
          {selectedSeat ? (
            <div className="selected-seat-info">
              <h3>Selected Seat</h3>
              <div className="seat-details">
                <p>Seat Number: <strong>{selectedSeat.number}</strong></p>
                <p>Type: <strong>{selectedSeat.isVIP ? 'VIP' : 'Regular'}</strong></p>
                <p>Price: <strong>{selectedSeat.price} AVAX</strong></p>
              </div>

              <button 
                onClick={mintTicket} 
                className="mint-btn"
                disabled={loading}
              >
                {loading ? 'Minting...' : `Book for ${selectedSeat.price} AVAX`}
              </button>
            </div>
          ) : (
            <div className="no-selection">
              <p>Select a seat to book your ticket</p>
            </div>
          )}
        </div>
      </div>

      {/* CSS remains unchanged */}
      <style jsx>{`
        .book-seat-container { padding: 2rem; max-width: 1200px; margin: 0 auto; }
        .event-header { text-align: center; margin-bottom: 3rem; }
        .event-header h1 { font-size: 2.5rem; margin-bottom: 0.5rem; }
        .seat-selection { display: grid; grid-template-columns: 2fr 1fr; gap: 3rem; }
        .seat-map { background: #2d2d2d; padding: 2rem; border-radius: 12px; border:1px solid #404040; }
        .stage { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-align: center; padding: 1rem; border-radius: 8px; margin-bottom: 2rem; font-weight: bold; }
        .seats-grid { display: grid; grid-template-columns: repeat(10, 1fr); gap: 8px; margin-bottom: 2rem; }
        .seat { width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; border-radius: 6px; font-size: 12px; font-weight: bold; cursor: pointer; transition: all 0.2s; }
        .seat.regular.available { background: rgba(33,150,243,0.15); border: 2px solid #2196f3; color: #bbdefb; }
        .seat.vip.available { background: rgba(255,152,0,0.15); border: 2px solid #ff9800; color: #ffd180; }
        .seat.taken { background: rgba(244,67,54,0.15); border: 2px solid #f44336; color: #ef9a9a; cursor: not-allowed; }
        .seat.selected { background: rgba(76,175,80,0.2); border: 2px solid #4caf50; color: #c8e6c9; transform: scale(1.1); }
        .seat:hover:not(.taken) { transform: scale(1.05); }
        .legend { display: flex; gap: 2rem; justify-content: center; }
        .legend-item { display: flex; align-items: center; gap: 0.5rem; }
        .booking-panel { background: #2d2d2d; padding: 2rem; border-radius: 12px; border:1px solid #404040; height: fit-content; }
        .selected-seat-info h3 { margin-bottom: 1rem; text-align: center; }
        .seat-details { margin-bottom: 2rem; }
        .seat-details p { display: flex; justify-content: space-between; margin-bottom: 0.5rem; }
        .mint-btn { width: 100%; background: #2081e2; color: white; border: none; padding: 1rem; border-radius: 8px; font-size: 1.1rem; font-weight: bold; cursor: pointer; transition: background 0.2s; }
        .mint-btn:hover:not(:disabled) { background: #1868b7; }
        .mint-btn:disabled { background: #ccc; cursor: not-allowed; }
        .no-selection { text-align: center; color: #cbd5e1; font-style: italic; }
        .loading { text-align: center; padding: 3rem; font-size: 1.2rem; }
      `}</style>
    </div>
  );
}
