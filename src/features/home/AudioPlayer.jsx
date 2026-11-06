import { useEffect, useRef, useState } from 'react';

export default function AudioPlayer({ blob, label }) {
  const [url, setUrl] = useState('');
  const audioRef = useRef(null);
  useEffect(() => {
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
  return <audio ref={audioRef} controls preload="metadata" src={url || undefined} aria-label={label} />;
}
