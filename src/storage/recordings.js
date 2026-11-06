import { runTransaction } from './database.js';
import { requireViewer, assertSameViewer, AccessError } from '../services/localIdentity.js';
import { authorizeRecording, READ_POLICY_STORES } from '../services/communityPolicy.js';
import { captureSavedRecording, createSaveIntent, recordSuccessfulRecordingDay, retryPendingPianoEvents } from '../domain/piano/index.js';
import { createRecording, validateRecording } from '../models/recording.js';
import { isSavableRecordingDuration, MIN_RECORDING_MESSAGE } from '../lib/recordingPolicy.js';

const PHOTO_PREFIX = 'indexeddb://soundcapsule/photos/';
const CHANGE_EVENT = 'soundcapsule:recordings-changed';

function notifyChanges() {
  globalThis.window?.dispatchEvent(new Event(CHANGE_EVENT));
  if (globalThis.window && globalThis.BroadcastChannel) {
    // 알림을 지원하지 않는 환경에서도 완료된 저장 자체는 성공으로 처리합니다.
    try {
      const channel = new BroadcastChannel(CHANGE_EVENT);
      channel.postMessage('changed');
      channel.close();
    } catch { /* 화면 복귀 시 재조회로 보완합니다. */ }
  }
}

/** 같은 탭/다른 탭의 저장 변경과 화면 복귀를 구독합니다. 반환 함수로 해제하세요. */
export function subscribeRecordings(callback) {
  window.addEventListener(CHANGE_EVENT, callback);
  window.addEventListener('focus', callback);
  const visible = () => { if (document.visibilityState === 'visible') callback(); };
  document.addEventListener('visibilitychange', visible);
  let channel = null;
  try {
    if (globalThis.BroadcastChannel) {
      channel = new BroadcastChannel(CHANGE_EVENT);
      channel.onmessage = callback;
    }
  } catch { /* 차단된 환경에서는 같은 탭 알림과 화면 복귀 재조회를 사용합니다. */ }
  return () => {
    window.removeEventListener(CHANGE_EVENT, callback);
    window.removeEventListener('focus', callback);
    document.removeEventListener('visibilitychange', visible);
    channel?.close();
  };
}

async function transaction(stores, mode, run, options) {
  const result = await runTransaction(stores, mode, run, options);
  if (mode === 'readwrite') notifyChanges();
  return result;
}

/** 실제 Blob과 공통 Recording을 하나의 트랜잭션으로 저장합니다. */
export async function saveRecording({ blob, recordedAt, duration, title, locationName = '', memo = '' }) {
  // 신규 저장에만 적용하며 기존의 짧은 녹음 재생·편집·삭제에는 영향을 주지 않습니다.
  if (!isSavableRecordingDuration(duration)) throw new Error(MIN_RECORDING_MESSAGE);
  if (!(blob instanceof Blob) || blob.size === 0) throw new Error('저장할 녹음 파일이 없어요.');
  const viewer = await requireViewer();
  const sessionUserId = viewer.id;
  let savedEvent;
  const recording = await transaction(['recordings', 'audio', 'settings', 'pianoEvents'], 'readwrite', (tx, done, fail) => {
    assertSameViewer(viewer);
    const settings = tx.objectStore('settings');
    const identity = settings.get('localUserId');
    identity.onsuccess = () => {
      try {
        assertSameViewer(viewer);
        // 로그인 ID를 우선하고, 로컬 실행은 기존 브라우저 소유자 ID를 유지합니다.
        const userId = sessionUserId || identity.result || `local-${crypto.randomUUID()}`;
        if (!sessionUserId && !identity.result) settings.add(userId, 'localUserId');
        const id = crypto.randomUUID();
        const recording = createRecording({
          id, userId, title: title.trim(), recordedAt, duration,
          audioUrl: `indexeddb://soundcapsule/audio/${id}`,
          location: { name: locationName.trim(), latitude: null, longitude: null },
          memo: memo.trim(),
        });
        tx.objectStore('recordings').add(recording);
        tx.objectStore('audio').add(blob, id);
        tx.objectStore('pianoEvents').add(createSaveIntent(recording));
        done(recording);
      } catch (error) {
        fail(error);
      }
    };
  }, { onCommitted: (saved) => { savedEvent = captureSavedRecording(saved); } });
  // 녹음 commit 후의 피아노 실패는 녹음 실패로 표시하거나 중복 저장하지 않습니다.
  if (savedEvent) {
    try { await recordSuccessfulRecordingDay(savedEvent); } catch { /* 영속 이벤트로 재시도 */ }
  }
  return recording;
}

/** 캘린더와 지도도 동일한 Recording 배열을 읽을 수 있습니다. */
export async function listRecordings() {
  const viewer = await requireViewer();
  // 앱 재진입/화면 복귀 때 파일과 독립적인 미처리 달성을 복구합니다.
  void retryPendingPianoEvents().catch(() => {});
  const result = await transaction(['recordings'], 'readonly', (tx, done) => {
    tx.objectStore('recordings').getAll().onsuccess = (event) => {
      done(event.target.result.filter(item => item.userId === viewer.id).sort((a, b) => Date.parse(b.recordedAt) - Date.parse(a.recordedAt)));
    };
  });
  assertSameViewer(viewer); return result;
}

