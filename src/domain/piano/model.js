import { isSavableRecordingDuration } from '../../lib/recordingPolicy.js';

export const PIANO_KEYS = Object.freeze([
  { weekday: 1, label: '월요일', note: '도', pitch: 'C', colorName: '빨강', color: '#F2AAA5' },
  { weekday: 2, label: '화요일', note: '레', pitch: 'D', colorName: '주황', color: '#F5C49A' },
  { weekday: 3, label: '수요일', note: '미', pitch: 'E', colorName: '노랑', color: '#F2DF96' },
  { weekday: 4, label: '목요일', note: '파', pitch: 'F', colorName: '초록', color: '#A8CDB5' },
  { weekday: 5, label: '금요일', note: '솔', pitch: 'G', colorName: '파랑', color: '#A5C9E8' },
  { weekday: 6, label: '토요일', note: '라', pitch: 'A', colorName: '남색', color: '#ABAED7' },
  { weekday: 7, label: '일요일', note: '시', pitch: 'B', colorName: '보라', color: '#CBB2DF' },
].map(Object.freeze));

export function validateYearMonth(value) {
  if (typeof value !== 'string' || !/^(?!0000)\d{4}-(0[1-9]|1[0-2])$/.test(value)) throw new TypeError('월은 YYYY-MM 형식이어야 합니다.');
  return value;
}

export function validateWeekday(value) {
  if (!Number.isInteger(value) || value < 1 || value > 7) throw new TypeError('요일은 월=1부터 일=7까지의 정수입니다.');
  return value;
}

export function localDateAt(savedAt, timeZone) {
  const date = new Date(savedAt);
  if (typeof savedAt !== 'string' || !Number.isFinite(date.getTime()) || date.toISOString() !== savedAt) throw new TypeError('저장 완료 시각은 UTC ISO 문자열이어야 합니다.');
  if (typeof timeZone !== 'string' || !timeZone) throw new TypeError('저장 완료 시점의 시간대가 필요합니다.');
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  const value = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${value.year.padStart(4, '0')}-${value.month}-${value.day}`;
}

export function createCompletionEvent(recording, savedAt, timeZone) {
  if (!isSavableRecordingDuration(recording.duration)) throw new TypeError('3초 이상 저장된 녹음만 인정합니다.');
  const localDate = localDateAt(savedAt, timeZone);
  return { eventId: JSON.stringify([recording.userId, recording.id]), userId: recording.userId, recordingId: recording.id, duration: recording.duration, savedAt, timeZone, localDate, yearMonth: localDate.slice(0, 7) };
}

export function aggregateMonthlyPiano(achievements, yearMonth, userId) {
  validateYearMonth(yearMonth);
  const dates = PIANO_KEYS.map(() => new Set());
  for (const achievement of achievements) {
    if (achievement.userId !== userId || achievement.yearMonth !== yearMonth || achievement.localDate.slice(0, 7) !== yearMonth) continue;
    const date = new Date(`${achievement.localDate}T12:00:00.000Z`);
    if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== achievement.localDate) continue;
    dates[(date.getUTCDay() + 6) % 7].add(achievement.localDate);
  }
  const weekdays = PIANO_KEYS.map((key, index) => {
    const uniqueDateCount = dates[index].size;
    const filledSlots = Math.min(uniqueDateCount, 4);
    return { ...key, uniqueDateCount, filledSlots, maxSlots: 4, progressLabel: `${filledSlots}/4`, percent: filledSlots * 25, isUnlocked: uniqueDateCount >= 2 };
  });
  const unlockedKeyCount = weekdays.filter((day) => day.isUnlocked).length;
  return { userId, yearMonth, weekdays, unlockedKeyCount, allKeysUnlocked: unlockedKeyCount === 7, monthlyComplete: weekdays.every((day) => day.filledSlots === 4) };
}
