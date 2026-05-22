/**
 * spotify.js — Integração Spotify Web Playback SDK
 * Fluxo: Authorization Code + PKCE
 */

// ==================== ⚙️ CONFIGURAÇÃO ====================
const SPOTIFY_CLIENT_ID = '6d04f882a6894246aa5da2a161df1066';
// =========================================================

const SPOTIFY_SCOPES = [
  'streaming',
  'user-read-email',
  'user-read-private',
  'user-read-playback-state',
  'user-modify-playback-state',
  'user-read-currently-playing',
].join(' ');

const SPOTIFY_LS_TOKEN_KEY   = 'fp_spotify_token';
const SPOTIFY_LS_VERIFIER_KEY = 'fp_spotify_pkce_verifier';

let spotifyPlayer      = null;
let spotifyDeviceId    = null;
let spotifyAccessToken = null;
let spotifySDKReady    = false;
let spotifySDKInited   = false;
let spotifyProgressInterval = null;
let spotifyDuration    = 0;

// ==================== PKCE HELPERS ====================
function generateRandomString(length) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  const arr = new Uint8Array(length);
  crypto.getRandomValues(arr);
  return Array.from(arr).map(b => chars[b % chars.length]).join('');
}
async function sha256(plain) {
  return crypto.subtle.digest('SHA-256', new TextEncoder().encode(plain));
}
function base64UrlEncode(buffer) {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}
async function generatePKCE() {
  const verifier  = generateRandomString(64);
  const challenge = base64UrlEncode(await sha256(verifier));
  return { verifier, challenge };
}

// ==================== TROCA CÓDIGO POR TOKEN ====================
async function exchangeCodeForToken(code, verifier) {
  const redirectUri = window.location.origin + window.location.pathname;
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code, redirect_uri: redirectUri,
      client_id: SPOTIFY_CLIENT_ID,
      code_verifier: verifier,
    }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error_description || 'Falha ao obter token');
  }
  return res.json();
}

// ==================== REFRESH TOKEN ====================
async function spotifyRefreshAccessToken(refreshToken) {
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: SPOTIFY_CLIENT_ID,
    }),
  });
  if (!res.ok) return null;
  return res.json();
}

// ==================== CONECTAR ====================
window.spotifyConnect = async function() {
  if (!SPOTIFY_CLIENT_ID || SPOTIFY_CLIENT_ID === 'SEU_CLIENT_ID_AQUI') {
    if (typeof showToast === 'function') showToast('⚙️ Client ID não configurado!', 'error');
    return;
  }
  const { verifier, challenge } = await generatePKCE();
  localStorage.setItem(SPOTIFY_LS_VERIFIER_KEY, verifier);
  const redirectUri = encodeURIComponent(window.location.origin + window.location.pathname);
  window.location.href = [
    'https://accounts.spotify.com/authorize',
    `?client_id=${SPOTIFY_CLIENT_ID}`,
    `&response_type=code`,
    `&redirect_uri=${redirectUri}`,
    `&scope=${encodeURIComponent(SPOTIFY_SCOPES)}`,
    `&code_challenge_method=S256`,
    `&code_challenge=${challenge}`,
    `&show_dialog=true`,
  ].join('');
};

