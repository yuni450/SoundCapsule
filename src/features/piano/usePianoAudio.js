import { usePianoPreferences } from '../../lib/pianoPreferences.js';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPianoAudio } from './audio.js';

export function usePianoAudio(userId) {
  const engine = useRef(null);
  const mounted = useRef(false);
  const timers = useRef(new Map());
  const { volume, setVolume, muted, setMuted, error: preferenceError } = usePianoPreferences(userId);
  const [error, setError] = useState('');
  const [playing, setPlaying] = useState(new Set());
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false; engine.current?.dispose(); engine.current = null;
      for (const timer of timers.current.values()) clearTimeout(timer);
      timers.current.clear();
    };
  }, []);
  useEffect(() => { engine.current?.setVolume(volume / 100, muted); }, [volume, muted]);
  const stopAll = useCallback(() => {
    engine.current?.stopAll();
    for (const timer of timers.current.values()) clearTimeout(timer);
    timers.current.clear(); setPlaying(new Set());
  }, []);
  useEffect(() => {
    const hidden = () => { if (document.hidden) stopAll(); };
    window.addEventListener('blur', stopAll); document.addEventListener('visibilitychange', hidden);
    return () => { window.removeEventListener('blur', stopAll); document.removeEventListener('visibilitychange', hidden); };
  }, [stopAll]);
  const play = (weekday) => {
    setError('');
    setPlaying(previous => new Set(previous).add(weekday));
    clearTimeout(timers.current.get(weekday));
    timers.current.set(weekday, setTimeout(() => {
      timers.current.delete(weekday);
      if (mounted.current) setPlaying(previous => { const next = new Set(previous); next.delete(weekday); return next; });
    }, 180));
    if (!engine.current) engine.current = createPianoAudio();
    engine.current.setVolume(volume / 100, muted);
    void engine.current.play(weekday).catch(() => {
      if (mounted.current) setError('소리를 시작하지 못했어요. 브라우저 오디오 권한을 확인하고 건반을 다시 눌러 주세요.');
    });
  };
  return { volume, setVolume, muted, setMuted, error: error || preferenceError, playing, play, stopAll };
}
