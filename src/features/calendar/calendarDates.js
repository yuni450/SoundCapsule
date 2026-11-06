/** UTC 시각을 사용자의 현지 날짜 키로 바꿉니다. */
export function localDateKey(value) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function monthCells(year, month) {
  const offset = new Date(year, month, 1, 12).getDay();
  const days = new Date(year, month + 1, 0, 12).getDate();
  const size = Math.ceil((offset + days) / 7) * 7;
  return Array.from({ length: size }, (_, index) => {
    const day = index - offset + 1;
    return day > 0 && day <= days ? new Date(year, month, day, 12) : null;
  });
}

export function groupByLocalDate(recordings) {
  const groups = new Map();
  for (const recording of recordings) {
    const key = localDateKey(recording.savedAt || recording.recordedAt);
    if (key) groups.set(key, [...(groups.get(key) ?? []), recording]);
  }
  return groups;
}
