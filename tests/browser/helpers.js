import { chromium } from 'playwright';

export const BASE_URL = process.env.SOUNDCAPSULE_TEST_URL || 'http://127.0.0.1:5174';

// 모든 테스트는 별도 임시 프로필과 가상 마이크만 사용합니다.
export function launchBrowser() {
  return chromium.launch({
    ...(process.env.BROWSER_EXECUTABLE_PATH
      ? { executablePath: process.env.BROWSER_EXECUTABLE_PATH }
      : { channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome' }),
    headless: true,
    args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
  });
}
