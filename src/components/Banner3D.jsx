import TicketHero3D from './TicketHero3D';

/** Reusable 3D header: the holographic ticket behind a title/subtitle. */
export default function Banner3D({ kicker, title, subtitle }) {
  return (
    <div className="sc-banner">
      <TicketHero3D />
      <div className="sc-banner-overlay" />
      <div className="sc-banner-content">
        {kicker && <div className="sc-kicker">{kicker}</div>}
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
    </div>
  );
}
