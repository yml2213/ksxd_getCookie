const path = require('path');
const fs = require('fs');
const {
  app,
  BrowserWindow,
  BrowserView,
  ipcMain,
  dialog,
  clipboard,
  session,
} = require('electron');

const LOGIN_URL = 'https://login.kwaixiaodian.com/?biz=zone';
const COOKIE_URL = 'https://login.kwaixiaodian.com';
const COOKIE_DOMAIN = 'kwaixiaodian.com';
const COOKIE_TEST_URL = 'https://s.kwaixiaodian.com/gateway/industry/eticket/consume/detail';
const COOKIE_TEST_BODY = {
  eTicketId: 'test1',
};

let mainWindow = null;
let loginView = null;
let latestCookieText = '';
let lastStatus = '请在右侧页面完成登录';
let lastCookieCheck = {
  status: '未检测',
  detail: '尚未执行 Cookie 有效性测试',
  rawResponseText: '',
};

function getCookieSession() {
  if (loginView && !loginView.webContents.isDestroyed()) {
    return loginView.webContents.session;
  }
  return session.defaultSession;
}

function isLoginSuccessUrl(currentUrl) {
  try {
    const parsed = new URL(currentUrl);
    const hostnameMatched = parsed.hostname.endsWith(COOKIE_DOMAIN);
    const isLoginPage = parsed.hostname === 'login.kwaixiaodian.com' && parsed.pathname === '/';
    return hostnameMatched && !isLoginPage;
  } catch (error) {
    return false;
  }
}

function formatCookies(cookies) {
  return cookies.map((item) => `${item.name}=${item.value}`).join('; ');
}

async function readCookieText() {
  const activeSession = getCookieSession();
  let cookies = await activeSession.cookies.get({ url: COOKIE_URL });
  if (!cookies.length) {
    cookies = await activeSession.cookies.get({ domain: COOKIE_DOMAIN });
  }
  return formatCookies(cookies);
}

function notifyRenderer(payload) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('cookie-updated', payload);
  }
}

function updateCookieCheck(status, detail, rawResponseText = '') {
  lastCookieCheck = {
    status,
    detail,
    rawResponseText,
  };
}

async function testCookieValidity() {
  if (!latestCookieText) {
    updateCookieCheck('未检测', '当前还没有可测试的 Cookie');
    return {
      ok: false,
      isValid: false,
      message: lastCookieCheck.detail,
      check: lastCookieCheck,
    };
  }

  try {
    const response = await fetch(COOKIE_TEST_URL, {
      method: 'POST',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36',
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'accept-language': 'zh-CN,zh;q=0.9',
        kpf: 'PC_WEB',
        kpn: 'KWAIXIAODIAN',
        origin: 'https://s.kwaixiaodian.com',
        referer: 'https://s.kwaixiaodian.com/zone/industry/voucher/verify-list',
        Cookie: latestCookieText,
      },
      body: JSON.stringify(COOKIE_TEST_BODY),
    });

    const rawText = await response.text();
    let parsed = null;

    try {
      parsed = JSON.parse(rawText);
    } catch (error) {
      parsed = null;
    }

    if (parsed && parsed.result === 21 && typeof parsed.error_msg === 'string' && parsed.error_msg.includes('没有找到电子凭证')) {
      updateCookieCheck('有效', 'Cookie 有效：接口已通过鉴权，返回“没有找到电子凭证:test1”属于预期结果', rawText);
      return {
        ok: true,
        isValid: true,
        message: lastCookieCheck.detail,
        check: lastCookieCheck,
        response: parsed,
      };
    }

    if (
      parsed
      && parsed.result === 109
      && typeof parsed.error_msg === 'string'
      && parsed.error_msg.includes('当前登录失效')
    ) {
      updateCookieCheck('失效', 'Cookie 失效：接口返回“当前登录失效，请重新登录。”', rawText);
      return {
        ok: true,
        isValid: false,
        message: lastCookieCheck.detail,
        check: lastCookieCheck,
        response: parsed,
      };
    }

    updateCookieCheck(
      '未知',
      `接口返回了未预期结果，HTTP ${response.status}，请检查原始响应`,
      rawText,
    );
    return {
      ok: true,
      isValid: false,
      message: lastCookieCheck.detail,
      check: lastCookieCheck,
      response: parsed,
    };
  } catch (error) {
    updateCookieCheck('异常', `Cookie 测试请求失败：${error.message}`);
    return {
      ok: false,
      isValid: false,
      message: lastCookieCheck.detail,
      check: lastCookieCheck,
    };
  }
}

