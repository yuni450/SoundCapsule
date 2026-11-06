import { resolveUserId } from '../storage/recordingUser.js';

export class AccessError extends Error {
  constructor(message = '조회 권한이 없습니다.') { super(message); this.name = 'AccessError'; }
}

export function readLocalSession() {
  try { return JSON.parse(localStorage.getItem('soundcapsule:session') || 'null'); }
  catch { throw new AccessError('로그인 상태를 확인하지 못했어요. 다시 로그인해 주세요.'); }
}

export async function requireViewer() {
  const session = readLocalSession();
  if (!session || typeof session.id !== 'string' || !session.id.trim()) throw new AccessError('로그인이 필요합니다.');
  if (session.local && import.meta.env?.VITE_E2E_BYPASS_AUTH !== '1') throw new AccessError('다시 로그인해 주세요.');
  const id = session.local ? await resolveUserId() : session.id;
  return { id, sessionId: session.id, local: Boolean(session.local) };
}

export function assertSameViewer(viewer) {
  const session = readLocalSession();
  if (!session || session.id !== viewer.sessionId || Boolean(session.local) !== viewer.local) throw new AccessError('사용자가 변경됐어요. 다시 불러와 주세요.');
}

export function registeredProfiles() {
  const values = JSON.parse(localStorage.getItem('soundcapsule:users') || '[]');
  if (!Array.isArray(values)) throw new Error('계정 목록을 불러오지 못했어요.');
  return values.filter(user => user && typeof user.id === 'string' && typeof user.name === 'string')
    .map(({ id, name }) => ({ id, name })); // 비밀번호/해시를 서비스 응답에 포함하지 않습니다.
}
