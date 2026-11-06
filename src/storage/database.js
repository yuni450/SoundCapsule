const DB_NAME = 'soundcapsule';
const DB_VERSION = 6;

export function openDatabase() {
  return new Promise((resolve, reject) => {
    if (!globalThis.indexedDB) {
      reject(new Error('이 브라우저에서는 로컬 저장소를 사용할 수 없어요.'));
      return;
    }
    let blocked = false;
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (event) => {
      const db = request.result;
      if (!db.objectStoreNames.contains('recordings')) db.createObjectStore('recordings', { keyPath: 'id' });
      for (const name of ['audio', 'originalAudio', 'settings', 'photos', 'chatFiles']) {
        if (!db.objectStoreNames.contains(name)) db.createObjectStore(name);
      }
      if (!db.objectStoreNames.contains('pianoAchievements')) {
        const achievements = db.createObjectStore('pianoAchievements', { keyPath: ['userId', 'localDate'] });
        achievements.createIndex('byUserMonth', ['userId', 'yearMonth']);
      }
      if (!db.objectStoreNames.contains('pianoEvents')) {
        const events = db.createObjectStore('pianoEvents', { keyPath: 'eventId' });
        events.createIndex('byUserState', ['userId', 'status']);
      }
      if (!db.objectStoreNames.contains('communityFriends')) db.createObjectStore('communityFriends', { keyPath: ['a', 'b'] });
      if (!db.objectStoreNames.contains('communityRequests')) db.createObjectStore('communityRequests', { keyPath: ['fromId', 'toId'] });
      if (!db.objectStoreNames.contains('communityMembers')) db.createObjectStore('communityMembers', { keyPath: ['groupId', 'userId'] });
      if (!db.objectStoreNames.contains('communityGroups')) {
        const groups = db.createObjectStore('communityGroups', { keyPath: 'id' });
        groups.createIndex('byInvite', 'inviteCode', { unique: true });
      }
      if (event.oldVersion < 3) {
        const records = request.transaction.objectStore('recordings');
        records.openCursor().onsuccess = ({ target }) => {
          const cursor = target.result;
          if (!cursor) return;
          const value = cursor.value;
          if (!value.savedAt) cursor.update({ ...value, savedAt: value.createdAt || value.updatedAt || value.recordedAt });
          cursor.continue();
        };
      }
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
export async function runTransaction(stores, mode, run, { onCommitted } = {}) {
  const db = await openDatabase();
  try {
    const result = await new Promise((resolve, reject) => {
      const tx = db.transaction(stores, mode);
      let result;
      let failure;
      tx.oncomplete = () => {
        // 이미 완료된 녹음 트랜잭션을 후속 처리 실패로 실패 취급하지 않습니다.
        try { onCommitted?.(result); } catch { /* 미확정 intent는 조회 API에서 진단합니다. */ }
        resolve(result);
      };
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
    return result;
  } finally {
    db.close();
  }
}
