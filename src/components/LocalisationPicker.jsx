import React, { useCallback, useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import './LocalisationPicker.css';
import { t, langueActuelle } from '../../../i18n';

// Fix des icônes Leaflet par défaut (souci connu avec les bundlers)
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const DEFAULT_CENTER = [36.8065, 10.1815]; // Tunis

// Composant interne pour capter les clics sur la carte
function ClickHandler({ onClick }) {
  useMapEvents({
    click: (e) => onClick(e.latlng.lat, e.latlng.lng),
  });
  return null;
}

export default function LocalisationPicker({ value, onChange }) {
  // Les adresses renvoyées par Nominatim suivent la langue de l'application
  // (l'application est remontée à chaque changement de langue)
  const langueAdresses = { ar: 'ar,fr', en: 'en,fr' }[langueActuelle()] || 'fr';
  const [marker, setMarker] = useState(
    value?.latitude != null && value?.longitude != null
      ? [Number(value.latitude), Number(value.longitude)]
      : null
  );
  const [mapCenter, setMapCenter] = useState(marker || DEFAULT_CENTER);
  const [address, setAddress] = useState(value?.localisation || '');
  const [searching, setSearching] = useState(false);

  // Sync avec la valeur parente
  useEffect(() => {
    if (value?.latitude != null && value?.longitude != null) {
      const pos = [Number(value.latitude), Number(value.longitude)];
      setMarker(pos);
      setMapCenter(pos);
    }
    setAddress(value?.localisation || '');
  }, [value?.localisation, value?.latitude, value?.longitude]);

  // Reverse geocoding via Nominatim (OpenStreetMap)
  const reverseGeocode = useCallback(async (lat, lng) => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1&accept-language=${langueAdresses}`,
        {
          headers: {
            'User-Agent': 'MonAppVehicules/1.0 (contact@monapp.com)', // Obligatoire pour Nominatim
          },
        }
      );
      if (!res.ok) throw new Error('Erreur Nominatim');
      const data = await res.json();
      return data.display_name || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    } catch (err) {
      console.error('Reverse geocoding échoué :', err);
      return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    }
  }, [langueAdresses]);

  const handleMapClick = useCallback(
    async (lat, lng) => {
      setMarker([lat, lng]);
      const addr = await reverseGeocode(lat, lng);
      setAddress(addr);
      onChange?.({ localisation: addr, latitude: lat, longitude: lng });
    },
    [onChange, reverseGeocode]
  );

  // Recherche d'adresse via Nominatim (forward geocoding)
  const handleSearch = async () => {
    if (!address.trim()) return;
    setSearching(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1&addressdetails=1&accept-language=${langueAdresses}`,
        {
          headers: {
            'User-Agent': 'MonAppVehicules/1.0 (contact@monapp.com)',
          },
        }
      );
      const data = await res.json();
      if (data?.[0]) {
        const lat = parseFloat(data[0].lat);
        const lng = parseFloat(data[0].lon);
        setMarker([lat, lng]);
        setMapCenter([lat, lng]);
        const addr = data[0].display_name;
        setAddress(addr);
        onChange?.({ localisation: addr, latitude: lat, longitude: lng });
      }
    } catch (err) {
      console.error('Recherche échouée :', err);
    } finally {
      setSearching(false);
    }
  };

  // Géolocalisation navigateur
  const handleUseGeolocation = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setMarker([lat, lng]);
        setMapCenter([lat, lng]);
        const addr = await reverseGeocode(lat, lng);
        setAddress(addr);
        onChange?.({ localisation: addr, latitude: lat, longitude: lng });
      },
      (err) => console.error('Géolocalisation refusée :', err)
    );
  };

  return (
    <div className="locpicker">
      <div className="locpicker-search">
        <input
          type="text"
          className="locpicker-input"
          placeholder={t('Rechercher une adresse...')}
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleSearch())}
        />
        <button
          type="button"
          className="locpicker-search-btn"
          onClick={handleSearch}
          disabled={searching}
          title={t('Rechercher')}
          aria-label={t('Rechercher')}
        >
          {searching ? '...' : '🔍'}
        </button>
        <button
          type="button"
          className="locpicker-geo-btn"
          title={t('Utiliser ma position')}
          aria-label={t('Utiliser ma position')}
          onClick={handleUseGeolocation}
        >
          📍
        </button>
      </div>

      <div className="locpicker-map">
        <MapContainer
          center={mapCenter}
          zoom={marker ? 15 : 11}
          style={{ width: '100%', height: '240px', borderRadius: '10px' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <ClickHandler onClick={handleMapClick} />
          {marker && (
            <Marker position={marker}>
              <Popup>{address || t('Position sélectionnée')}</Popup>
            </Marker>
          )}
        </MapContainer>
      </div>

      {marker && (
        <p className="locpicker-coords">
          {t('Coordonnées :')} <bdi dir="ltr"><strong>{marker[0].toFixed(5)}</strong>, <strong>{marker[1].toFixed(5)}</strong></bdi>
        </p>
      )}
    </div>
  );
}