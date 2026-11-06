import { useEffect, useRef, useState } from 'react';
import { loadGoogleMaps } from './googleMapsLoader.js';

const KOREA_CENTER = { lat: 36.35, lng: 127.85 };
function markerContent(place, active = false) {
  const marker = document.createElement('button');
  marker.type = 'button';
  marker.className = `google-record-marker${active ? ' active' : ''}`;
  marker.setAttribute('aria-label', `${place.name}, 녹음 ${place.recordings.length}개`);
  const count = document.createElement('span');
  count.textContent = String(place.recordings.length);
  const label = document.createElement('b');
  label.textContent = place.city || place.name;
  marker.append(count, label);
  return marker;
}

export default function GoogleKoreaMap({ places, selectedPlace, onSelect, currentPosition, searchRequest }) {
  const canvasRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const currentMarkerRef = useRef(null);
  const [status, setStatus] = useState(import.meta.env.VITE_GOOGLE_MAPS_API_KEY ? 'loading' : 'missing-key');

  useEffect(() => {
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    if (!apiKey || !canvasRef.current) return;
    let cancelled = false;

    loadGoogleMaps().then(async maps => {
      await maps.importLibrary('maps');
      await maps.importLibrary('marker');
      if (cancelled || !canvasRef.current) return;
      mapRef.current = new maps.Map(canvasRef.current, {
        center: KOREA_CENTER,
        zoom: 7,
        mapId: 'DEMO_MAP_ID',
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        clickableIcons: false,
        gestureHandling: 'greedy',
      });
      setStatus('ready');
    }).catch(error => {
      if (!cancelled) setStatus(error.message || 'error');
    });

    return () => {
      cancelled = true;
      markersRef.current.forEach(marker => { marker.map = null; });
      markersRef.current = [];
      if (currentMarkerRef.current) currentMarkerRef.current.map = null;
    };
  }, []);

  useEffect(() => {
    if (status !== 'ready' || !mapRef.current || !window.google?.maps?.marker) return;
    markersRef.current.forEach(marker => { marker.map = null; });
    markersRef.current = places.map(place => {
      const content = markerContent(place, selectedPlace === place.key);
      const marker = new window.google.maps.marker.AdvancedMarkerElement({
        map: mapRef.current,
        position: { lat: place.latitude, lng: place.longitude },
        title: `${place.name} · 녹음 ${place.recordings.length}개`,
        content,
      });
      marker.addListener('click', () => onSelect(place));
      return marker;
    });
    if (places.length && !selectedPlace) {
      const bounds = new window.google.maps.LatLngBounds();
      places.forEach(place => bounds.extend({ lat: place.latitude, lng: place.longitude }));
      mapRef.current.fitBounds(bounds, 70);
      if (places.length === 1) window.google.maps.event.addListenerOnce(mapRef.current, 'idle', () => mapRef.current.setZoom(Math.min(mapRef.current.getZoom(), 13)));
    }
  }, [places, selectedPlace, onSelect, status]);

  useEffect(() => {
    if (status !== 'ready' || !mapRef.current || !window.google?.maps?.marker) return;
    if (currentMarkerRef.current) currentMarkerRef.current.map = null;
    if (!currentPosition) return;
    const dot = document.createElement('span');
    dot.className = 'google-current-location';
    dot.setAttribute('aria-label', '현재 위치');
    currentMarkerRef.current = new window.google.maps.marker.AdvancedMarkerElement({
      map: mapRef.current,
      position: { lat: currentPosition.latitude, lng: currentPosition.longitude },
      title: '현재 위치',
      content: dot,
      zIndex: 10,
    });
  }, [currentPosition, status]);

  useEffect(() => {
    if (!selectedPlace || !mapRef.current) return;
    const place = places.find(item => item.key === selectedPlace);
    if (!place) return;
    mapRef.current.panTo({ lat: place.latitude, lng: place.longitude });
    if (mapRef.current.getZoom() < 11) mapRef.current.setZoom(11);
  }, [places, selectedPlace]);

  useEffect(()=>{if(!searchRequest||status!=='ready'||!mapRef.current)return;loadGoogleMaps().then(async maps=>{const {Geocoder}=await maps.importLibrary('geocoding');new Geocoder().geocode({address:searchRequest},(results,resultStatus)=>{if(resultStatus==='OK'&&results?.[0]){mapRef.current.panTo(results[0].geometry.location);mapRef.current.setZoom(12)}})}).catch(()=>{})},[searchRequest,status]);

  if (status === 'missing-key') return <div className="google-map-state error"><b>Google Maps API 키가 필요해요.</b><span><code>.env.local</code>에 키를 넣고 개발 서버를 다시 시작해 주세요.</span></div>;
  if (status !== 'loading' && status !== 'ready') return <div className="google-map-state error"><b>Google 지도를 불러오지 못했어요.</b><span>{status}</span><button onClick={() => location.reload()}>다시 시도</button></div>;

  return <div className="google-map-stage">
    <div ref={canvasRef} className="google-map-canvas" aria-label="내 소리 Google 지도" />
    {status === 'loading' && <div className="google-map-loading"><i/><span>Google 지도를 불러오는 중…</span></div>}
    <div className="google-map-summary"><small>나의 소리 지도</small><strong>{places.length}개 장소 · {places.reduce((sum, place) => sum + place.recordings.length, 0)}개 녹음</strong></div>
    <div className="google-map-legend"><span><i className="legend-record"/>소리 기록</span><span><i className="legend-current"/>현재 위치</span></div>
  </div>;
}
