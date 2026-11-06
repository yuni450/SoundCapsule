import { useEffect, useState } from 'react';

const PREFIX = 'soundcapsule:';

export function readStored(key, fallback) {
  try {
    const value = localStorage.getItem(PREFIX + key);
    return value === null ? fallback : JSON.parse(value);
  } catch {
    return fallback;
  }
}

export function writeStored(key, value) {
  localStorage.setItem(PREFIX + key, JSON.stringify(value));
}

export function usePersistentState(key, fallback) {
  const [value, setValue] = useState(() => readStored(key, fallback));

  useEffect(() => {
    writeStored(key, value);
  }, [key, value]);

  useEffect(() => {
    const sync = (event) => {
      if (event.key !== PREFIX + key || event.newValue === null) return;
      try { setValue(JSON.parse(event.newValue)); } catch { /* ignore invalid external state */ }
    };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, [key]);

  return [value, setValue];
}

export async function hashPassword(password) {
  if (!crypto?.subtle) return password;
  const bytes = new TextEncoder().encode(password);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}
