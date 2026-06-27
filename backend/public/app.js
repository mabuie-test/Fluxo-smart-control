const DEVICE_ID = window.APP_CONFIG?.deviceId || 'CASA01';
const RELAYS = ['r1', 'r2', 'r3'];
let token = localStorage.getItem('token') || '';

const mapBool = (value) => (value ? 'LIGADA' : 'DESLIGADA');

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
  rssi.textContent = device.rssi == null ? '—' : `${device.rssi} dBm`;
  if (!energyPage.hidden && device.energy) renderEnergy(device.energy);
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
  } catch (err) {
    if (String(err.message).includes('401')) logout();
    syncState.textContent = 'Erro de ligação';
  }
}

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

setInterval(() => {
  if (token) {
    refreshState();
    refreshEnergy().catch(() => {});
  }
}, 2500);

function showEnergyPage() {
  energyPage.hidden = false;
  energyPage.scrollIntoView({ behavior: 'smooth', block: 'start' });
  refreshEnergy();
}

function hideEnergyPage() {
  energyPage.hidden = true;
}

function formatKwh(value) {
  return `${Number(value || 0).toFixed(4)} kWh`;
}

function rssiLabel(value) {
  if (value == null || value === '') return 'Sem leitura de sinal';
  if (value >= -70) return 'Sinal forte';
  if (value >= -85) return 'Sinal médio';
  if (value >= -100) return 'Sinal fraco';
  return 'Sinal crítico';
}

function renderEnergy(energy) {
  const rssiText = energy.rssi == null ? '—' : `${energy.rssi} dBm`;
  energyRssi.textContent = rssiText;
  energyRssiLabel.textContent = rssiLabel(energy.rssi);
  totalKwh.textContent = formatKwh(energy.totalEnergyKwh);

  RELAYS.forEach((relay) => {
    if (powerForm.elements[relay] && document.activeElement !== powerForm.elements[relay]) {
      powerForm.elements[relay].value = energy.powerWatts?.[relay] ?? '';
    }
  });

  energyCards.innerHTML = '';
  energy.relays.forEach((item) => {
    const card = document.createElement('article');
    card.className = 'energy-card';
    const sessions = item.sessions.length
      ? item.sessions.map((session) => `<li>${new Date(session.start).toLocaleString()} → ${new Date(session.end).toLocaleString()} · ${session.durationLabel} · ${formatKwh(session.energyKwh)}</li>`).join('')
      : '<li>Sem ciclos concluídos.</li>';
    card.innerHTML = `
      <h3>${item.relay.toUpperCase()}</h3>
      <div class="metric"><span>Potência</span><strong>${item.powerWatts} W</strong></div>
      <div class="metric"><span>Tempo ligada</span><strong>${item.durationLabel}</strong></div>
      <div class="metric"><span>Consumo</span><strong>${formatKwh(item.energyKwh)}</strong></div>
      <div class="metric"><span>Ciclo atual</span><strong>${item.currentOnSince ? `${item.currentOnDurationSeconds}s` : 'desligada'}</strong></div>
      <ul class="usage-list">${sessions}</ul>`;
    energyCards.appendChild(card);
  });
}

async function refreshEnergy() {
  if (energyPage.hidden) return;
  const response = await fetchJSON(`/api/device/${DEVICE_ID}/energy`);
  renderEnergy(response.data);
}

powerForm.onsubmit = async (event) => {
  event.preventDefault();
  const payload = formData(event.target);
  const response = await fetchJSON(`/api/device/${DEVICE_ID}/energy`, {
    method: 'PUT',
    body: JSON.stringify(payload)
  });
  renderEnergy(response.data);
};
