import { useSyncExternalStore } from 'react';
const EVENT = 'soundcapsule:piano-preferences';
const cache = new Map();
const defaults = { volume: 55, muted: false, error: '' };
function key(userId) { return `soundcapsule:piano-settings:${userId}`; }
function snapshot(userId) {
  let raw;
  try { raw = localStorage.getItem(key(userId)); } catch { raw = undefined; }
  const previous = cache.get(userId);
  if (previous && previous.raw === raw) return previous.value;
  let value = { ...defaults };
  try {
    const data = raw ? JSON.parse(raw) : {};
    if (typeof data.volume === 'number' && Number.isFinite(data.volume)) value.volume = Math.max(0, Math.min(100, data.volume));
    if (typeof data.muted === 'boolean') value.muted = data.muted;
    if (raw === undefined) throw new Error();
  } catch { value.error = '피아노 설정을 불러오지 못했어요. 저장소 접근을 확인해 주세요.'; }
  cache.set(userId, { raw, value }); return value;
}
function subscribe(callback) {
  window.addEventListener(EVENT, callback); window.addEventListener('storage', callback);
  return () => { window.removeEventListener(EVENT, callback); window.removeEventListener('storage', callback); };
}
export function usePianoPreferences(userId) {
  let sessionId;
  try { sessionId = JSON.parse(localStorage.getItem('soundcapsule:session') || 'null')?.id; } catch {}
  const owner = userId || sessionId || 'anonymous';
  const value = useSyncExternalStore(subscribe, () => snapshot(owner));
  const update = (field, next) => {
    const current = snapshot(owner);
    const candidate = { volume: current.volume, muted: current.muted, [field]: typeof next === 'function' ? next(current[field]) : next };
    if (!Number.isFinite(candidate.volume) || candidate.volume < 0 || candidate.volume > 100 || typeof candidate.muted !== 'boolean') return;
    try { localStorage.setItem(key(owner), JSON.stringify(candidate)); cache.delete(owner); }
    catch { cache.set(owner, { raw: cache.get(owner)?.raw, value: { ...current, error: '설정을 저장하지 못했어요. 저장 공간과 브라우저 설정을 확인해 주세요.' } });
    }
    window.dispatchEvent(new Event(EVENT));
  };
  return { ...value, setVolume: next => update('volume', next), setMuted: next => update('muted', next) };
}