// ==================== INIT ====================
async function spotifyInit() {
  const params = new URLSearchParams(window.location.search);
  const code   = params.get('code');
  const error  = params.get('error');

  if (error) {
    if (typeof showToast === 'function') showToast('Autorização cancelada.', 'warning');
    history.replaceState(null, '', window.location.pathname);
    return;
  }

  if (code) {
    const verifier = localStorage.getItem(SPOTIFY_LS_VERIFIER_KEY);
    localStorage.removeItem(SPOTIFY_LS_VERIFIER_KEY);
    history.replaceState(null, '', window.location.pathname);
    try {
      const tokenData = await exchangeCodeForToken(code, verifier);
      spotifyAccessToken = tokenData.access_token;
      localStorage.setItem(SPOTIFY_LS_TOKEN_KEY, JSON.stringify({
        accessToken:  tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        expiresAt:    Date.now() + tokenData.expires_in * 1000,
      }));
      spotifyOnTokenReady();
    } catch(e) {
      console.error('Token exchange error:', e);
      if (typeof showToast === 'function') showToast('Erro ao conectar: ' + e.message, 'error');
    }
    return;
  }

  try {
    const saved = JSON.parse(localStorage.getItem(SPOTIFY_LS_TOKEN_KEY) || 'null');
    if (!saved) return;
    if (saved.expiresAt > Date.now() + 120_000) {
      spotifyAccessToken = saved.accessToken;
      spotifyOnTokenReady();
      return;
    }
    if (saved.refreshToken) {
      const refreshed = await spotifyRefreshAccessToken(saved.refreshToken);
      if (refreshed) {
        spotifyAccessToken = refreshed.access_token;
        localStorage.setItem(SPOTIFY_LS_TOKEN_KEY, JSON.stringify({
          accessToken:  refreshed.access_token,
          refreshToken: refreshed.refresh_token || saved.refreshToken,
          expiresAt:    Date.now() + refreshed.expires_in * 1000,
        }));
        spotifyOnTokenReady();
        return;
      }
    }
    localStorage.removeItem(SPOTIFY_LS_TOKEN_KEY);
  } catch {}
}

// ==================== APÓS TER O TOKEN ====================
function spotifyOnTokenReady() {
  document.getElementById('spotify-connect-section').style.display = 'none';
  document.getElementById('spotify-player-section').style.display  = '';
  document.getElementById('spotify-status-badge').textContent = 'Conectando…';
  document.getElementById('spotify-status-badge').className   = 'spotify-badge spotify-badge-off';
  spotifyInitSDK();
}

// ==================== SDK ====================
window.onSpotifyWebPlaybackSDKReady = function() {
  spotifySDKReady = true;
  if (spotifyAccessToken) spotifyInitSDK();
};

function spotifyInitSDK() {
  if (spotifySDKInited) return;
  if (!spotifyAccessToken || !window.Spotify || !spotifySDKReady) return;
  spotifySDKInited = true;

  spotifyPlayer = new window.Spotify.Player({
    name: 'FocusPlay Arena 🌱',
    getOAuthToken: cb => cb(spotifyAccessToken),
    volume: 0.7,
  });

  spotifyPlayer.addListener('ready', ({ device_id }) => {
    spotifyDeviceId = device_id;
    document.getElementById('spotify-status-badge').textContent = '● Pronto';
    document.getElementById('spotify-status-badge').className   = 'spotify-badge spotify-badge-on';
    if (typeof showToast === 'function') showToast('🎵 Spotify conectado!', 'success');
    // Transfere reprodução para este dispositivo automaticamente
    fetch(`https://api.spotify.com/v1/me/player`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${spotifyAccessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ device_ids: [device_id], play: false }),
    }).catch(() => {});
  });

  spotifyPlayer.addListener('not_ready', () => {
    spotifyDeviceId = null;
    document.getElementById('spotify-status-badge').textContent = 'Offline';
    document.getElementById('spotify-status-badge').className   = 'spotify-badge spotify-badge-off';
  });

  spotifyPlayer.addListener('player_state_changed', state => {
    if (!state) return;
    const track = state.track_window?.current_track;
    if (track) {
      spotifyDuration = state.duration;
      spotifyUpdateNowPlaying(track, !state.paused, state.position, state.duration);
      if (!state.paused) {
        spotifyStartProgressTick(state.position, state.duration);
      } else {
        spotifyStopProgressTick();
      }
    }
  });

  spotifyPlayer.addListener('initialization_error', ({ message }) => {
    console.error('Spotify init error:', message);
    spotifyShowError('Erro ao inicializar. Verifique sua conta Premium.');
  });

  spotifyPlayer.addListener('authentication_error', () => {
    spotifyShowError('Token expirado. Reconecte o Spotify.');
    spotifyAccessToken = null;
    spotifySDKInited   = false;
    localStorage.removeItem(SPOTIFY_LS_TOKEN_KEY);
    document.getElementById('spotify-connect-section').style.display = '';
    document.getElementById('spotify-player-section').style.display  = 'none';
  });

  spotifyPlayer.addListener('account_error', () => {
    spotifyShowError('Spotify Premium necessário para o player.');
  });

  spotifyPlayer.connect();
}

