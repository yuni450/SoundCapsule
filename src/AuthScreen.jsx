import { useState } from 'react';
import { hashPassword } from './lib/usePersistentState.js';

export default function AuthScreen({ users, setUsers, onLogin }) {
  const [mode, setMode] = useState(users.length ? 'login' : 'signup');
  const [form, setForm] = useState({ name: '', id: '', password: '' });
  const [error, setError] = useState('');

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    const id = form.id.trim().replace(/^@/, '').toLowerCase();
    if (!id || form.password.length < 4 || (mode === 'signup' && !form.name.trim())) {
      setError('이름과 아이디, 4자 이상의 비밀번호를 확인해 주세요.');
      return;
    }
    const passwordHash = await hashPassword(form.password);
    if (mode === 'reset') {
      if (!users.some((user) => user.id === id)) { setError('등록된 아이디를 찾지 못했어요.'); return; }
      setUsers((current) => current.map((user) => user.id === id ? { ...user, passwordHash, passwordChangedAt: new Date().toISOString() } : user));
      setMode('login'); setForm({ name: '', id, password: '' }); setError('비밀번호를 변경했어요. 새 비밀번호로 로그인해 주세요.');
      return;
    }
    if (mode === 'signup') {
      if (users.some((user) => user.id === id)) { setError('이미 사용 중인 아이디예요.'); return; }
      const user = { id, name: form.name.trim(), passwordHash, role: 'member', createdAt: new Date().toISOString() };
      setUsers((current) => [...current, user]);
      onLogin(user);
      return;
    }
    const user = users.find((item) => item.id === id && item.passwordHash === passwordHash);
    if (!user) { setError('아이디 또는 비밀번호가 맞지 않아요.'); return; }
    onLogin(user);
  };

  return <main className="auth-screen"><section className="auth-card">
    <div className="auth-brand"><span><i/><i/><i/></span>SoundCapsule</div>
    <div className="auth-copy"><p>소리로 간직하는 하루</p><h1>{mode === 'login' ? '다시 만나 반가워요' : mode === 'reset' ? '비밀번호를 다시 설정해요' : '나만의 소리함을 만들어요'}</h1><span>{mode === 'login' ? '기록해 둔 순간으로 돌아가 보세요.' : mode === 'reset' ? '이 브라우저에 저장된 계정의 새 비밀번호를 입력하세요.' : '친구와 함께 그날의 분위기를 나눠보세요.'}</span></div>
    <form onSubmit={submit}>
      {mode === 'signup' && <label>이름<input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} autoComplete="name" placeholder="이름"/></label>}
      <label>아이디<div className="auth-id"><span>@</span><input value={form.id} onChange={(event) => setForm({ ...form, id: event.target.value })} autoComplete="username" placeholder="sound.day"/></div></label>
      <label>비밀번호<input type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} placeholder="4자 이상"/></label>
      {error && <p className="auth-error">{error}</p>}
      <button className="primary auth-submit">{mode === 'login' ? '로그인' : mode === 'reset' ? '비밀번호 변경' : '계정 만들기'}</button>
    </form>
    {mode === 'login' && <button className="auth-switch" onClick={() => { setMode('reset'); setError(''); setForm({ ...form, password: '' }); }}>비밀번호를 잊으셨나요?</button>}
    <button className="auth-switch" onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(''); }}>{mode === 'login' ? '처음인가요? 계정 만들기' : '이미 계정이 있나요? 로그인'}</button>
    <small>계정과 기록은 이 브라우저에만 저장됩니다. 서버 인증과 기기 간 공유는 지원하지 않습니다.</small>
  </section></main>;
}