/** audioUrl은 저장소 식별자입니다. 재생하려면 이 Blob을 object URL로 변환하세요. */
export async function getRecordingAudio(id) {
  const viewer = await requireViewer();
  const result = await transaction(['recordings', 'audio', ...READ_POLICY_STORES], 'readonly', (tx, done, fail) => {
    tx.objectStore('recordings').get(id).onsuccess = ({ target }) => authorizeRecording(tx, viewer.id, target.result, () => {
      tx.objectStore('audio').get(id).onsuccess = ({ target }) => done(target.result ?? null);
    }, fail);
  });
  assertSameViewer(viewer); return result;
}

/** 지정한 기록의 정보와 오디오만 원자적으로 삭제합니다. */
export async function deleteRecording(id) {
  const viewer = await requireViewer();
  if (typeof id !== 'string' || !id.trim()) {
    return Promise.reject(new TypeError('삭제할 녹음 ID가 필요합니다.'));
  }
  return transaction(['recordings', 'audio', 'photos'], 'readwrite', (tx, done, fail) => {
    assertSameViewer(viewer);
    const records = tx.objectStore('recordings');
    records.get(id).onsuccess = ({ target }) => {
      try {
        assertSameViewer(viewer);
        if (!target.result) return;
        if (target.result.userId !== viewer.id) throw new AccessError('본인의 녹음만 삭제할 수 있어요.');
        for (const url of target.result.photoUrls ?? []) {
          if (url.startsWith(PHOTO_PREFIX)) tx.objectStore('photos').delete(url.slice(PHOTO_PREFIX.length));
        }
        records.delete(id);
        tx.objectStore('audio').delete(id);
      } catch (error) { fail(error); }
    };
  });
}

async function editRecording(id, stores, edit) {
  const viewer = await requireViewer();
  return transaction(['recordings', ...stores], 'readwrite', (tx, done, fail) => {
    assertSameViewer(viewer);
    const records = tx.objectStore('recordings');
    records.get(id).onsuccess = ({ target }) => {
      try {
        assertSameViewer(viewer);
        if (!target.result) throw new Error('녹음이 삭제되었거나 존재하지 않아요.');
        if (target.result.userId !== viewer.id) throw new AccessError('본인의 녹음만 수정할 수 있어요.');
        const updated = edit(target.result, tx);
        updated.updatedAt = new Date().toISOString();
        const validation = validateRecording(updated);
        if (!validation.valid) throw new Error(Object.values(validation.errors).join(' '));
        records.put(updated);
        done(updated);
      } catch (error) { fail(error); }
    };
  });
}

export function updateRecordingMemo(id, memo) {
  if (typeof memo !== 'string' || memo.length > 500) return Promise.reject(new Error('메모는 500자 이내로 입력해 주세요.'));
  return editRecording(id, [], (recording) => ({ ...recording, memo: memo.trim() }));
}

export function addRecordingPhotos(id, files) {
  const photos = Array.from(files);
  if (!photos.length || photos.some((file) => !(file instanceof Blob) || !file.type.startsWith('image/') || file.type === 'image/svg+xml' || !file.size || file.size > 10 * 1024 * 1024)) {
    return Promise.reject(new Error('사진은 SVG를 제외한 이미지 파일로, 한 장당 10MB 이하로 선택해 주세요.'));
  }
  return editRecording(id, ['photos'], (recording, tx) => {
    const photoUrls = photos.map((file) => {
      const photoId = crypto.randomUUID();
      tx.objectStore('photos').add(file, photoId);
      return `${PHOTO_PREFIX}${photoId}`;
    });
    return { ...recording, photoUrls: [...recording.photoUrls, ...photoUrls] };
  });
}

export async function getRecordingPhoto(url) {
  if (typeof url !== 'string' || !url.startsWith(PHOTO_PREFIX)) return null;
  const viewer = await requireViewer();
  const result = await transaction(['recordings', 'photos', ...READ_POLICY_STORES], 'readonly', (tx, done, fail) => {
    tx.objectStore('recordings').getAll().onsuccess = ({ target }) => {
      const recording = target.result.find(item => item.photoUrls.includes(url));
      authorizeRecording(tx, viewer.id, recording, () => {
        tx.objectStore('photos').get(url.slice(PHOTO_PREFIX.length)).onsuccess = ({ target }) => done(target.result ?? null);
      }, fail);
    };
  });
  assertSameViewer(viewer); return result;
}

export function deleteRecordingPhoto(id, url) {
  return editRecording(id, ['photos'], (recording, tx) => {
    if (!recording.photoUrls.includes(url)) throw new Error('이 녹음에 첨부된 사진이 아니에요.');
    if (url.startsWith(PHOTO_PREFIX)) tx.objectStore('photos').delete(url.slice(PHOTO_PREFIX.length));
    return { ...recording, photoUrls: recording.photoUrls.filter((photo) => photo !== url) };
  });
}
