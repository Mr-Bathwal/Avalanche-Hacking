import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { useConnectModal } from '@rainbow-me/rainbowkit';
import { Link } from 'react-router-dom';
import { BrowserProvider, Contract, formatEther } from 'ethers';
import { CONTRACT_ADDRESSES, EVENT_FACTORY_ABI, EVENT_TICKET_ABI } from '../lib/contracts';
import { sampleCollections } from '../utils/sampleAssets';
import { demoEvents } from '../utils/demoData';
import TicketHero3D from '../components/TicketHero3D';

export default function Home() {
  const { isConnected } = useAccount();
  const { openConnectModal } = useConnectModal();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isConnected) fetchEvents();
  }, [isConnected]);

  // Reveal-on-scroll for the story sections
  useEffect(() => {
    const els = document.querySelectorAll('.lp-reveal');
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('in');
            io.unobserve(e.target);
          }
        }),
      { threshold: 0.16 }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [isConnected, loading]);

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
          } catch {
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

  const connect = () => openConnectModal?.();

  const FEATURES = [
    { icon: '🎫', title: 'Every ticket is an NFT', body: 'Each seat is an ERC-721 with the tier, venue and price baked in — impossible to counterfeit or duplicate.' },
    { icon: '🛡️', title: 'Resale capped on-chain', body: 'Scalpers can’t mark tickets up. The contract rejects any resale above +20% of the last sale price.' },
    { icon: '⚡', title: 'Fair auctions & escrow', body: 'List at a fixed price or run an anti-snipe auction. Deposits settle in escrow, so trades stay safe.' },
  ];

  return (
    <div className="lp">
      {/* ───────── HERO ───────── */}
      <section className="lp-hero">
        <TicketHero3D />
        <div className="lp-hero-overlay" />
        <div className="lp-hero-content">
          <span className="lp-eyebrow">Avalanche · On-chain ticketing</span>
          <h1 className="lp-title">
            Tickets that<br /><span className="grad">can’t be scalped.</span>
          </h1>
          <p className="lp-sub">
            TicketVerse mints every ticket as an NFT and caps resale at <b>+20%</b> — enforced on-chain,
            not on trust. Buy, verify and resell from one dApp.
          </p>
          <div className="lp-cta">
            {isConnected ? (
              <a href="#events" className="lp-btn primary">Explore events ↓</a>
            ) : (
              <button className="lp-btn primary" onClick={connect}>Connect wallet</button>
            )}
            <Link to="/create-event" className="lp-btn ghost">Create an event</Link>
          </div>
          <div className="lp-scrollcue">▼ &nbsp;scroll to see how it works</div>
        </div>
      </section>

      {/* ───────── STORY ───────── */}
      <section className="lp-section">
        <p className="lp-kicker lp-reveal">Why it’s different</p>
        <h2 className="lp-h2 lp-reveal">Anti-scalping, built into the chain.</h2>
        <div className="lp-grid3">
          {FEATURES.map((f) => (
            <div key={f.title} className="lp-card lp-reveal">
              <div className="lp-card-ico">{f.icon}</div>
              <h3>{f.title}</h3>
              <p>{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ───────── STATS ───────── */}
      <section className="lp-section">
        <div className="lp-stats lp-reveal">
          <div className="lp-stat"><b>+20%</b><span>Max resale markup</span></div>
          <div className="lp-stat"><b>{isConnected ? events.length : '∞'}</b><span>Events on-chain</span></div>
          <div className="lp-stat"><b>ERC-721</b><span>Every ticket</span></div>
          <div className="lp-stat"><b>Fuji</b><span>Avalanche testnet</span></div>
        </div>
      </section>

      {/* ───────── CONNECTED: EVENTS ───────── */}
      {isConnected && (
        <section id="events" className="lp-section">
          <div className="lp-events-head lp-reveal">
            <div>
              <p className="lp-kicker" style={{ margin: 0 }}>Live now</p>
              <h2 className="lp-h2" style={{ margin: '6px 0 0' }}>Events</h2>
            </div>
            <Link to="/create-event" className="lp-btn primary sm">Create event</Link>
          </div>

          {loading ? (
            <div className="lp-grid3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="lp-card lp-skeleton" />
              ))}
            </div>
          ) : events.length === 0 ? (
            <div className="lp-empty lp-reveal">
              <h3>No events yet</h3>
              <p>Be the first to launch one.</p>
              <Link to="/create-event" className="lp-btn primary sm">Create the first event</Link>
            </div>
          ) : (
            <div className="lp-grid3">
              {events.map((event, idx) => {
                const showcase = sampleCollections[idx % sampleCollections.length];
                return (
                  <Link to={`/event/${event.address}`} key={event.address} className="lp-event lp-reveal">
                    <div className="lp-event-img" style={{ backgroundImage: `url(${showcase.tiles[0]})` }} />
                    <div className="lp-event-body">
                      <h3>{event.venue} <span className="lp-verified">✓</span></h3>
                      <p className="lp-event-desc">{event.description}</p>
                      <div className="lp-event-meta">
                        <span>{event.startTime.toLocaleDateString()}</span>
                        <span className="lp-price">{Number(event.price).toFixed(3)} AVAX</span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* ───────── NOT CONNECTED: FEATURED (demo) ───────── */}
      {!isConnected && (
        <section className="lp-section">
          <p className="lp-kicker lp-reveal">Preview</p>
          <h2 className="lp-h2 lp-reveal">A taste of what’s on.</h2>
          <div className="sc-grid">
            {demoEvents.map((ev) => (
              <div className="sc-card lp-reveal" key={ev.id}>
                <div className="sc-card-media" style={{ backgroundImage: `url(${ev.image})` }}>
                  <span className="sc-card-tag">{ev.tier}</span>
                </div>
                <div className="sc-card-body">
                  <h3>{ev.name}</h3>
                  <p className="sc-card-sub">{ev.venue} · {ev.city} · {ev.date}</p>
                  <div className="sc-card-foot">
                    <span className="sc-price">from {ev.priceFrom} AVAX</span>
                    <button className="sc-btn primary" onClick={connect}>Book</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <p style={{ textAlign: 'center', color: '#828aa3', fontSize: 13, marginTop: 18 }}>
            ✦ Demo data — connect a wallet to browse live on-chain events.
          </p>
        </section>
      )}

      {/* ───────── NOT CONNECTED: FINAL CTA ───────── */}
      {!isConnected && (
        <section className="lp-section">
          <div className="lp-final lp-reveal">
            <h2>Ready to look inside?</h2>
            <p>Connect a wallet on Avalanche Fuji to browse events, mint tickets and trade.</p>
            <button className="lp-btn primary" onClick={connect}>Connect wallet</button>
          </div>
        </section>
      )}

      <style>{`
        .lp { --v:#a78bfa; --b:#60a5fa; --t:#5eead4; --void:#08090f; --text:#c9cee0; --muted:#828aa3; --line:rgba(255,255,255,.09);
              position:relative; }
        .lp .grad { background:linear-gradient(100deg,#c9b6ff,#9fc3ff 45%,#9df0e4 80%);
              -webkit-background-clip:text;background-clip:text;color:transparent; }

        /* hero */
        .lp-hero { position:relative; min-height:92vh; display:flex; align-items:center; overflow:hidden;
              background:radial-gradient(120% 100% at 70% -10%, #141a33 0%, #0b0d18 55%, var(--void) 100%); }
        .lp-canvas { position:absolute; inset:0; z-index:0; }
        .lp-canvas canvas { display:block; width:100% !important; height:100% !important; }
        .lp-hero-overlay { position:absolute; inset:0; z-index:1; pointer-events:none;
              background:linear-gradient(90deg, rgba(8,9,15,.85) 0%, rgba(8,9,15,.35) 45%, rgba(8,9,15,0) 70%); }
        .lp-hero-content { position:relative; z-index:2; max-width:1100px; margin:0 auto; padding:0 32px; width:100%; }
        .lp-eyebrow { font-size:13px; letter-spacing:3px; text-transform:uppercase; color:var(--b); font-weight:600; }
        .lp-title { font-size:clamp(40px,7vw,84px); line-height:1.02; font-weight:800; margin:14px 0 0; color:#eef2ff; letter-spacing:-.02em; }
        .lp-sub { max-width:540px; margin-top:20px; font-size:clamp(15px,2vw,19px); color:var(--text); line-height:1.6; }
        .lp-sub b { color:#fff; }
        .lp-cta { display:flex; gap:14px; flex-wrap:wrap; margin-top:32px; }
        .lp-btn { display:inline-flex; align-items:center; justify-content:center; gap:8px; font-size:15px; font-weight:600;
              padding:14px 26px; border-radius:40px; border:1px solid var(--line); background:rgba(255,255,255,.04); color:#eef2ff;
              cursor:pointer; transition:.2s; text-decoration:none; }
        .lp-btn.sm { padding:10px 18px; font-size:14px; }
        .lp-btn.primary { border-color:transparent; background:linear-gradient(120deg,var(--v),var(--b)); color:#08090f; }
        .lp-btn:hover { transform:translateY(-2px); box-shadow:0 14px 34px -14px rgba(96,165,250,.6); }
        .lp-scrollcue { margin-top:48px; font-size:12px; letter-spacing:2px; color:var(--muted); animation:lpbob 2.4s ease-in-out infinite; }
        @keyframes lpbob { 50% { transform:translateY(6px); } }

        /* sections */
        .lp-section { max-width:1100px; margin:0 auto; padding:80px 32px; }
        .lp-kicker { font-size:12px; letter-spacing:3px; text-transform:uppercase; color:var(--v); font-weight:600; margin:0 0 8px; }
        .lp-h2 { font-size:clamp(26px,4vw,42px); font-weight:800; color:#eef2ff; margin:0 0 34px; letter-spacing:-.02em; }
        .lp-grid3 { display:grid; grid-template-columns:repeat(3,1fr); gap:20px; }
        .lp-card { background:rgba(255,255,255,.03); border:1px solid var(--line); border-radius:18px; padding:26px;
              transition:.25s; }
        .lp-card:hover { transform:translateY(-4px); border-color:rgba(255,255,255,.18); background:rgba(255,255,255,.05); }
        .lp-card-ico { font-size:30px; margin-bottom:14px; }
        .lp-card h3 { margin:0 0 8px; font-size:19px; color:#eef2ff; }
        .lp-card p { margin:0; color:var(--muted); font-size:14.5px; line-height:1.6; }

        .lp-stats { display:grid; grid-template-columns:repeat(4,1fr); gap:16px; background:rgba(255,255,255,.03);
              border:1px solid var(--line); border-radius:18px; padding:30px; }
        .lp-stat { text-align:center; }
        .lp-stat b { display:block; font-size:clamp(24px,4vw,38px); font-weight:800;
              background:linear-gradient(120deg,var(--v),var(--t)); -webkit-background-clip:text; background-clip:text; color:transparent; }
        .lp-stat span { font-size:12px; letter-spacing:1px; text-transform:uppercase; color:var(--muted); }

        .lp-events-head { display:flex; justify-content:space-between; align-items:flex-end; margin-bottom:26px; }
        .lp-event { display:block; background:rgba(255,255,255,.03); border:1px solid var(--line); border-radius:18px;
              overflow:hidden; text-decoration:none; color:inherit; transition:.25s; }
        .lp-event:hover { transform:translateY(-5px); border-color:rgba(255,255,255,.2); }
        .lp-event-img { height:170px; background-size:cover; background-position:center; }
        .lp-event-body { padding:18px; }
        .lp-event-body h3 { margin:0 0 6px; font-size:17px; color:#eef2ff; }
        .lp-event-desc { margin:0 0 14px; color:var(--muted); font-size:13.5px; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
        .lp-event-meta { display:flex; justify-content:space-between; font-size:13px; color:var(--muted); }
        .lp-price { color:var(--t); font-weight:600; }
        .lp-verified { color:var(--b); font-size:13px; }

        .lp-empty, .lp-final { text-align:center; background:rgba(255,255,255,.03); border:1px solid var(--line);
              border-radius:20px; padding:56px 24px; }
        .lp-empty h3, .lp-final h2 { color:#eef2ff; margin:0 0 8px; }
        .lp-empty p, .lp-final p { color:var(--muted); margin:0 0 22px; }

        .lp-skeleton { height:220px; position:relative; overflow:hidden; }
        .lp-skeleton::after { content:''; position:absolute; inset:0;
              background:linear-gradient(90deg,transparent,rgba(255,255,255,.06),transparent); animation:lpsh 1.3s infinite; }
        @keyframes lpsh { 100% { transform:translateX(100%); } }

        .lp-reveal { opacity:0; transform:translateY(26px); transition:opacity .7s ease, transform .7s ease; }
        .lp-reveal.in { opacity:1; transform:none; }

        @media (max-width:820px){ .lp-grid3{ grid-template-columns:1fr 1fr; } .lp-stats{ grid-template-columns:1fr 1fr; } }
        @media (max-width:560px){ .lp-grid3{ grid-template-columns:1fr; } .lp-hero-overlay{ background:linear-gradient(180deg, rgba(8,9,15,.4), rgba(8,9,15,.85)); } }
        @media (prefers-reduced-motion:reduce){ .lp-reveal{ opacity:1; transform:none; } .lp-scrollcue{ animation:none; } }
      `}</style>
    </div>
  );
}