// ==================== NOW PLAYING ====================
function spotifyUpdateNowPlaying(track, isPlaying, position, duration) {
  document.getElementById('spotify-now-playing').style.display = 'flex';
  document.getElementById('sp-track-name').textContent = track.name;
  document.getElementById('sp-artist').textContent = track.artists?.map(a => a.name).join(', ') || '—';

  const art = track.album?.images?.[0]?.url;
  const artEl = document.getElementById('sp-album-art');
  artEl.src = art || '';
  artEl.style.display = art ? 'block' : 'none';

  document.getElementById('sp-play-btn').textContent = isPlaying ? '⏸' : '▶';

  if (duration) {
    const pct = (position / duration) * 100;
    document.getElementById('sp-progress-bar').style.width = pct + '%';
    document.getElementById('sp-time-current').textContent = formatTime(position);
    document.getElementById('sp-time-total').textContent   = formatTime(duration);
  }
}

function formatTime(ms) {
  const s   = Math.floor(ms / 1000);
  const min = Math.floor(s / 60);
  const sec = s % 60;
  return `${min}:${sec.toString().padStart(2, '0')}`;
}

// ==================== PROGRESSO (tick local) ====================
let _progressPosition = 0;
let _progressStart    = 0;

function spotifyStartProgressTick(position, duration) {
  spotifyStopProgressTick();
  _progressPosition = position;
  _progressStart    = Date.now();

  spotifyProgressInterval = setInterval(() => {
    const elapsed = Date.now() - _progressStart;
    const current = _progressPosition + elapsed;
    if (current >= duration) {
      spotifyStopProgressTick();
      return;
    }
    const pct = (current / duration) * 100;
    const bar = document.getElementById('sp-progress-bar');
    const cur = document.getElementById('sp-time-current');
    if (bar) bar.style.width = pct + '%';
    if (cur) cur.textContent = formatTime(current);
  }, 500);
}

function spotifyStopProgressTick() {
  if (spotifyProgressInterval) {
    clearInterval(spotifyProgressInterval);
    spotifyProgressInterval = null;
  }
}

// Seek ao clicar na barra de progresso
window.spotifySeek = function(e) {
  if (!spotifyPlayer || !spotifyDuration) return;
  const bar  = e.currentTarget;
  const rect = bar.getBoundingClientRect();
  const pct  = (e.clientX - rect.left) / rect.width;
  const ms   = Math.floor(pct * spotifyDuration);
  spotifyPlayer.seek(ms);
};

// ==================== CONTROLES ====================
window.spotifyTogglePlay = function() {
  if (!spotifyPlayer) return;
  spotifyPlayer.togglePlay().then(() => {
    spotifyPlayer.getCurrentState().then(state => {
      if (!state) return;
      document.getElementById('sp-play-btn').textContent = state.paused ? '▶' : '⏸';
      if (!state.paused) {
        spotifyStartProgressTick(state.position, state.duration);
      } else {
        spotifyStopProgressTick();
        _progressPosition = state.position;
      }
    });
  });
};

window.spotifyNext = function() {
  if (spotifyPlayer) spotifyPlayer.nextTrack();
};

window.spotifyPrev = function() {
  if (spotifyPlayer) spotifyPlayer.previousTrack();
};

window.spotifySetVolume = function(val) {
  if (spotifyPlayer) spotifyPlayer.setVolume(parseFloat(val) / 100);
};

