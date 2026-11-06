export const PIANO_TONES = Object.freeze([
  { weekday: 1, code: 'KeyA', shortcut: 'A', noteId: 'C4', frequency: 261.625565 },
  { weekday: 2, code: 'KeyS', shortcut: 'S', noteId: 'D4', frequency: 293.664768 },
  { weekday: 3, code: 'KeyD', shortcut: 'D', noteId: 'E4', frequency: 329.627557 },
  { weekday: 4, code: 'KeyF', shortcut: 'F', noteId: 'F4', frequency: 349.228231 },
  { weekday: 5, code: 'KeyG', shortcut: 'G', noteId: 'G4', frequency: 391.995436 },
  { weekday: 6, code: 'KeyH', shortcut: 'H', noteId: 'A4', frequency: 440 },
  { weekday: 7, code: 'KeyJ', shortcut: 'J', noteId: 'B4', frequency: 493.883301 },
].map(Object.freeze));

export function currentLocalMonth(now = new Date()) {
  return `${String(now.getFullYear()).padStart(4, '0')}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export function shiftMonth(month, offset) {
  const [year, number] = month.split('-').map(Number);
  const total = year * 12 + number - 1 + offset;
  const nextYear = Math.floor(total / 12);
  if (nextYear < 1 || nextYear > 9999) return month;
  return `${String(nextYear).padStart(4, '0')}-${String(total % 12 + 1).padStart(2, '0')}`;
}

export function monthLabel(month) {
  const [year, number] = month.split('-').map(Number);
  return `${year}년 ${number}월`;
}

export function nextWeekdayDate(weekday, now = new Date()) {
  const date = new Date(now);
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + ((weekday % 7 - date.getDay() + 7) % 7 || 7));
  return date;
}

export function lockedKeyMessage(key, month, currentMonth, now = new Date()) {
  const remaining = Math.max(0, 2 - key.uniqueDateCount);
  const guidance = remaining === 1
    ? `${key.label}에 하루만 더 녹음하면 ${key.note} 건반이 열려요!`
    : `${key.label}에 ${remaining}일 더 녹음하면 ${key.note} 건반을 연주할 수 있어요!`;
  const period = month < currentMonth ? '과거 월에는 새 달성을 추가할 수 없어요.'
    : month > currentMonth ? '미래 월의 녹음을 예약할 수는 없어요.' : guidance;
  const date = nextWeekdayDate(key.weekday, now).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' });
  return `${period} ${monthLabel(month)} ${key.label} 기록 ${key.uniqueDateCount}일 · 활성화까지 ${remaining}일. 다음 ${key.label}은 ${date}이에요 (오늘 기준).`;
}
