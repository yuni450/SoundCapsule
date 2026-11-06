const cdpOrigin = process.env.SOUNDCAPSULE_CDP || 'http://127.0.0.1:9222';
const viewportWidth = Number(process.env.SOUNDCAPSULE_WIDTH || 390);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const pages = await fetch(`${cdpOrigin}/json/list`).then((response) => response.json());
const page = pages.find((item) => item.type === 'page' && item.url.startsWith('http://127.0.0.1:5173'));
if (!page) throw new Error('No debuggable browser page was found.');

const socket = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener('open', resolve, { once: true });
  socket.addEventListener('error', reject, { once: true });
});

let nextId = 1;
const pending = new Map();
const browserErrors = [];
socket.addEventListener('message', (event) => {
  const message = JSON.parse(event.data);
  if (message.id) {
    const handler = pending.get(message.id);
    if (!handler) return;
    pending.delete(message.id);
    if (message.error) handler.reject(new Error(message.error.message));
    else handler.resolve(message.result);
    return;
  }
  if (message.method === 'Runtime.exceptionThrown') {
    browserErrors.push(message.params.exceptionDetails.text || 'Runtime exception');
  }
  if (message.method === 'Log.entryAdded' && message.params.entry.level === 'error') {
    browserErrors.push(message.params.entry.text);
  }
});

function send(method, params = {}) {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`CDP timeout while waiting for ${method}`));
    }, 5000);
    pending.set(id, {
      resolve: (value) => { clearTimeout(timer); resolve(value); },
      reject: (error) => { clearTimeout(timer); reject(error); },
    });
    socket.send(JSON.stringify({ id, method, params }));
  });
}

async function evaluate(expression, awaitPromise = false) {
  const response = await send('Runtime.evaluate', { expression, awaitPromise, returnByValue: true });
  if (response.exceptionDetails) throw new Error(response.exceptionDetails.text);
  return response.result.value;
}

await send('Runtime.enable');
await send('Log.enable');
await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: viewportWidth, height: 900, deviceScaleFactor: 1, mobile: viewportWidth <= 760 });

await evaluate(`localStorage.clear(); setTimeout(() => location.reload(), 0); true`);
await sleep(700);
const authScreen = await evaluate(`document.body.innerText.includes('계정 만들기')`);
await evaluate(`(() => {
  localStorage.setItem('soundcapsule:users', JSON.stringify([{id:'debug.user',name:'디버그',passwordHash:'test',role:'member'}]));
  localStorage.setItem('soundcapsule:session', JSON.stringify({id:'debug.user',name:'디버그',role:'member'}));
  setTimeout(() => location.reload(), 0);
  return true;
})()`);
await sleep(900);
const homeScreen = await evaluate(`document.body.innerText.includes('첫 번째 순간을 녹음해 보세요.') && Boolean(document.querySelector('.sc-home'))`);
const appShell = await evaluate(`Boolean(document.querySelector('.shell'))`);
await evaluate(`Array.from(document.querySelectorAll('button')).find((button) => button.getAttribute('aria-label') === '캘린더' || button.textContent.trim() === '캘린더')?.click()`);
await sleep(300);
const calendarScreen = await evaluate(`Boolean(document.querySelector('.sc-calendar')) && document.body.innerText.includes('소리로 돌아보는 하루')`);
await evaluate(`Array.from(document.querySelectorAll('button')).find((button) => button.getAttribute('aria-label') === '친구' || button.textContent.trim() === '친구')?.click()`);
await sleep(300);
const friendsScreen = await evaluate(`document.body.innerText.includes('받은 요청') && document.body.innerText.includes('내 친구')`);

await evaluate(`Array.from(document.querySelectorAll('button')).find((button) => button.textContent.trim() === '지도')?.click()`);
await sleep(6000);
const mapScreen = await evaluate(`document.body.innerText.includes('나의 소리 지도') && Boolean(document.querySelector('.google-map-stage'))`);
const googleMapLoaded = await evaluate(`Boolean(document.querySelector('.google-map-canvas .gm-style'))`);
const googleMapMarkers = await evaluate(`document.querySelectorAll('.google-record-marker').length >= 3`);
const mapDiagnostics = await evaluate(`({title:document.body.innerText.includes('나의 소리 지도'),stage:Boolean(document.querySelector('.google-map-stage')),state:document.querySelector('.google-map-state')?.innerText||'',active:Array.from(document.querySelectorAll('.view-switch button.active')).map(button=>button.textContent.trim())})`);
await send('Browser.grantPermissions', { origin: 'http://127.0.0.1:5173', permissions: ['geolocation'] });
await send('Emulation.setGeolocationOverride', { latitude: 37.5446, longitude: 127.0558, accuracy: 25 });
await evaluate(`document.querySelector('.location-button')?.click()`);
await sleep(500);
const mapRevisitAlert = await evaluate(`document.body.innerText.includes('다시 만난 장소') && document.body.innerText.includes('성수동')`);
await evaluate(`document.querySelector('.google-record-marker')?.click()`);
await sleep(200);
const mapPlacePanel = await evaluate(`Boolean(document.querySelector('.place-panel .map-recording-card'))`);
await evaluate(`Array.from(document.querySelectorAll('.view-switch button')).find((button) => button.textContent.trim() === '장소 목록')?.click()`);
await sleep(150);
const mapListView = await evaluate(`document.querySelectorAll('.place-list-view > article').length >= 3`);
await evaluate(`Array.from(document.querySelectorAll('.view-switch button')).find((button) => button.textContent.trim() === '대한민국 지도')?.click()`);
await sleep(400);
const googleMapRestored = await evaluate(`Boolean(document.querySelector('.google-map-canvas .gm-style'))`);

await evaluate(`Array.from(document.querySelectorAll('button')).find((button) => button.textContent.trim() === '그룹')?.click()`);
await sleep(300);
const groupsScreen = await evaluate(`document.body.innerText.includes('그룹 초대') || document.body.innerText.includes('겨울 제주')`);
const groupModal = await evaluate(`(() => { document.querySelector('.groups .round')?.click(); return true; })()`);
await sleep(200);
const createGroupDialog = await evaluate(`document.body.innerText.includes('그룹 만들기')`);
await evaluate(`document.querySelector('.backdrop')?.dispatchEvent(new MouseEvent('mousedown', {bubbles:true}))`);

await evaluate(`Array.from(document.querySelectorAll('button')).find((button) => button.textContent.trim() === '설정')?.click()`);
await sleep(300);
const settingsScreen = await evaluate(`document.body.innerText.includes('소리 및 녹음') && document.body.innerText.includes('녹음 음질')`);
const workerReady = await evaluate(`Promise.race([navigator.serviceWorker?.ready.then(() => true).catch(() => false), new Promise((resolve) => setTimeout(() => resolve(false), 2500))])`, true);

const result = {
  authScreen,
  homeScreen,
  appShell,
  calendarScreen,
  friendsScreen,
  mapScreen,
  googleMapLoaded,
  googleMapMarkers,
  mapDiagnostics,
  mapRevisitAlert,
  mapPlacePanel,
  mapListView,
  googleMapRestored,
  groupsScreen,
  groupModal,
  createGroupDialog,
  settingsScreen,
  workerReady,
  browserErrors,
};

socket.close();
console.log(JSON.stringify(result, null, 2));
if (Object.entries(result).some(([key, value]) => !['browserErrors','mapDiagnostics'].includes(key) && value !== true) || browserErrors.length) {
  process.exitCode = 1;
}
