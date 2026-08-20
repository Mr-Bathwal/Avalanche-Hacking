import React from 'react';
import { WagmiProvider } from 'wagmi';
import { RainbowKitProvider, darkTheme } from '@rainbow-me/rainbowkit';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from 'sonner';
import { config } from './lib/wagmi';

import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import Home from './pages/Home';
import Dashboard from './components/Dashboard';
import CreateEvent from './components/CreateEvent';
import EventDetails from './pages/EventDetails';
import AuctionChamber from './components/AuctionChamber';
import Profile from './components/Profile';
import BookSeat from './pages/BookSeat';
import BuyNFT from './pages/BuyNFT';
import EventMarketplace from './components/EventMarketplaceDetails';



import '@rainbow-me/rainbowkit/styles.css';

function App() {
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const toggleSidebar = () => setSidebarOpen((v) => !v);

  return (
    <WagmiProvider config={config}>
      <RainbowKitProvider
        theme={darkTheme({
          accentColor: '#7b3cf0',
          accentColorForeground: 'white',
          borderRadius: 'medium',
        })}
        modalSize="compact"
      >
        <BrowserRouter basename={import.meta.env.BASE_URL}>
          <div className="app-container">
            <Navbar onToggleSidebar={toggleSidebar} />
            <div className="main-layout">
              <Sidebar open={sidebarOpen} />
              <main className="content" onClick={() => sidebarOpen && setSidebarOpen(false)}>
                <Routes>
                  <Route path="/" element={<Home />} />
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/create-event" element={<CreateEvent />} />
                  <Route path="/event/:eventAddress" element={<EventDetails />} />
                  <Route path="/auction-chamber" element={<AuctionChamber />} />
                  <Route path="/profile" element={<Profile />} />
                  <Route path="/book-seat/:eventAddress" element={<BookSeat />} />
                  <Route path="/buy-nft/:eventAddress/:tokenId" element={<BuyNFT />} />
                  <Route path="/marketplace" element={<EventMarketplace />} />
                </Routes>
              </main>
            </div>
          </div>
          <Toaster position="bottom-right" />
        </BrowserRouter>
      </RainbowKitProvider>
    </WagmiProvider>
  );
}

export default App;
