import { createRecording, validateRecording } from '../models/recording.js';
import { isSavableRecordingDuration, MIN_RECORDING_MESSAGE } from '../lib/recordingPolicy.js';

const DB_NAME = 'soundcapsule';
const DB_VERSION = 5;
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

function openDatabase() {
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
async function transaction(stores, mode, run) {
  const db = await openDatabase();
  try {
    const result = await new Promise((resolve, reject) => {
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
    if (mode === 'readwrite') notifyChanges();
    return result;
  } finally {
    db.close();
  }
}

/** 실제 Blob과 공통 Recording을 하나의 트랜잭션으로 저장합니다. */
export async function saveRecording({ blob, originalBlob = null, recordedAt, duration, title, locationName = '', latitude = null, longitude = null, country = '', city = '', memo = '', visibility = 'private', groupId = null, userId: requestedUserId }) {
export async function saveRecording({ blob, recordedAt, duration, title, locationName = '', memo = '' }) {
  // 신규 저장에만 적용하며 기존의 짧은 녹음 재생·편집·삭제에는 영향을 주지 않습니다.
  if (!isSavableRecordingDuration(duration)) throw new Error(MIN_RECORDING_MESSAGE);
  if (!(blob instanceof Blob) || blob.size === 0) throw new Error('저장할 녹음 파일이 없어요.');
  const hasCoordinates = Number.isFinite(latitude) && Number.isFinite(longitude);
  if ((latitude !== null || longitude !== null) && !hasCoordinates) throw new Error('위도와 경도를 함께 확인해 주세요.');
  return transaction(['recordings', 'audio', 'originalAudio', 'settings'], 'readwrite', (tx, done, fail) => {
    const settings = tx.objectStore('settings');
    const identity = settings.get('localUserId');
    identity.onsuccess = () => {
      try {
        // 로그인 계정이 아닌 이 브라우저의 로컬 소유자 ID입니다.
        let sessionUserId='';try{const session=JSON.parse(localStorage.getItem('soundcapsule:session')||'null');if(session&&!session.local)sessionUserId=session.id||''}catch{}
        const userId = requestedUserId || sessionUserId || identity.result || `local-${crypto.randomUUID()}`;
        if (!identity.result) settings.add(userId, 'localUserId');
        const id = crypto.randomUUID();
        const savedAt = new Date().toISOString();
        const recording = createRecording({
          id, userId, title: title.trim(), recordedAt, savedAt, duration,
          audioUrl: `indexeddb://soundcapsule/audio/${id}`,
          location: { name: locationName.trim(), latitude: hasCoordinates ? latitude : null, longitude: hasCoordinates ? longitude : null, country:country.trim(), city:city.trim() },
          memo: memo.trim(), visibility, groupId, hasOriginal:originalBlob instanceof Blob&&originalBlob.size>0,
        });
        tx.objectStore('recordings').add(recording);
        tx.objectStore('audio').add(blob, id);
        if(originalBlob instanceof Blob&&originalBlob.size>0)tx.objectStore('originalAudio').add(originalBlob,id);
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
      done(event.target.result.map((recording) => recording.savedAt ? recording : { ...recording, savedAt: recording.createdAt || recording.updatedAt || recording.recordedAt })
        .sort((a, b) => Date.parse(b.savedAt) - Date.parse(a.savedAt)));
    };
  });
}

/** audioUrl은 저장소 식별자입니다. 재생하려면 이 Blob을 object URL로 변환하세요. */
export function getRecordingAudio(id) {
  return transaction(['audio'], 'readonly', (tx, done) => {
    tx.objectStore('audio').get(id).onsuccess = (event) => done(event.target.result ?? null);
  });
}

export function getOriginalRecordingAudio(id){return transaction(['originalAudio'],'readonly',(tx,done)=>{tx.objectStore('originalAudio').get(id).onsuccess=({target})=>done(target.result??null)})}

/** 지정한 기록의 정보와 오디오만 원자적으로 삭제합니다. */
export function deleteRecording(id) {
  if (typeof id !== 'string' || !id.trim()) {
    return Promise.reject(new TypeError('삭제할 녹음 ID가 필요합니다.'));
  }
  return transaction(['recordings', 'audio', 'originalAudio', 'photos'], 'readwrite', (tx, done, fail) => {
    const records = tx.objectStore('recordings');
    records.get(id).onsuccess = ({ target }) => {
      try {
        for (const url of target.result?.photoUrls ?? []) {
          if (url.startsWith(PHOTO_PREFIX)) tx.objectStore('photos').delete(url.slice(PHOTO_PREFIX.length));
        }
        records.delete(id);
        tx.objectStore('audio').delete(id);
        tx.objectStore('originalAudio').delete(id);
      } catch (error) { fail(error); }
    };
  });
}

function editRecording(id, stores, edit) {
  return transaction(['recordings', ...stores], 'readwrite', (tx, done, fail) => {
    const records = tx.objectStore('recordings');
    records.get(id).onsuccess = ({ target }) => {
      try {
        if (!target.result) throw new Error('녹음이 삭제되었거나 존재하지 않아요.');
        const current = target.result.savedAt ? target.result : { ...target.result, savedAt: target.result.createdAt || target.result.updatedAt || target.result.recordedAt };
        const updated = edit(current, tx);
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

export function updateRecordingLocation(id, location) {
  const name = typeof location?.name === 'string' ? location.name.trim() : '';
  const latitude = location?.latitude ?? null;
  const longitude = location?.longitude ?? null;
  const bothEmpty = latitude === null && longitude === null;
  const bothValid = Number.isFinite(latitude) && Math.abs(latitude) <= 90 && Number.isFinite(longitude) && Math.abs(longitude) <= 180;
  if (!bothEmpty && !bothValid) return Promise.reject(new Error('위치 좌표를 확인해 주세요.'));
  return editRecording(id, [], (recording) => ({ ...recording, location: { name, latitude, longitude, country:typeof location?.country==='string'?location.country.trim():'',city:typeof location?.city==='string'?location.city.trim():'' } }));
}

export function updateRecordingSharing(id,{visibility='private',groupId=null}={}){
  if(!['private','friends','group'].includes(visibility))return Promise.reject(new Error('공개 범위를 확인해 주세요.'));
  if(visibility==='group'&&(!groupId||typeof groupId!=='string'))return Promise.reject(new Error('공유할 그룹이 필요해요.'));
  return editRecording(id,[],recording=>({...recording,visibility,groupId:visibility==='group'?groupId:null}));
}

export function cancelRecordingShare(id){return updateRecordingSharing(id,{visibility:'private',groupId:null})}

export function updateRecordingOwner(previousUserId,nextUserId){
  if(!previousUserId||!nextUserId)return Promise.reject(new Error('계정 아이디를 확인해 주세요.'));
  return transaction(['recordings','settings'],'readwrite',(tx,done)=>{const store=tx.objectStore('recordings'),updated=[];store.openCursor().onsuccess=({target})=>{const cursor=target.result;if(!cursor){tx.objectStore('settings').put(nextUserId,'localUserId');done(updated);return}if(cursor.value.userId===previousUserId){const value={...cursor.value,userId:nextUserId,updatedAt:new Date().toISOString()};cursor.update(value);updated.push(value)}cursor.continue()}});
}

export function saveChatFile(file){if(!(file instanceof Blob)||!file.size)return Promise.reject(new Error('공유할 파일이 없어요.'));const id=crypto.randomUUID();return transaction(['chatFiles'],'readwrite',(tx,done)=>{tx.objectStore('chatFiles').put(file,id);done(id)})}
export function getChatFile(id){return transaction(['chatFiles'],'readonly',(tx,done)=>{tx.objectStore('chatFiles').get(id).onsuccess=({target})=>done(target.result??null)})}
export function deleteChatFile(id){return transaction(['chatFiles'],'readwrite',(tx,done)=>{tx.objectStore('chatFiles').delete(id);done(true)})}

export async function listFriendRecordings(ownerIds=[]){const recordings=await listRecordings();return recordings.filter(recording=>recording.visibility==='friends'&&ownerIds.includes(recording.userId))}

export async function resolveSharedRecording(id,access){const recordings=await listRecordings();const recording=recordings.find(item=>item.id===id);if(!recording)return{status:'deleted',recording:null};return canAccessRecording(recording,access)?{status:'ready',recording}:{status:'forbidden',recording:null}}

export function canAccessRecording(recording, { userId, localOwnerId, friendIds = [], groupIds = [] } = {}) {
  if (!recording || !userId) return false;
  if (recording.userId === userId || recording.userId === localOwnerId) return true;
  if (recording.visibility === 'friends') return friendIds.includes(recording.userId);
  if (recording.visibility === 'group') return Boolean(recording.groupId && groupIds.includes(recording.groupId));
  return false;
}

export function getLocalRecordingOwnerId() {
  return transaction(['settings'], 'readonly', (tx, done) => {
    tx.objectStore('settings').get('localUserId').onsuccess = ({ target }) => done(target.result ?? null);
  });
}

export async function listShareableRecordings({ userId } = {}) {
  const [recordings, localOwnerId] = await Promise.all([listRecordings(), getLocalRecordingOwnerId()]);
  return recordings.filter((recording) => !userId || recording.userId === userId || recording.userId === localOwnerId);
}

export async function getSharedRecordingAudio(id, access) {
  const [recordings, localOwnerId] = await Promise.all([listRecordings(), getLocalRecordingOwnerId()]);
  const recording = recordings.find((item) => item.id === id);
  if (!canAccessRecording(recording, { ...access, localOwnerId })) throw new Error('이 녹음을 들을 권한이 없어요.');
  return getRecordingAudio(id);
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

export function getRecordingPhoto(url) {
  if (typeof url !== 'string' || !url.startsWith(PHOTO_PREFIX)) return Promise.resolve(null);
  return transaction(['photos'], 'readonly', (tx, done) => {
    tx.objectStore('photos').get(url.slice(PHOTO_PREFIX.length)).onsuccess = ({ target }) => done(target.result ?? null);
  });
}

export function deleteRecordingPhoto(id, url) {
  return editRecording(id, ['photos'], (recording, tx) => {
    if (!recording.photoUrls.includes(url)) throw new Error('이 녹음에 첨부된 사진이 아니에요.');
    if (url.startsWith(PHOTO_PREFIX)) tx.objectStore('photos').delete(url.slice(PHOTO_PREFIX.length));
    return { ...recording, photoUrls: recording.photoUrls.filter((photo) => photo !== url) };
  });
}
