import { createRecording } from '../models/recording.js';

const DB_NAME = 'soundcapsule';
const DB_VERSION = 1;

function openDatabase() {
  return new Promise((resolve, reject) => {
    if (!globalThis.indexedDB) {
      reject(new Error('이 브라우저에서는 로컬 저장소를 사용할 수 없어요.'));
      return;
    }
    let blocked = false;
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      db.createObjectStore('recordings', { keyPath: 'id' });
      db.createObjectStore('audio');
      db.createObjectStore('settings');
    };
    request.onerror = () => reject(request.error);
    request.onblocked = () => {
      blocked = true;
      reject(new Error('다른 SoundCapsule 탭을 닫고 다시 시도해 주세요.'));
    };
    request.onsuccess = () => {
      const db = request.result;
      if (blocked) { db.close(); return; }
      db.onversionchange = () => db.close();
      resolve(db);
    };
  });
}

// 요청 성공이 아닌 트랜잭션 완료 시점에만 저장 성공으로 처리합니다.
async function transaction(stores, mode, run) {
  const db = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(stores, mode);
      let result;
      let failure;
      tx.oncomplete = () => resolve(result);
      tx.onabort = () => reject(failure || tx.error || new Error('저장을 완료하지 못했어요.'));
      tx.onerror = () => {}; // abort 이벤트에서 한 번만 실패 처리
      try {
        run(tx, (value) => { result = value; }, (error) => {
          failure = error;
          tx.abort();
        });
      } catch (error) {
        failure = error;
        tx.abort();
      }
    });
  } finally {
    db.close();
  }
}

/** 실제 Blob과 공통 Recording을 하나의 트랜잭션으로 저장합니다. */
export async function saveRecording({ blob, recordedAt, duration, title, locationName = '', memo = '' }) {
  if (!(blob instanceof Blob) || blob.size === 0) throw new Error('저장할 녹음 파일이 없어요.');
  return transaction(['recordings', 'audio', 'settings'], 'readwrite', (tx, done, fail) => {
    const settings = tx.objectStore('settings');
    const identity = settings.get('localUserId');
    identity.onsuccess = () => {
      try {
        // 로그인 계정이 아닌 이 브라우저의 로컬 소유자 ID입니다.
        const userId = identity.result || `local-${crypto.randomUUID()}`;
        if (!identity.result) settings.add(userId, 'localUserId');
        const id = crypto.randomUUID();
        const recording = createRecording({
          id, userId, title: title.trim(), recordedAt, duration,
          audioUrl: `indexeddb://soundcapsule/audio/${id}`,
          location: { name: locationName.trim(), latitude: null, longitude: null },
          memo: memo.trim(),
        });
        tx.objectStore('recordings').add(recording);
        tx.objectStore('audio').add(blob, id);
        done(recording);
      } catch (error) {
        fail(error);
      }
    };
  });
}

/** 캘린더와 지도도 동일한 Recording 배열을 읽을 수 있습니다. */
export function listRecordings() {
  return transaction(['recordings'], 'readonly', (tx, done) => {
    tx.objectStore('recordings').getAll().onsuccess = (event) => {
      done(event.target.result.sort((a, b) => Date.parse(b.recordedAt) - Date.parse(a.recordedAt)));
    };
  });
}

/** audioUrl은 저장소 식별자입니다. 재생하려면 이 Blob을 object URL로 변환하세요. */
export function getRecordingAudio(id) {
  return transaction(['audio'], 'readonly', (tx, done) => {
    tx.objectStore('audio').get(id).onsuccess = (event) => done(event.target.result ?? null);
  });
}

/** 지정한 기록의 정보와 오디오만 원자적으로 삭제합니다. */
export function deleteRecording(id) {
  if (typeof id !== 'string' || !id.trim()) {
    return Promise.reject(new TypeError('삭제할 녹음 ID가 필요합니다.'));
  }
  return transaction(['recordings', 'audio'], 'readwrite', (tx) => {
    tx.objectStore('recordings').delete(id);
    tx.objectStore('audio').delete(id);
  });
}
