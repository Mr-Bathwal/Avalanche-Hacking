import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useGeolocation } from "../hooks/useGeolocation";
import { fetchAllNearbyEvents, getCityFromCoordinates, fetchEventsByCity } from "../utils/nearbyEvents";

const NearbyEvents = () => {
  const { location, error, loading, getCurrentLocation, resetLocation } = useGeolocation();
  const [nearbyEvents, setNearbyEvents] = useState([]);
  const [isEnabled, setIsEnabled] = useState(false);
  const [maxDistance, setMaxDistance] = useState(50); // Default to 50km
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [userCity, setUserCity] = useState(null);
  const [eventSources, setEventSources] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    if (location && isEnabled) {
      fetchEvents();
      getUserCity();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location, isEnabled, maxDistance]);

  const fetchEvents = async () => {
    setLoadingEvents(true);
    try {
      console.log(`Fetching events within ${maxDistance}km radius`);
      const events = await fetchAllNearbyEvents(
        location.latitude, 
        location.longitude, 
        maxDistance
      );
      setNearbyEvents(events);
      
      // Track sources
      const sources = [...new Set(events.map(e => e.source))];
      setEventSources(sources);
      
    } catch (err) {
      console.error('Failed to fetch events:', err);
      setNearbyEvents([]);
    } finally {
      setLoadingEvents(false);
    }
  };

  const getUserCity = async () => {
    try {
      const city = await getCityFromCoordinates(location.latitude, location.longitude);
      setUserCity(city);
    } catch (err) {
      console.error('Failed to get city:', err);
    }
  };

  const handleEnableLocation = () => {
    setIsEnabled(true);
    getCurrentLocation();
  };

  const handleDisableLocation = () => {
    setIsEnabled(false);
    resetLocation();
    setNearbyEvents([]);
    setUserCity(null);
    setEventSources([]);
  };

  const handleSearchByCity = async () => {
    if (!userCity) return;
    
    setLoadingEvents(true);
    try {
      const events = await fetchEventsByCity(userCity);
      setNearbyEvents(events);
      const sources = [...new Set(events.map(e => e.source))];
      setEventSources(sources);
    } catch (err) {
      console.error('Failed to fetch city events:', err);
    } finally {
      setLoadingEvents(false);
    }
  };

  // Handle event click - either mint NFT or go to original site
 const handleEventClick = (event) => {
  if (event.source === 'Community') {
    // Navigate to nearby event details instead of regular event details
    navigate(`/nearby-event/${event.id}`);
  } else if (event.url && window.confirm('Open original event page? Cancel to mint NFT instead.')) {
    window.open(event.url, '_blank');
  } else {
    navigate('/mint-external-event', { 
      state: { 
        eventData: event,
        userLocation: location
      } 
    });
  }
};

  const getEventStatus = (event) => {
    const now = new Date();
    const eventDate = new Date(event.date);
    const timeDiff = eventDate - now;
    
    if (event.status === 'live') return { text: 'Live Now', class: 'live' };
    if (timeDiff < 0) return { text: 'Past', class: 'past' };
    if (timeDiff < 3600000) return { text: 'Starting Soon', class: 'soon' };
    if (timeDiff < 86400000) return { text: 'Today', class: 'today' };
    return { text: 'Upcoming', class: 'upcoming' };
  };

  const formatDistance = (distance) => {
    if (distance < 1) return `${Math.round(distance * 1000)}m away`;
    if (distance < 10) return `${distance}km away`;
    return `${Math.round(distance)}km away`;
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };


  return (
    <div className="section nearby-events-section">
      <div className="section-head">
        <div className="section-title-group">
          <h2>📍 Nearby Events</h2>
          <span className="muted">
            {userCity ? `Showing events near ${userCity}` : 'Discover events happening around you'}
          </span>
          {eventSources.length > 0 && (
            <div className="event-sources">
              <span className="sources-label">Sources:</span>
              {eventSources.map(source => (
                <span key={source} className="source-badge">{source}</span>
              ))}
            </div>
          )}
          {nearbyEvents.length > 0 && (
            <div className="search-stats">
              <span className="stats-text">
                Found {nearbyEvents.length} events within {maxDistance}km radius
              </span>
            </div>
          )}
        </div>
        <div className="location-controls">
          {!isEnabled ? (
            <button className="btn btn-location" onClick={handleEnableLocation}>
              📍 Enable Location
            </button>
          ) : (
            <div className="location-actions">
              <select 
                className="distance-selector"
                value={maxDistance}
                onChange={(e) => setMaxDistance(parseInt(e.target.value))}
              >
                <option value={50}>Within 50km (Local)</option>
                <option value={100}>Within 100km (Metro)</option>
                <option value={200}>Within 200km (Regional)</option>
                <option value={500}>Within 500km (State-wide)</option>
              </select>
              <button className="btn btn-secondary btn-small" onClick={handleDisableLocation}>
                ✕ Disable
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Location Permission States */}
      {!isEnabled && (
        <div className="location-prompt">
          <div className="prompt-icon">🗺️</div>
          <div className="prompt-content">
            <h4>Discover Events Near You</h4>
            <p>Enable location access to find amazing events from Eventbrite, Meetup and local communities</p>
            <div className="prompt-features">
              <div className="feature">📍 Search up to 500km radius</div>
              <div className="feature">🎫 Mint NFT tickets for any event</div>
              <div className="feature">⚡ Real-time event updates</div>
            </div>
          </div>
        </div>
      )}

      {loading && (
        <div className="location-loading">
          <div className="loading-spinner">🌍</div>
          <p>Getting your location...</p>
        </div>
      )}

      {loadingEvents && (
        <div className="events-loading">
          <div className="loading-spinner">🔍</div>
          <p>Searching for events within {maxDistance}km...</p>
        </div>
      )}

      {error && (
        <div className="location-error">
          <div className="error-icon">⚠️</div>
          <div className="error-content">
            <h4>Location Access Denied</h4>
            <p>{error}</p>
            <div className="error-actions">
              <button className="btn btn-small" onClick={getCurrentLocation}>
                🔄 Try Again
              </button>
              {userCity && (
                <button className="btn btn-secondary btn-small" onClick={handleSearchByCity}>
                  📍 Search {userCity}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Nearby Events Display */}
      {isEnabled && location && nearbyEvents.length > 0 && !loadingEvents && (
        <div className="nearby-events-grid">
          {nearbyEvents.map(event => {
            const status = getEventStatus(event);
            return (
              <div 
                key={event.id} 
                className="nearby-event-card"
                onClick={() => handleEventClick(event)}
              >
                <div className="event-image">
                  <img src={event.image} alt={event.name} />
                  <div className={`event-status ${status.class}`}>
                    {status.text}
                  </div>
                  <div className="event-distance">
                    {formatDistance(event.distance)}
                  </div>
                  <div className="event-source">
                    {event.source}
                  </div>
                </div>
                <div className="event-info">
                  <h4 className="event-title">{event.name}</h4>
                  <div className="event-venue">
                    <span className="venue-icon">📍</span>
                    {event.venue}
                  </div>
                  <div className="event-date">
                    <span className="date-icon">📅</span>
                    {formatDate(event.date)}
                  </div>
                  <div className="event-details">
                    <div className="event-price">
                      {event.currency || '₹'}{event.price ? Math.round(event.price) : 'Free'}
                    </div>
                    <div className="event-attendees">👥 {event.attendees}</div>
                  </div>
                  {event.earlyBird?.active && (
                    <div className="early-bird-tag">
                      🐦 {event.earlyBird.discount}% OFF
                    </div>
                  )}
                  <div className="event-actions">
                  {event.source === 'Community' ? (
    <button className="btn btn-primary btn-small">
      🎫 View Event Details
    </button>
  ) : (
    <div className="external-event-actions">
      <button className="btn btn-primary btn-small">
        🎟️ Mint NFT Ticket
      </button>
      {event.url && (
        <button 
          className="btn btn-secondary btn-small"
          onClick={(e) => {
            e.stopPropagation();
            window.open(event.url, '_blank');
          }}
        >
          🔗 Original Site
        </button>
      )}
    </div>
  )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* No Events Found */}
      {isEnabled && location && nearbyEvents.length === 0 && !loading && !loadingEvents && (
        <div className="no-events-found">
          <div className="no-events-icon">🔍</div>
          <div className="no-events-content">
            <h4>No Events Found</h4>
            <p>No events found within {maxDistance}km. Try expanding your search radius.</p>
            <div className="expand-search-actions">
              <button 
                className="btn btn-secondary"
                onClick={() => setMaxDistance(Math.min(maxDistance * 2, 500))}
              >
                🔍 Search Wider ({Math.min(maxDistance * 2, 500)}km)
              </button>
              {userCity && (
                <button className="btn btn-primary" onClick={handleSearchByCity}>
                  📍 Show {userCity} Events
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NearbyEvents;
