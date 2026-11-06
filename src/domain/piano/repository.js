import { authorizePiano } from '../../services/communityPolicy.js';
import { runTransaction } from '../../storage/database.js';
import { validateUserId } from '../../storage/recordingUser.js';
import { createCompletionEvent } from './model.js';
import { clearCompletion, readCompletion } from './journal.js';
import { notifyPianoProgress } from './events.js';

async function persistCompletion(input) {
  validateUserId(input?.userId);
  if (typeof input.recordingId !== 'string' || !input.recordingId.trim()) throw new TypeError('저장 이벤트의 녹음 ID가 필요합니다.');
  const candidate = createCompletionEvent({ id: input.recordingId, userId: input.userId, duration: input.duration }, input.savedAt, input.timeZone);
  return runTransaction(['pianoEvents'], 'readwrite', (tx, done, fail) => {
    const events = tx.objectStore('pianoEvents');
    events.get(candidate.eventId).onsuccess = ({ target }) => {
      try {
        const intent = target.result;
        if (!intent || intent.userId !== candidate.userId || intent.recordingId !== candidate.recordingId || intent.duration !== candidate.duration) {
          throw new Error('성공한 녹음 저장 이벤트가 없습니다. 과거 기록은 소급 인정하지 않습니다.');
        }
        if (intent.status !== 'awaiting-completion') { done(intent); return; }
        // 완료 이벤트에서 캡처한 저널이 있으면 호출자가 전달한 재시도 시각보다 우선합니다.
        const snapshot = readCompletion(intent.eventId) || candidate;
        const canonical = createCompletionEvent({ id: intent.recordingId, userId: intent.userId, duration: intent.duration }, snapshot.savedAt, snapshot.timeZone);
        const pending = { ...intent, ...canonical, status: 'pending' };
        events.put(pending); done(pending);
      } catch (error) { fail(error); }
    };
  });
}

/** 실제 녹음 commit이 만든 intent가 있는 이벤트만 인정합니다. */
export async function recordSuccessfulRecordingDay(input) {
  await authorizePiano(input?.userId, true);
  const pending = await persistCompletion(input);
  const applied = await runTransaction(['pianoEvents', 'pianoAchievements'], 'readwrite', (tx, done, fail) => {
    const events = tx.objectStore('pianoEvents');
    events.get(pending.eventId).onsuccess = ({ target }) => {
      try {
        const event = target.result;
        if (!event) throw new Error('피아노 저장 이벤트를 찾을 수 없습니다.');
        if (event.status === 'applied') { done({ result: event.result, changed: false }); return; }
        if (event.status !== 'pending') throw new Error('저장 완료 시각이 아직 확정되지 않았습니다.');
        const achievements = tx.objectStore('pianoAchievements');
        achievements.get([event.userId, event.localDate]).onsuccess = ({ target: achievementRequest }) => {
          try {
            const previous = achievementRequest.result;
            const inserted = !previous;
            let achievement = previous;
            if (!previous || event.savedAt < previous.firstAchievedAt) {
              achievement = { userId: event.userId, localDate: event.localDate, yearMonth: event.yearMonth, firstAchievedAt: event.savedAt, eventId: event.eventId, recordingId: event.recordingId, timeZone: event.timeZone };
              achievements.put(achievement);
            }
            const result = { inserted, localDate: event.localDate, yearMonth: event.yearMonth, achievement };
            events.put({ ...event, status: 'applied', result });
            done({ result, changed: inserted });
          } catch (error) { fail(error); }
        };
      } catch (error) { fail(error); }
    };
  });
  clearCompletion(pending.eventId);
  if (applied.changed) notifyPianoProgress({ userId: pending.userId, yearMonth: pending.yearMonth, localDate: pending.localDate });
  return applied.result;
}

export function readPendingEvents(userId) {
  return runTransaction(['pianoEvents'], 'readonly', (tx, done) => {
    const index = tx.objectStore('pianoEvents').index('byUserState');
    const events = []; let remaining = 2;
    for (const status of ['awaiting-completion', 'pending']) {
      index.getAll([userId, status]).onsuccess = ({ target }) => {
        events.push(...target.result);
        if (--remaining === 0) done(events);
      };
    }
  });
}

export function readMonthAchievements(userId, yearMonth) {
  return runTransaction(['pianoAchievements'], 'readonly', (tx, done) => {
    tx.objectStore('pianoAchievements').index('byUserMonth').getAll([userId, yearMonth]).onsuccess = ({ target }) => done(target.result);
  });
}
