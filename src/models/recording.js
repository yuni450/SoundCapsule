/**
 * 모든 탭에서 공유하는 녹음 데이터 계약입니다.
 * 이 모듈은 데이터만 생성/검사하며 녹음, 업로드, 저장은 수행하지 않습니다.
 * @typedef {Object} Recording
 * @property {string} id
 * @property {string} userId
 * @property {string} title
 * @property {string} audioUrl 저장된 파일 URL 또는 저장소 경로 (업로드는 별도 구현)
 * @property {string} recordedAt UTC ISO 8601 문자열
 * @property {number} duration 초 단위의 0 이상 유한수 (소수 허용)
 * @property {{name: string, latitude: number|null, longitude: number|null}} location
 * @property {string[]} photoUrls
 * @property {string} memo
 * @property {'private'|'friends'|'group'} visibility
 * @property {string|null} groupId group 공개 시 필수, 그 외 null
 * @property {string} createdAt UTC ISO 8601 문자열
 * @property {string} updatedAt UTC ISO 8601 문자열
 */

export const RECORDING_VISIBILITIES = Object.freeze(['private', 'friends', 'group']);

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const isNonEmptyString = (value) => typeof value === 'string' && value.trim().length > 0;
const isUtcTimestamp = (value) => {
  if (typeof value !== 'string') return false;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) && date.toISOString() === value;
};

/**
 * 외부에서 받은 값도 검사하며 입력 객체는 변경하지 않습니다.
 * @param {unknown} recording
 * @returns {{valid: boolean, errors: Record<string, string>}} フィールド名ごとのエラー
 */
export function validateRecording(recording) {
  const errors = {};
  if (!isObject(recording)) {
    return { valid: false, errors: { recording: '녹음 기록은 객체여야 합니다.' } };
  }

  for (const field of ['id', 'userId', 'title', 'audioUrl']) {
    if (!isNonEmptyString(recording[field])) {
      errors[field] = `${field}은(는) 비어 있지 않은 문자열이어야 합니다.`;
    }
  }
  for (const field of ['recordedAt', 'createdAt', 'updatedAt']) {
    if (!isUtcTimestamp(recording[field])) {
      errors[field] = `${field}은(는) Date.toISOString() 형식의 UTC 시간이어야 합니다.`;
    }
  }
  if (!Number.isFinite(recording.duration) || recording.duration < 0) {
    errors.duration = '녹음 길이는 초 단위의 0 이상 유한수여야 합니다.';
  }

  const location = recording.location;
  if (!isObject(location)) {
    errors.location = '장소명과 위도, 경도를 포함하는 객체여야 합니다.';
  } else {
    if (typeof location.name !== 'string') errors['location.name'] = '장소명은 문자열이어야 합니다.';
    for (const [field, limit] of [['latitude', 90], ['longitude', 180]]) {
      const coordinate = location[field];
      if (coordinate !== null && (!Number.isFinite(coordinate) || Math.abs(coordinate) > limit)) {
        errors[`location.${field}`] = `${field}은(는) -${limit}~${limit} 사이의 숫자 또는 null이어야 합니다.`;
      }
    }
    if ((location.latitude === null) !== (location.longitude === null)) {
      errors.location = '위도와 경도는 함께 입력하거나 모두 null로 지정해야 합니다.';
    }
  }

  if (!Array.isArray(recording.photoUrls) || !recording.photoUrls.every(isNonEmptyString)) {
    errors.photoUrls = '사진 목록은 비어 있지 않은 경로 문자열의 배열이어야 합니다.';
  }
  if (typeof recording.memo !== 'string') errors.memo = '메모는 문자열이어야 합니다.';
  if (!RECORDING_VISIBILITIES.includes(recording.visibility)) {
    errors.visibility = '공개 범위는 private, friends, group 중 하나여야 합니다.';
  }
  if (recording.visibility === 'group') {
    if (!isNonEmptyString(recording.groupId)) errors.groupId = '그룹 공유에는 그룹 ID가 필요합니다.';
  } else if (recording.groupId !== null) {
    errors.groupId = '그룹 공유가 아니면 그룹 ID는 null이어야 합니다.';
  }
  if (isUtcTimestamp(recording.createdAt) && isUtcTimestamp(recording.updatedAt)
      && Date.parse(recording.updatedAt) < Date.parse(recording.createdAt)) {
    errors.updatedAt = '마지막 수정 시간은 생성 시간보다 빠를 수 없습니다.';
  }

  return { valid: Object.keys(errors).length === 0, errors };
}

/**
 * 필수 입력: userId, title, audioUrl, recordedAt, duration.
 * ID와 생성/수정 시간, 선택 필드 기본값을 채우고 검증합니다.
 * recordedAt은 실제 녹음 시각을 전달해야 합니다 (생성 시각으로 대체하지 않음).
 * @param {Partial<Recording>} input
 * @returns {Recording}
 * @throws {TypeError} 잘못된 데이터. error.errors에 필드별 오류를 제공합니다.
 */
export function createRecording(input) {
  if (!isObject(input)) {
    const error = new TypeError('녹음 기록 생성에는 객체가 필요합니다.');
    error.errors = { recording: error.message };
    throw error;
  }
  const now = new Date().toISOString();
  const recording = {
    id: input.id === undefined ? globalThis.crypto.randomUUID() : input.id,
    userId: input.userId,
    title: input.title,
    audioUrl: input.audioUrl,
    recordedAt: input.recordedAt,
    duration: input.duration,
    location: input.location === undefined
      ? { name: '', latitude: null, longitude: null }
      : isObject(input.location) ? { ...input.location } : input.location,
    photoUrls: input.photoUrls === undefined
      ? [] : Array.isArray(input.photoUrls) ? [...input.photoUrls] : input.photoUrls,
    memo: input.memo === undefined ? '' : input.memo,
    visibility: input.visibility === undefined ? 'private' : input.visibility,
    groupId: input.groupId === undefined ? null : input.groupId,
    createdAt: input.createdAt === undefined ? now : input.createdAt,
    updatedAt: input.updatedAt === undefined
      ? (input.createdAt === undefined ? now : input.createdAt) : input.updatedAt,
  };
  const result = validateRecording(recording);
  if (!result.valid) {
    const error = new TypeError('녹음 기록의 입력값을 확인해 주세요.');
    error.errors = result.errors;
    throw error;
  }
  return recording;
}
