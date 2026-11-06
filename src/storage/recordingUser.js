import { runTransaction } from './database.js';

export function readSessionUserId() {
  try {
    const session = JSON.parse(globalThis.localStorage?.getItem('soundcapsule:session') || 'null');
    return session && !session.local && typeof session.id === 'string' && session.id.trim() ? session.id : null;
  } catch { return null; }
}

export function validateUserId(userId) {
  if (typeof userId !== 'string' || !userId.trim()) throw new TypeError('사용자 ID가 필요합니다.');
  return userId;
}

export async function resolveUserId(userId) {
  if (userId !== undefined) return validateUserId(userId);
  const sessionId = readSessionUserId();
  if (sessionId) return sessionId;
  return runTransaction(['settings'], 'readwrite', (tx, done, fail) => {
    const store = tx.objectStore('settings');
    store.get('localUserId').onsuccess = ({ target }) => {
      try {
        const id = target.result || `local-${crypto.randomUUID()}`;
        if (!target.result) store.add(id, 'localUserId');
        done(id);
      } catch (error) { fail(error); }
    };
  });
}
