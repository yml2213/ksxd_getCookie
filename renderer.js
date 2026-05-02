function setStatus(text) {
  document.getElementById('status').textContent = text || '等待操作';
}

function setCookieText(text) {
  const textarea = document.getElementById('cookieText');
  textarea.value = text || '';
}

function setCookieCheck(check) {
  const statusElement = document.getElementById('cookieCheckStatus');
  const detailElement = document.getElementById('cookieCheckDetail');
  const rawElement = document.getElementById('cookieCheckRaw');

  statusElement.textContent = check?.status || '未检测';
  detailElement.textContent = check?.detail || '尚未执行 Cookie 有效性测试';
  rawElement.value = check?.rawResponseText || '';
}

function setMessage(text, type = 'info') {
  const element = document.getElementById('message');
  element.textContent = text || '';
  element.dataset.type = type;
}

async function init() {
  const state = await window.cookieApp.getAppState();
  document.getElementById('loginUrl').textContent = state.loginUrl;
  setStatus(state.status);
  setCookieText(state.cookieText);
  setCookieCheck(state.cookieCheck);

  window.cookieApp.onCookieUpdated((payload) => {
    setStatus(payload.status);
    setCookieText(payload.cookieText);
    setCookieCheck(payload.cookieCheck);
    if (payload.cookieText) {
      setMessage('已更新 Cookie 内容', 'success');
    }
  });

  document.getElementById('refreshBtn').addEventListener('click', async () => {
    const result = await window.cookieApp.refreshCookie();
    setStatus(result.status);
    setCookieText(result.cookieText);
    setCookieCheck(result.cookieCheck);
    setMessage(result.cookieText ? '已手动刷新 Cookie' : '未读取到 Cookie', result.cookieText ? 'success' : 'warn');
  });

  document.getElementById('testBtn').addEventListener('click', async () => {
    const result = await window.cookieApp.testCookieValidity();
    setStatus(result.status);
    setCookieText(result.cookieText);
    setCookieCheck(result.cookieCheck);
    if (result.cookieCheck?.status === '有效') {
      setMessage('Cookie 有效性测试通过', 'success');
      return;
    }
    if (result.cookieCheck?.status === '失效') {
      setMessage('Cookie 已失效，请重新登录', 'warn');
      return;
    }
    setMessage(result.message || 'Cookie 测试已完成', result.ok ? 'info' : 'warn');
  });

  document.getElementById('copyBtn').addEventListener('click', async () => {
    const result = await window.cookieApp.copyCookie();
    setMessage(result.message, result.ok ? 'success' : 'warn');
  });

  document.getElementById('saveBtn').addEventListener('click', async () => {
    const result = await window.cookieApp.saveCookie();
    setMessage(result.message, result.ok ? 'success' : 'warn');
  });

  document.getElementById('reloadBtn').addEventListener('click', async () => {
    const result = await window.cookieApp.reloadLoginPage();
    setStatus(result.status);
    setMessage('登录页已重新加载', 'info');
  });
}

init();
