import { authorizePiano } from '../../services/communityPolicy.js';
import { assertSameViewer } from '../../services/localIdentity.js';
import { resolveUserId } from '../../storage/recordingUser.js';
import { aggregateMonthlyPiano, validateWeekday, validateYearMonth } from './model.js';
import { readCompletion } from './journal.js';
import { readMonthAchievements, readPendingEvents, recordSuccessfulRecordingDay } from './repository.js';

export { PIANO_KEYS, localDateAt } from './model.js';
export { PIANO_PROGRESS_EVENT, subscribePianoProgress } from './events.js';
export { createSaveIntent, captureSavedRecording } from './journal.js';
export { recordSuccessfulRecordingDay } from './repository.js';

/** 실패를 성공으로 가장하지 않고 pending/unresolved와 에러를 함께 반환합니다. */
export async function retryPendingPianoEvents({ userId } = {}) {
  const owner = await resolveUserId(userId);
  await authorizePiano(owner, true);
  const events = await readPendingEvents(owner);
  const result = { userId: owner, applied: 0, pending: 0, unresolved: [], errors: [] };
  for (const event of events) {
    const snapshot = event.status === 'pending' ? event : readCompletion(event.eventId);
    if (!snapshot) { result.unresolved.push(event.eventId); continue; }
    try { await recordSuccessfulRecordingDay(snapshot); result.applied++; }
    catch (error) { result.pending++; result.errors.push({ eventId: event.eventId, message: error.message }); }
  }
  return result;
}

export async function getPendingPianoEvents({ userId } = {}) {
  const owner = await resolveUserId(userId);
  await authorizePiano(owner, true);
  return readPendingEvents(owner);
}

export async function getMonthlyPiano(yearMonth, { userId } = {}) {
  validateYearMonth(yearMonth);
  const owner = await resolveUserId(userId);
  const viewer = await authorizePiano(owner);
  const recovery = viewer.id === owner ? await retryPendingPianoEvents({ userId: owner }) : { applied: 0, pending: 0, unresolved: [], errors: [] };
  const achievements = await readMonthAchievements(owner, yearMonth);
  assertSameViewer(viewer);
  await authorizePiano(owner);
  return { ...aggregateMonthlyPiano(achievements, yearMonth, owner), recovery };
}

export async function getWeekdayProgress(yearMonth, weekday, options) {
  validateWeekday(weekday);
  return (await getMonthlyPiano(yearMonth, options)).weekdays[weekday - 1];
}

export async function isKeyUnlocked(yearMonth, weekday, options) {
  return (await getWeekdayProgress(yearMonth, weekday, options)).isUnlocked;
}

export async function isAllKeysUnlocked(yearMonth, options) {
  return (await getMonthlyPiano(yearMonth, options)).allKeysUnlocked;
}

export async function isMonthlyPianoComplete(yearMonth, options) {
  return (await getMonthlyPiano(yearMonth, options)).monthlyComplete;
}
