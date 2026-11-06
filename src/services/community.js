import { runTransaction } from '../storage/database.js';
import { validateRecording } from '../models/recording.js';
import { AccessError, assertSameViewer, registeredProfiles, requireViewer } from './localIdentity.js';
import { friendKey } from './communityPolicy.js';

export const COMMUNITY_CAPABILITIES = Object.freeze({ mode: 'local-browser', remoteSharing: false, serverAuthorization: false, publicVisibility: false });
const EVENT = 'soundcapsule:community-changed';
const origin = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;

function notify() {
  window.dispatchEvent(new Event(EVENT));
  try { const channel = new BroadcastChannel(EVENT); channel.postMessage(origin); channel.close(); } catch { /* 포커스 시 재조회 */ }
}
export function subscribeCommunity(listener) {
  window.addEventListener(EVENT, listener); window.addEventListener('focus', listener);
  let channel;
  try { channel = new BroadcastChannel(EVENT); channel.onmessage = event => { if (event.data !== origin) listener(); }; } catch { /* 같은 탭 알림 유지 */ }
  return () => { window.removeEventListener(EVENT, listener); window.removeEventListener('focus', listener); channel?.close(); };
}

async function asViewer(stores, mode, run) {
  const viewer = await requireViewer();
  const result = await runTransaction(stores, mode, (tx, done, fail) => { assertSameViewer(viewer); run(tx, viewer.id, done, fail); });
  if (mode === 'readonly') assertSameViewer(viewer);
  else notify();
  return result;
}

function knownProfile(id) {
  const profile = registeredProfiles().find(user => user.id === id);
  if (!profile) throw new Error('이 브라우저에 등록된 계정을 찾지 못했어요.');
  return profile;
}

export async function searchLocalUsers(query = '') {
  const viewer = await requireViewer();
  const text = query.trim().replace(/^@/, '').toLowerCase();
  const users = registeredProfiles().filter(user => user.id !== viewer.id && `${user.id} ${user.name}`.toLowerCase().includes(text));
  assertSameViewer(viewer); return users;
}

export function getFriendState() {
  const profiles = registeredProfiles();
  return asViewer(['communityFriends', 'communityRequests'], 'readonly', (tx, userId, done) => {
    const result = { friends: [], incoming: [], outgoing: [] }; let pending = 2;
    tx.objectStore('communityFriends').getAll().onsuccess = ({ target }) => {
      result.friends = target.result.filter(item => item.a === userId || item.b === userId)
        .map(item => { const id = item.a === userId ? item.b : item.a; return profiles.find(user => user.id === id) || { id, name: id }; });
      if (--pending === 0) done(result);
    };
    tx.objectStore('communityRequests').getAll().onsuccess = ({ target }) => {
      result.incoming = target.result.filter(item => item.toId === userId).map(item => ({ ...item, user: profiles.find(user => user.id === item.fromId) || { id: item.fromId, name: item.fromId } }));
      result.outgoing = target.result.filter(item => item.fromId === userId).map(item => ({ ...item, user: profiles.find(user => user.id === item.toId) || { id: item.toId, name: item.toId } }));
      if (--pending === 0) done(result);
    };
  });
}

export function requestFriend(targetId) {
  knownProfile(targetId);
  return asViewer(['communityFriends', 'communityRequests'], 'readwrite', (tx, userId, done, fail) => {
    if (targetId === userId) { fail(new Error('본인에게 친구 요청을 보낼 수 없어요.')); return; }
    tx.objectStore('communityFriends').get(friendKey(userId, targetId)).onsuccess = ({ target }) => {
      if (target.result) { done(); return; }
      tx.objectStore('communityRequests').put({ fromId: userId, toId: targetId, createdAt: new Date().toISOString() }); done();
    };
  });
}

export function respondToFriend(fromId, accept) {
  return asViewer(['communityFriends', 'communityRequests'], 'readwrite', (tx, userId, done, fail) => {
    const requests = tx.objectStore('communityRequests');
    requests.get([fromId, userId]).onsuccess = ({ target }) => {
      if (!target.result) { fail(new Error('받은 친구 요청이 없어요.')); return; }
      if (accept) { const [a, b] = friendKey(userId, fromId); tx.objectStore('communityFriends').put({ a, b, confirmedAt: new Date().toISOString() }); requests.delete([userId, fromId]); }
      requests.delete([fromId, userId]); done();
    };
  });
}

export function removeFriend(targetId) {
  return asViewer(['communityFriends', 'communityRequests'], 'readwrite', (tx, userId) => {
    tx.objectStore('communityFriends').delete(friendKey(userId, targetId));
    tx.objectStore('communityRequests').delete([userId, targetId]); tx.objectStore('communityRequests').delete([targetId, userId]);
  });
}

export function getFriendRecordings(targetId) {
  return asViewer(['communityFriends', 'recordings'], 'readonly', (tx, userId, done, fail) => {
    tx.objectStore('communityFriends').get(friendKey(userId, targetId)).onsuccess = ({ target }) => {
      if (!target.result) { fail(new AccessError('수락된 친구 관계가 필요합니다.')); return; }
      tx.objectStore('recordings').getAll().onsuccess = ({ target }) => done(target.result.filter(recording => recording.userId === targetId && recording.visibility === 'friends'));
    };
  });
}

