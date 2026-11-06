export function audioFilename(title, mimeType) {
  const extensions = {
    'audio/webm': 'webm', 'audio/mp4': 'm4a', 'video/mp4': 'm4a',
    'audio/ogg': 'ogg', 'audio/wav': 'wav', 'audio/x-wav': 'wav',
    'audio/mpeg': 'mp3', 'audio/aac': 'aac',
  };
  const extension = extensions[mimeType.split(';')[0].trim().toLowerCase()] || 'audio';
  const name = title.replace(/[<>:"/\\|?*\u0000-\u001f\u007f]/g, '_')
    .replace(/^[. ]+|[. ]+$/g, '').slice(0, 100) || 'SoundCapsule';
  return `${name}.${extension}`;
}

export function downloadAudio(blob, title) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = audioFilename(title, blob.type);
  document.body.append(link);
  try {
    link.click();
  } finally {
    link.remove();
    // 브라우저가 비동기 다운로드를 시작할 시간을 확보합니다.
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }
}
