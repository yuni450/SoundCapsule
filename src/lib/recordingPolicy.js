export const MIN_RECORDING_SECONDS = 3;
export const MIN_RECORDING_MESSAGE = '최소 3초 이상 녹음해야 저장할 수 있어요!';

// 표시용 타이머의 반올림/버림과 무관하게 실제 경과 초를 검사합니다.
export function isSavableRecordingDuration(duration) {
  return Number.isFinite(duration) && duration >= MIN_RECORDING_SECONDS;
}
