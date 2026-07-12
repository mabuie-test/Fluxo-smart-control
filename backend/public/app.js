const DEVICE_ID = window.APP_CONFIG?.deviceId || 'CASA01';
const RELAYS = ['r1', 'r2', 'r3'];
let token = localStorage.getItem('token') || '';
let currentPage = 'control';

const mapBool = (value) => (value ? 'LIGADA' : 'DESLIGADA');
const fmtSeconds = (seconds) => {
  const s = Math.max(0, Math.floor(Number(seconds || 0)));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${h}h ${String(m).padStart(2, '0')}min`;
};
const fmtKwh = (value) => `${Number(value || 0).toFixed(4)} kWh`;

function authHeaders() {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function fetchJSON(url, options = {}) {
  const res = await fetch(url, {
    cache: 'no-store',
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
      ...(options.headers || {})
    }
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(body || res.statusText);
  }

  return res.json();
}

function showAuth(mode) {
  loginForm.hidden = mode !== 'login';
  registerForm.hidden = mode !== 'register';
  forgotForm.hidden = mode !== 'forgot';
  authMsg.textContent = '';
}

function setSession(nextToken) {
  token = nextToken;
  localStorage.setItem('token', nextToken);
  auth.hidden = true;
  panel.hidden = false;
  refreshState();
}

function logout() {
  localStorage.removeItem('token');
  token = '';
  panel.hidden = true;
  auth.hidden = false;
}

function formData(form) {
  return Object.fromEntries(new FormData(form));
}

loginForm.onsubmit = async (event) => {
  event.preventDefault();
  try {
    const response = await fetchJSON('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(formData(event.target)),
      headers: { Authorization: '' }
    });
    setSession(response.data.token);
  } catch (err) {
    authMsg.textContent = err.message;
  }
};

registerForm.onsubmit = async (event) => {
  event.preventDefault();
  try {
    const response = await fetchJSON('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(formData(event.target)),
      headers: { Authorization: '' }
    });
    setSession(response.data.token);
  } catch (err) {
    authMsg.textContent = err.message;
  }
};

forgotForm.onsubmit = async (event) => {
  event.preventDefault();
  try {
    const payload = formData(event.target);
    const response = await fetchJSON('/api/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email: payload.email }),
      headers: { Authorization: '' }
    });
    authMsg.textContent = response.data.resetToken
      ? `Token de desenvolvimento: ${response.data.resetToken}`
      : response.data.message;
  } catch (err) {
    authMsg.textContent = err.message;
  }
};

async function resetPassword() {
  try {
    const payload = formData(forgotForm);
    const response = await fetchJSON('/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token: payload.token, password: payload.password }),
      headers: { Authorization: '' }
    });
    authMsg.textContent = response.data.message;
    showAuth('login');
  } catch (err) {
    authMsg.textContent = err.message;
  }
}

function setCard(relay, desired, actual) {
  const card = document.getElementById(`card-${relay}`);
  const pill = document.getElementById(`pill-${relay}`);

  card.classList.remove('on', 'off', 'pending');
  if (desired !== actual) {
    card.classList.add('pending');
    pill.textContent = 'PENDENTE';
  } else if (actual) {
    card.classList.add('on');
    pill.textContent = 'LIGADA';
  } else {
    card.classList.add('off');
    pill.textContent = 'DESLIGADA';
  }

  document.getElementById(`desired-${relay}`).textContent = mapBool(desired);
  document.getElementById(`actual-${relay}`).textContent = mapBool(actual);
}

function renderState(device) {
  deviceId.textContent = device.deviceId;
  online.textContent = device.online ? 'ONLINE' : 'OFFLINE';
  synced.textContent = device.synced ? 'SIM' : 'NÃO';
  lastSeen.textContent = device.lastSeen ? new Date(device.lastSeen).toLocaleString() : '—';
  syncState.textContent = device.synced ? 'Estado sincronizado' : 'Aguardando confirmação do Arduino';

  RELAYS.forEach((relay) => setCard(relay, device.desired[relay], device.actual[relay]));

  logs.innerHTML = '';
  (device.logs || []).slice(0, 8).forEach((log) => {
    const div = document.createElement('div');
    div.className = 'log-item';
    div.textContent = `${log.ts} — ${log.action} — ${log.detail}`;
    logs.appendChild(div);
  });
}

async function refreshState() {
  try {
    const response = await fetchJSON(`/api/device/${DEVICE_ID}/state`);
    renderState(response.data);
    if (currentPage === 'metrics') await refreshMetrics();
  } catch (err) {
    if (String(err.message).includes('401')) logout();
    syncState.textContent = 'Erro de ligação';
  }
}

function showPage(page) {
  currentPage = page;
  controlPage.hidden = page !== 'control';
  metricsPage.hidden = page !== 'metrics';
  navControl.classList.toggle('active', page === 'control');
  navMetrics.classList.toggle('active', page === 'metrics');
  if (page === 'metrics') refreshMetrics();
}

function renderMetrics(metrics) {
  rssiValue.textContent = metrics.rssi === null || metrics.rssi === undefined ? '—' : `${metrics.rssi} dBm`;
  rssiUpdated.textContent = metrics.rssiUpdatedAt ? `Atualizado em ${new Date(metrics.rssiUpdatedAt).toLocaleString()}` : 'Sem leitura RSSI ainda';
  totalKwh.textContent = fmtKwh(metrics.totalKwh);
  metricsRows.innerHTML = '';

  metrics.relays.forEach((item) => {
    const row = document.createElement('div');
    row.className = 'metric-row';

    const nameCell = document.createElement('div');
    const name = document.createElement('strong');
    name.textContent = `${item.relay.toUpperCase()} · ${item.label}`;
    const status = document.createElement('span');
    status.textContent = item.currentlyOn ? `Ligada desde ${new Date(item.onSince).toLocaleString()}` : 'Desligada';
    nameCell.append(name, status);

    [nameCell, fmtSeconds(item.runtimeSeconds), `${Number(item.powerWatts || 0)} W`, fmtKwh(item.kwh)].forEach((value) => {
      const cell = value instanceof HTMLElement ? value : document.createElement('div');
      if (!(value instanceof HTMLElement)) cell.textContent = value;
      row.appendChild(cell);
    });
    metricsRows.appendChild(row);

    const label = document.querySelector(`[name="${item.relay}-label"]`);
    const watts = document.querySelector(`[name="${item.relay}-watts"]`);
    if (label && document.activeElement !== label) label.value = item.label;
    if (watts && document.activeElement !== watts) watts.value = item.powerWatts;
  });
}

async function refreshMetrics() {
  const response = await fetchJSON(`/api/device/${DEVICE_ID}/metrics`);
  renderMetrics(response.data);
}

metricsForm.onsubmit = async (event) => {
  event.preventDefault();
  const payload = {};
  RELAYS.forEach((relay) => {
    payload[relay] = {
      label: event.target.elements[`${relay}-label`].value,
      powerWatts: Number(event.target.elements[`${relay}-watts`].value)
    };
  });
  const response = await fetchJSON(`/api/device/${DEVICE_ID}/metrics`, { method: 'PUT', body: JSON.stringify(payload) });
  renderMetrics(response.data);
};

async function toggleRelay(relay) {
  const response = await fetchJSON(`/api/device/${DEVICE_ID}/state`);
  const next = { ...response.data.desired, [relay]: !response.data.desired[relay] };
  await setAllState(next);
}

async function setAll(state) {
  await setAllState({ r1: state, r2: state, r3: state });
}

async function setAllState(state) {
  await fetchJSON(`/api/device/${DEVICE_ID}/set?r1=${state.r1 ? 1 : 0}&r2=${state.r2 ? 1 : 0}&r3=${state.r3 ? 1 : 0}`);
  await refreshState();
}

if (token) {
  auth.hidden = true;
  panel.hidden = false;
  refreshState();
}

showPage('control');

setInterval(() => {
  if (token) refreshState();
}, 2500);