async function collectCookies(reason) {
  try {
    const cookieText = await readCookieText();
    if (!cookieText) {
      lastStatus = '已检测到页面跳转，但暂未读取到 Cookie';
      notifyRenderer({
        status: lastStatus,
        cookieText: latestCookieText,
        reason,
      });
      return;
    }

    latestCookieText = cookieText;
    lastStatus = `已获取 Cookie（触发原因：${reason}）`;
    await testCookieValidity();
    notifyRenderer({
      status: lastStatus,
      cookieText: latestCookieText,
      cookieCheck: lastCookieCheck,
      reason,
    });
  } catch (error) {
    lastStatus = `获取 Cookie 失败：${error.message}`;
    notifyRenderer({
      status: lastStatus,
      cookieText: latestCookieText,
      cookieCheck: lastCookieCheck,
      reason,
    });
  }
}

function updateViewBounds() {
  if (!mainWindow || !loginView) {
    return;
  }

  const [windowWidth, windowHeight] = mainWindow.getContentSize();
  const topOffset = 286;
  loginView.setBounds({
    x: 0,
    y: topOffset,
    width: windowWidth,
    height: Math.max(windowHeight - topOffset, 200),
  });
}

function registerLoginEvents() {
  const target = loginView.webContents;
  const handler = async (eventName) => {
    const currentUrl = target.getURL();
    notifyRenderer({
      status: `当前页面：${currentUrl}`,
      cookieText: latestCookieText,
      cookieCheck: lastCookieCheck,
      reason: eventName,
    });

    if (isLoginSuccessUrl(currentUrl)) {
      await collectCookies(`页面跳转：${currentUrl}`);
    }
  };

  target.on('did-navigate', async () => handler('did-navigate'));
  target.on('did-navigate-in-page', async () => handler('did-navigate-in-page'));
  target.on('page-title-updated', async () => {
    const currentUrl = target.getURL();
    if (isLoginSuccessUrl(currentUrl)) {
      await collectCookies('page-title-updated');
    }
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1360,
    height: 900,
    title: 'KSXD Cookie Tool',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  loginView = new BrowserView({
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      partition: 'persist:ksxd-login',
    },
  });

  mainWindow.setBrowserView(loginView);
  updateViewBounds();
  registerLoginEvents();

  loginView.webContents.loadURL(LOGIN_URL);
  mainWindow.on('resize', updateViewBounds);
  mainWindow.on('closed', () => {
    mainWindow = null;
    loginView = null;
  });
}

ipcMain.handle('get-app-state', async () => ({
  loginUrl: LOGIN_URL,
  status: lastStatus,
  cookieText: latestCookieText,
  cookieCheck: lastCookieCheck,
}));

ipcMain.handle('refresh-cookie', async () => {
  await collectCookies('手动刷新');
  return {
    status: lastStatus,
    cookieText: latestCookieText,
    cookieCheck: lastCookieCheck,
  };
});

ipcMain.handle('copy-cookie', async () => {
  if (!latestCookieText) {
    return { ok: false, message: '当前还没有可复制的 Cookie' };
  }
  clipboard.writeText(latestCookieText);
  return { ok: true, message: 'Cookie 已复制到剪贴板' };
});

ipcMain.handle('save-cookie', async () => {
  if (!latestCookieText) {
    return { ok: false, message: '当前还没有可保存的 Cookie' };
  }

  const result = await dialog.showSaveDialog(mainWindow, {
    title: '保存 Cookie',
    defaultPath: 'kwaixiaodian-cookie.txt',
    filters: [
      { name: '文本文件', extensions: ['txt'] },
      { name: '所有文件', extensions: ['*'] },
    ],
  });

  if (result.canceled || !result.filePath) {
    return { ok: false, message: '已取消保存' };
  }

  fs.writeFileSync(result.filePath, `${latestCookieText}\n`, 'utf8');
  return { ok: true, message: `Cookie 已保存到：${result.filePath}` };
});

ipcMain.handle('reload-login-page', async () => {
  if (loginView && !loginView.webContents.isDestroyed()) {
    await loginView.webContents.loadURL(LOGIN_URL);
    lastStatus = '登录页已重新加载';
    notifyRenderer({
      status: lastStatus,
      cookieText: latestCookieText,
      cookieCheck: lastCookieCheck,
      reason: 'reload-login-page',
    });
  }
  return {
    status: lastStatus,
    cookieText: latestCookieText,
    cookieCheck: lastCookieCheck,
  };
});

ipcMain.handle('test-cookie-validity', async () => {
  const result = await testCookieValidity();
  notifyRenderer({
    status: lastStatus,
    cookieText: latestCookieText,
    cookieCheck: lastCookieCheck,
    reason: 'test-cookie-validity',
  });
  return {
    ...result,
    status: lastStatus,
    cookieText: latestCookieText,
    cookieCheck: lastCookieCheck,
  };
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
