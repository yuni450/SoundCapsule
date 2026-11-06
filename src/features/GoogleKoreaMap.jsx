import { useEffect, useRef, useState } from 'react';

const KOREA_CENTER = { lat: 36.35, lng: 127.85 };
let mapsLoader;

function loadGoogleMaps(apiKey) {
  if (typeof window.google?.maps?.importLibrary === 'function') return Promise.resolve(window.google.maps);
  if (mapsLoader) return mapsLoader;

  mapsLoader = new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-soundcapsule-google-maps]');
    const script = existing || document.createElement('script');
    let attempts = 0;
    const waitUntilReady = () => {
      if (typeof window.google?.maps?.importLibrary === 'function') {
        resolve(window.google.maps);
        return;
      }
      if (attempts++ >= 100) {
        reject(new Error('Google Maps API를 초기화하지 못했어요.'));
        return;
      }
      window.setTimeout(waitUntilReady, 50);
    };
    const onError = () => reject(new Error('Google Maps API를 불러오지 못했어요.'));

    script.addEventListener('error', onError, { once: true });
    if (!existing) {
      script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=marker&v=weekly&loading=async`;
      script.async = true;
      script.dataset.soundcapsuleGoogleMaps = 'true';
      document.head.appendChild(script);
    }
    waitUntilReady();
  });

  return mapsLoader;
}

function markerContent(place, active = false) {
  const marker = document.createElement('button');
  marker.type = 'button';
  marker.className = `google-record-marker${active ? ' active' : ''}`;
  marker.setAttribute('aria-label', `${place.name}, 녹음 ${place.recordings.length}개`);
  marker.innerHTML = `<span>${place.recordings.length}</span><b>${place.city || place.name}</b>`;
  return marker;
}

export default function GoogleKoreaMap({ places, selectedPlace, onSelect, currentPosition }) {
  const canvasRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const currentMarkerRef = useRef(null);
  const [status, setStatus] = useState(import.meta.env.VITE_GOOGLE_MAPS_API_KEY ? 'loading' : 'missing-key');

  useEffect(() => {
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    if (!apiKey || !canvasRef.current) return;
    let cancelled = false;

    loadGoogleMaps(apiKey).then(async maps => {
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

  if (status === 'missing-key') return <div className="google-map-state error"><b>Google Maps API 키가 필요해요.</b><span><code>.env.local</code>에 키를 넣고 개발 서버를 다시 시작해 주세요.</span></div>;
  if (status !== 'loading' && status !== 'ready') return <div className="google-map-state error"><b>Google 지도를 불러오지 못했어요.</b><span>{status}</span><button onClick={() => location.reload()}>다시 시도</button></div>;

  return <div className="google-map-stage">
    <div ref={canvasRef} className="google-map-canvas" aria-label="대한민국 Google 지도" />
    {status === 'loading' && <div className="google-map-loading"><i/><span>Google 지도를 불러오는 중…</span></div>}
    <div className="google-map-summary"><small>대한민국 소리 지도</small><strong>{places.length}개 장소 · {places.reduce((sum, place) => sum + place.recordings.length, 0)}개 녹음</strong></div>
    <div className="google-map-legend"><span><i className="legend-record"/>소리 기록</span><span><i className="legend-current"/>현재 위치</span></div>
  </div>;
}