function requireMember(tx, groupId, userId, done, fail) {
  tx.objectStore('communityMembers').get([groupId, userId]).onsuccess = ({ target }) => {
    if (!target.result) fail(new AccessError('이 그룹의 구성원만 접근할 수 있어요.')); else done(target.result);
  };
}
function publicGroup(group, membership, count) {
  return { id: group.id, name: group.name, ownerId: group.ownerId, visibility: 'members', memberCount: count,
    ...(membership.role === 'owner' ? { inviteCode: group.inviteCode } : {}) };
}
export function createGroup(name) {
  if (typeof name !== 'string' || !name.trim() || name.trim().length > 60) return Promise.reject(new Error('그룹 이름은 1~60자로 입력해 주세요.'));
  return asViewer(['communityGroups', 'communityMembers'], 'readwrite', (tx, userId, done) => {
    const group = { id: crypto.randomUUID(), name: name.trim(), ownerId: userId, visibility: 'members', inviteCode: crypto.randomUUID(), createdAt: new Date().toISOString() };
    tx.objectStore('communityGroups').add(group);
    tx.objectStore('communityMembers').add({ groupId: group.id, userId, role: 'owner' });
    done(publicGroup(group, { role: 'owner' }, 1));
  });
}
export function listGroups() {
  return asViewer(['communityGroups', 'communityMembers'], 'readonly', (tx, userId, done) => {
    tx.objectStore('communityMembers').getAll().onsuccess = ({ target }) => {
      const memberships = target.result;
      tx.objectStore('communityGroups').getAll().onsuccess = ({ target }) => done(target.result.flatMap(group => {
        const member = memberships.find(item => item.groupId === group.id && item.userId === userId);
        return member ? [publicGroup(group, member, memberships.filter(item => item.groupId === group.id).length)] : [];
      }));
    };
  });
}
export function joinGroup(inviteCode) {
  return asViewer(['communityGroups', 'communityMembers'], 'readwrite', (tx, userId, done, fail) => {
    tx.objectStore('communityGroups').index('byInvite').get(String(inviteCode).trim()).onsuccess = ({ target }) => {
      const group = target.result;
      if (!group) { fail(new Error('이 브라우저에서 유효한 초대 코드를 찾지 못했어요.')); return; }
      const members = tx.objectStore('communityMembers');
      members.get([group.id, userId]).onsuccess = ({ target }) => {
        if (!target.result) members.add({ groupId: group.id, userId, role: 'member' });
        done(group.id);
      };
    };
  });
}
export function leaveGroup(groupId) {
  return asViewer(['communityGroups', 'communityMembers'], 'readwrite', (tx, userId, done, fail) => {
    requireMember(tx, groupId, userId, member => {
      tx.objectStore('communityMembers').getAll().onsuccess = ({ target }) => {
        const remaining = target.result.filter(item => item.groupId === groupId && item.userId !== userId).sort((a, b) => a.userId.localeCompare(b.userId));
        tx.objectStore('communityMembers').delete([groupId, userId]);
        if (!remaining.length) tx.objectStore('communityGroups').delete(groupId);
        else if (member.role === 'owner') {
          tx.objectStore('communityMembers').put({ ...remaining[0], role: 'owner' });
          tx.objectStore('communityGroups').get(groupId).onsuccess = ({ target }) => tx.objectStore('communityGroups').put({ ...target.result, ownerId: remaining[0].userId });
        }
        done();
      };
    }, fail);
  });
}
export function getGroup(groupId) {
  const profiles = registeredProfiles();
  return asViewer(['communityGroups', 'communityMembers', 'recordings'], 'readonly', (tx, userId, done, fail) => {
    requireMember(tx, groupId, userId, membership => {
      tx.objectStore('communityGroups').get(groupId).onsuccess = ({ target }) => {
        if (!target.result) { fail(new AccessError()); return; }
        const group = target.result;
        tx.objectStore('communityMembers').getAll().onsuccess = ({ target }) => {
          const members = target.result.filter(item => item.groupId === groupId).map(item => ({ ...item, ...(profiles.find(user => user.id === item.userId) || { id: item.userId, name: item.userId }) }));
          tx.objectStore('recordings').getAll().onsuccess = ({ target }) => done({ ...publicGroup(group, membership, members.length), members, recordings: target.result.filter(recording => recording.visibility === 'group' && recording.groupId === groupId) });
        };
      };
    }, fail);
  });
}

export async function setRecordingVisibility(recordingId, visibility, groupId = null) {
  const result = await asViewer(['recordings', 'communityMembers'], 'readwrite', (tx, userId, done, fail) => {
    tx.objectStore('recordings').get(recordingId).onsuccess = ({ target }) => {
      const recording = target.result;
      if (!recording || recording.userId !== userId) { fail(new AccessError('본인의 녹음만 공유할 수 있어요.')); return; }
      const save = () => {
        const updated = { ...recording, visibility, groupId: visibility === 'group' ? groupId : null, updatedAt: new Date().toISOString() };
        const validation = validateRecording(updated);
        if (!validation.valid) { fail(new Error('지원하지 않는 공개 범위입니다.')); return; }
        tx.objectStore('recordings').put(updated); done(updated);
      };
      if (visibility === 'group') requireMember(tx, groupId, userId, save, fail); else save();
    };
  });
  window.dispatchEvent(new Event('soundcapsule:recordings-changed'));
  try { const channel = new BroadcastChannel('soundcapsule:recordings-changed'); channel.postMessage('changed'); channel.close(); } catch {}
  return result;
}
