const path = require('node:path');
const { app, BrowserWindow, session } = require('electron');

const APP_URL = process.env.LOOKBOX_DESKTOP_URL || 'https://realcloset.vercel.app';
const ORDER_PARTITION = 'persist:lookbox-orders';
const DESKTOP_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36';

function configureOrderSession() {
  const orderSession = session.fromPartition(ORDER_PARTITION);
  orderSession.setUserAgent(DESKTOP_UA, 'ko-KR');
  orderSession.webRequest.onBeforeSendHeaders({ urls: ['*://*.coupang.com/*'] }, (details, callback) => {
    const headers = { ...details.requestHeaders };
    headers['User-Agent'] = DESKTOP_UA;
    headers['sec-ch-ua'] = '"Chromium";v="152", "Google Chrome";v="152", "Not_A Brand";v="99"';
    headers['sec-ch-ua-mobile'] = '?0';
    headers['sec-ch-ua-platform'] = '"macOS"';
    callback({ requestHeaders: headers });
  });
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 900,
    minHeight: 680,
    backgroundColor: '#EFEDE8',
    title: 'RealCloset',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webviewTag: true,
    },
  });

  win.webContents.on('will-attach-webview', (_event, webPreferences) => {
    delete webPreferences.preload;
    webPreferences.nodeIntegration = false;
    webPreferences.contextIsolation = true;
    webPreferences.sandbox = true;
  });

  win.webContents.on('did-attach-webview', (_event, guest) => {
    guest.setWindowOpenHandler(({ url }) => ({
      action: 'allow',
      overrideBrowserWindowOptions: {
        width: 520,
        height: 760,
        parent: win,
        webPreferences: {
          contextIsolation: true,
          nodeIntegration: false,
          sandbox: true,
        },
      },
    }));
  });

  if (process.env.LOOKBOX_DESKTOP_DEV_BYPASS === '1') {
    win.webContents.once('did-finish-load', async () => {
      const onboarded = await win.webContents.executeJavaScript("localStorage.getItem('lb_onboarded')");
      if (onboarded !== '1') {
        await win.webContents.executeJavaScript("localStorage.setItem('lb_onboarded', '1')");
        win.webContents.reload();
      }
    });
  }

  win.loadURL(APP_URL);
}

app.whenReady().then(() => {
  configureOrderSession();
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
