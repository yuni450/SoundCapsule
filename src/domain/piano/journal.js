import { createCompletionEvent } from './model.js';

const PREFIX = 'soundcapsule:piano-completion:';
const memory = new Map();
const key = (eventId) => `${PREFIX}${eventId}`;

export function createSaveIntent(recording) {
  return { eventId: JSON.stringify([recording.userId, recording.id]), userId: recording.userId, recordingId: recording.id, duration: recording.duration, status: 'awaiting-completion' };
}

// IDB 완료 이벤트에서 한 번만 캡처. 후속 DB 쓰기 실패에도 날짜를 잃지 않도록 동기 저널로 보완합니다.
export function captureSavedRecording(recording, savedAtOverride) {
  const event = createCompletionEvent(recording, savedAtOverride || new Date().toISOString(), Intl.DateTimeFormat().resolvedOptions().timeZone);
  memory.set(event.eventId, event);
  try { globalThis.localStorage?.setItem(key(event.eventId), JSON.stringify(event)); } catch { /* IDB 또는 메모리 재시도 */ }
  return event;
}

export function readCompletion(eventId) {
  if (memory.has(eventId)) return memory.get(eventId);
  try { return JSON.parse(globalThis.localStorage?.getItem(key(eventId)) || 'null'); } catch { return null; }
}

export function clearCompletion(eventId) {
  memory.delete(eventId);
  try { globalThis.localStorage?.removeItem(key(eventId)); } catch { /* 적용된 receipt가 중복을 막습니다. */ }
}
