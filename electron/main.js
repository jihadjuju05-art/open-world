// Game shell: serves the game folder over a fixed localhost port (workers/fetch need http) and auto-updates from GitHub Releases.
// It contains no editor code. If the developer's Studio has saved tuning on this PC (…/OpenWorldDev/project-data), the game reads it first.
const { app, BrowserWindow, Menu, shell } = require('electron');
const { autoUpdater } = require('electron-updater');
const http = require('http'), fs = require('fs'), path = require('path');

const ROOT = path.join(__dirname, '..');
const DEV = () => path.join(app.getPath('appData'), 'OpenWorldDev', 'project-data');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json', '.bin': 'application/octet-stream', '.css': 'text/css', '.wasm': 'application/wasm' };
let PORT = 0, win = null;

function send(res, code, type, body) { res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store' }); res.end(body); }

function serve() {
  return new Promise(resolve => {
    const srv = http.createServer((req, res) => {
      let p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p === '/') p = '/index.html'; const rel = p.slice(1), candidates = [];
      if (/^(anims|config)\//.test(rel)) candidates.push(path.join(DEV(), ...rel.split('/')));                               // developer tuning (absent on players' PCs)
      candidates.push(path.normalize(path.join(ROOT, p)));
      const tryNext = i => {
        if (i >= candidates.length) return send(res, 404, 'text/plain', 'not found'); const f = candidates[i];
        if (!f.startsWith(DEV()) && !f.startsWith(ROOT)) return send(res, 403, 'text/plain', '');
        fs.readFile(f, (err, data) => err ? tryNext(i + 1) : send(res, 200, MIME[path.extname(f).toLowerCase()] || 'application/octet-stream', data));
      };
      tryNext(0);
    });
    // Fixed port: the origin (and so localStorage: settings, saved character, story, map fog) must be the same on every launch.
    srv.once('error', () => srv.listen(0, '127.0.0.1', () => resolve(srv.address().port)));
    srv.listen(47831, '127.0.0.1', () => resolve(srv.address().port));
  });
}

function createWindow() {
  win = new BrowserWindow({ width: 1600, height: 900, backgroundColor: '#000', title: 'Open World', autoHideMenuBar: true, webPreferences: { contextIsolation: true, backgroundThrottling: false } });
  Menu.setApplicationMenu(null);
  win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });
  win.webContents.on('before-input-event', (e, i) => { if (i.type === 'keyDown' && i.key === 'F11') win.setFullScreen(!win.isFullScreen()); });
  win.loadURL(`http://127.0.0.1:${PORT}/index.html`); win.on('closed', () => win = null);
}

function setupUpdates() {
  if (!app.isPackaged) return;
  autoUpdater.autoDownload = true; autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.on('error', e => console.warn('update error', e?.message));
  autoUpdater.checkForUpdatesAndNotify().catch(() => { });
  setInterval(() => autoUpdater.checkForUpdatesAndNotify().catch(() => { }), 3 * 3600e3);
}

if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
  app.whenReady().then(async () => { PORT = await serve(); createWindow(); setupUpdates(); });
  app.on('window-all-closed', () => app.quit());
}
