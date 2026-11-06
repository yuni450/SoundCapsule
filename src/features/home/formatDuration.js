export function formatDuration(seconds) {
  const value = Math.floor(seconds);
  return `${Math.floor(value / 60).toString().padStart(2, '0')}:${(value % 60).toString().padStart(2, '0')}`;
}
