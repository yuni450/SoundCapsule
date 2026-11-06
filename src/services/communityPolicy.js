import { runTransaction } from '../storage/database.js';
import { AccessError, assertSameViewer, requireViewer } from './localIdentity.js';

export const friendKey = (a, b) => [a, b].sort();
export const READ_POLICY_STORES = ['communityFriends', 'communityMembers'];

export function authorizeRecording(tx, viewerId, recording, done, fail, write = false) {
  const allow = () => { try { done(recording); } catch (error) { fail(error); } };
  try {
    if (!recording) { fail(new AccessError('녹음이 없거나 조회 권한이 없습니다.')); return; }
    if (recording.userId === viewerId) { allow(); return; }
    if (write) { fail(new AccessError('본인의 녹음만 수정하거나 삭제할 수 있어요.')); return; }
    if (recording.visibility === 'friends') {
      tx.objectStore('communityFriends').get(friendKey(viewerId, recording.userId)).onsuccess = ({ target }) => {
        if (target.result) allow(); else fail(new AccessError());
      };
    } else if (recording.visibility === 'group' && typeof recording.groupId === 'string') {
      tx.objectStore('communityMembers').get([recording.groupId, viewerId]).onsuccess = ({ target }) => {
        if (target.result) allow(); else fail(new AccessError());
      };
    } else fail(new AccessError());
  } catch (error) { fail(error); }
}

export async function authorizePiano(userId, write = false) {
  const viewer = await requireViewer();
  if (viewer.id !== userId) {
    if (write) throw new AccessError('본인의 음표 기록만 변경할 수 있어요.');
    const friendship = await runTransaction(['communityFriends'], 'readonly', (tx, done) => {
      tx.objectStore('communityFriends').get(friendKey(viewer.id, userId)).onsuccess = ({ target }) => done(target.result);
    });
    if (!friendship) throw new AccessError();
  }
  assertSameViewer(viewer);
  return viewer;
}
