export const PIANO_PROGRESS_EVENT = 'soundcapsule:piano-progress-changed';
// 알림 중복 제거용 식별자이며, randomUUID 미지원 환경에서도 앱 로드를 막지 않습니다.
const origin = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;

export function notifyPianoProgress(detail) {
  globalThis.window?.dispatchEvent(new CustomEvent(PIANO_PROGRESS_EVENT, { detail }));
  try {
    if (globalThis.window && globalThis.BroadcastChannel) {
      const channel = new BroadcastChannel(PIANO_PROGRESS_EVENT);
      channel.postMessage({ origin, detail }); channel.close();
    }
  } catch { /* 읽기 API의 복구/재조회로 보완합니다. */ }
}

export function subscribePianoProgress(listener, { userId, yearMonth } = {}) {
  const deliver = (detail) => {
    if (detail && (!userId || detail.userId === userId) && (!yearMonth || detail.yearMonth === yearMonth)) listener(detail);
  };
  const receive = (event) => deliver(event.detail);
  window.addEventListener(PIANO_PROGRESS_EVENT, receive);
  let channel;
  try {
    if (globalThis.BroadcastChannel) {
      channel = new BroadcastChannel(PIANO_PROGRESS_EVENT);
      channel.onmessage = (event) => { if (event.data?.origin !== origin) deliver(event.data?.detail); };
    }
  } catch { /* 차단된 채널은 같은 탭 이벤트에 영향을 주지 않습니다. */ }
  return () => { window.removeEventListener(PIANO_PROGRESS_EVENT, receive); channel?.close(); };
}