// ==================== BUSCA ====================
window.spotifySearch = async function() {
  if (!spotifyAccessToken) return;
  const query = document.getElementById('spotify-search-input').value.trim();
  if (!query) return;

  const resultsEl = document.getElementById('spotify-search-results');
  resultsEl.innerHTML = '<div style="text-align:center;padding:0.5rem;color:var(--text-muted);font-size:0.8rem">Buscando...</div>';

  try {
    const res  = await fetch(
      `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track,playlist&limit=8`,
      { headers: { Authorization: `Bearer ${spotifyAccessToken}` } }
    );
    const data = await res.json();
    resultsEl.innerHTML = '';
    const all = [...(data.tracks?.items || []).slice(0, 5), ...(data.playlists?.items || []).slice(0, 3)];

    if (!all.length) {
      resultsEl.innerHTML = '<div style="text-align:center;padding:0.5rem;color:var(--text-muted);font-size:0.8rem">Nenhum resultado</div>';
      return;
    }

    all.forEach(item => {
      const isPlaylist = item.type === 'playlist';
      const img  = isPlaylist ? item.images?.[0]?.url : item.album?.images?.[0]?.url;
      const sub  = isPlaylist ? `${item.tracks?.total || '?'} músicas` : item.artists?.map(a => a.name).join(', ');
      const el   = document.createElement('div');
      el.className = 'spotify-result-item';
      el.innerHTML = `
        ${img ? `<img class="sp-result-thumb" src="${img}" alt="">` : '<div class="sp-result-thumb" style="background:var(--border);border-radius:4px"></div>'}
        <div class="sp-result-info">
          <div class="sp-result-name">${item.name}</div>
          <div class="sp-result-artist">${sub}</div>
          <div class="sp-result-type">${isPlaylist ? 'Playlist' : 'Música'}</div>
        </div>`;
      el.onclick = () => {
        if (isPlaylist) spotifyPlayContext(item.uri);
        else spotifyPlayTrack(item.uri);
        resultsEl.innerHTML = '';
        document.getElementById('spotify-search-input').value = '';
      };
      resultsEl.appendChild(el);
    });
  } catch(e) {
    resultsEl.innerHTML = '<div style="text-align:center;padding:0.5rem;color:var(--accent4);font-size:0.8rem">Erro na busca</div>';
    console.error('Search error:', e);
  }
};

// ==================== TOCAR ====================
window.spotifyPlayTrack = async function(uri) {
  if (!spotifyAccessToken || !spotifyDeviceId) {
    if (typeof showToast === 'function') showToast('Spotify não conectado ainda', 'error');
    return;
  }
  await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${spotifyDeviceId}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${spotifyAccessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ uris: [uri] }),
  }).catch(e => console.error('Play error:', e));
};

window.spotifyPlayContext = async function(contextUri) {
  if (!spotifyAccessToken || !spotifyDeviceId) {
    if (typeof showToast === 'function') showToast('Spotify não conectado ainda', 'error');
    return;
  }
  await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${spotifyDeviceId}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${spotifyAccessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ context_uri: contextUri }),
  }).catch(e => console.error('Play context error:', e));
};

// ==================== DESCONECTAR ====================
window.spotifyDisconnect = function() {
  spotifyStopProgressTick();
  if (spotifyPlayer) { spotifyPlayer.disconnect(); spotifyPlayer = null; }
  spotifyAccessToken = null;
  spotifyDeviceId    = null;
  spotifySDKInited   = false;
  localStorage.removeItem(SPOTIFY_LS_TOKEN_KEY);

  document.getElementById('spotify-connect-section').style.display = '';
  document.getElementById('spotify-player-section').style.display  = 'none';
  document.getElementById('spotify-status-badge').textContent = 'Desconectado';
  document.getElementById('spotify-status-badge').className   = 'spotify-badge spotify-badge-off';
  document.getElementById('spotify-now-playing').style.display = 'none';

  if (typeof showToast === 'function') showToast('Spotify desconectado', 'warning');
};

// ==================== ERRO ====================
function spotifyShowError(msg) {
  if (typeof showToast === 'function') showToast('🎵 ' + msg, 'error');
  document.getElementById('spotify-status-badge').textContent = 'Erro';
  document.getElementById('spotify-status-badge').className   = 'spotify-badge spotify-badge-off';
}

// ==================== AUTO-INIT ====================
document.addEventListener('DOMContentLoaded', () => spotifyInit());
