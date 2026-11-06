import { useEffect, useRef, useState } from 'react';

export default function AudioPlayer({ blob, label }) {
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const audioRef = useRef(null);
  useEffect(() => {
    setError('');
    const player = audioRef.current;
    const next = URL.createObjectURL(blob);
    setUrl(next);
    return () => {
      // 재생 중인 기록을 삭제해도 소리가 계속 나지 않도록 명시적으로 정리합니다.
      player?.pause();
      player?.removeAttribute('src');
      player?.load();
      URL.revokeObjectURL(next);
    };
  }, [blob]);
  return <>
    <audio ref={audioRef} controls preload="metadata" src={url || undefined} aria-label={label}
      onError={() => setError('오디오를 재생하지 못했어요. 파일 형식이나 브라우저 지원 여부를 확인해 주세요.')} />
    {error && <p className="sc-error" role="alert">{error}</p>}
  </>;
}
