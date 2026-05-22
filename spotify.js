/**
 * spotify.js — Integração Spotify Web Playback SDK
 * 
 * Como configurar:
 * 1. Acesse https://developer.spotify.com/dashboard
 * 2. Crie um app e copie o Client ID
 * 3. Em "Edit Settings", adicione como Redirect URI:
 *    http://localhost:5500 (ou o URL onde está rodando o projeto)
 * 4. Cole o Client ID no campo dentro do app
 *
 * Conta Spotify Premium é necessária para o Web Playback SDK.
 */

// ==================== CONFIGURAÇÃO ====================
const SPOTIFY_SCOPES = [
  'streaming',
  'user-read-email',
  'user-read-private',
  'user-read-playback-state',
  'user-modify-playback-state',
  'user-read-currently-playing',
].join(' ');

const SPOTIFY_LS_KEY = 'fp_spotify_token';

let spotifyPlayer = null;
let spotifyDeviceId = null;
let spotifyAccessToken = null;
let spotifyRefreshTimer = null;

// ==================== ESTADO INICIAL ====================
function spotifyInit() {
  // Captura token do hash após redirect OAuth
  const hash = window.location.hash;
  if (hash && hash.includes('access_token')) {
    const params = new URLSearchParams(hash.replace('#', '?'));
    const token = params.get('access_token');
    const expiresIn = parseInt(params.get('expires_in') || '3600');
    if (token) {
      spotifyAccessToken = token;
      localStorage.setItem(SPOTIFY_LS_KEY, JSON.stringify({
        token,
        expiresAt: Date.now() + expiresIn * 1000
      }));
      // Limpa o hash da URL
      history.replaceState(null, '', window.location.pathname);
      spotifyOnTokenReady();
      return;
    }
  }

  // Verifica token salvo
  try {
    const saved = JSON.parse(localStorage.getItem(SPOTIFY_LS_KEY) || 'null');
    if (saved && saved.expiresAt > Date.now() + 60000) {
      spotifyAccessToken = saved.token;
      spotifyOnTokenReady();
    }
  } catch {}
}

// ==================== CONECTAR ====================
window.spotifyConnect = function() {
  const clientId = document.getElementById('spotify-client-id').value.trim();
  if (!clientId) {
    if (typeof showToast === 'function') showToast('Cole seu Client ID do Spotify!', 'error');
    return;
  }
  localStorage.setItem('fp_spotify_client_id', clientId);
  const redirectUri = encodeURIComponent(window.location.origin + window.location.pathname);
  const url = `https://accounts.spotify.com/authorize?client_id=${clientId}&response_type=token&redirect_uri=${redirectUri}&scope=${encodeURIComponent(SPOTIFY_SCOPES)}&show_dialog=true`;
  window.location.href = url;
};

// ==================== APÓS TER O TOKEN ====================
function spotifyOnTokenReady() {
  document.getElementById('spotify-connect-section').style.display = 'none';
  document.getElementById('spotify-player-section').style.display = '';
  document.getElementById('spotify-status-badge').textContent = 'Conectando…';
  document.getElementById('spotify-status-badge').className = 'spotify-badge spotify-badge-off';
  spotifyInitSDK();
}

// ==================== SDK PLAYER ====================
window.onSpotifyWebPlaybackSDKReady = function() {
  // Aguarda token estar pronto
  if (spotifyAccessToken) spotifyInitSDK();
};

function spotifyInitSDK() {
  if (!spotifyAccessToken || !window.Spotify) return;

  spotifyPlayer = new window.Spotify.Player({
    name: 'FocusPlay Arena 🌱',
    getOAuthToken: cb => cb(spotifyAccessToken),
    volume: 0.7
  });

  spotifyPlayer.addListener('ready', ({ device_id }) => {
    spotifyDeviceId = device_id;
    document.getElementById('spotify-status-badge').textContent = '● Pronto';
    document.getElementById('spotify-status-badge').className = 'spotify-badge spotify-badge-on';
    if (typeof showToast === 'function') showToast('🎵 Spotify conectado!', 'success');
  });

  spotifyPlayer.addListener('not_ready', () => {
    document.getElementById('spotify-status-badge').textContent = 'Offline';
    document.getElementById('spotify-status-badge').className = 'spotify-badge spotify-badge-off';
  });

  spotifyPlayer.addListener('player_state_changed', state => {
    if (!state) return;
    const track = state.track_window?.current_track;
    if (track) spotifyUpdateNowPlaying(track, !state.paused);
  });

  spotifyPlayer.addListener('initialization_error', ({ message }) => {
    console.error('Spotify init error:', message);
    spotifyShowError('Erro ao inicializar. Verifique sua conta Premium.');
  });

  spotifyPlayer.addListener('authentication_error', () => {
    spotifyShowError('Token expirado. Reconecte o Spotify.');
    spotifyAccessToken = null;
    localStorage.removeItem(SPOTIFY_LS_KEY);
  });

  spotifyPlayer.addListener('account_error', () => {
    spotifyShowError('Spotify Premium necessário para o player.');
  });

  spotifyPlayer.connect();
}

// ==================== NOW PLAYING ====================
function spotifyUpdateNowPlaying(track, isPlaying) {
  const nowPlaying = document.getElementById('spotify-now-playing');
  nowPlaying.style.display = 'flex';

  document.getElementById('sp-track-name').textContent = track.name;
  document.getElementById('sp-artist').textContent = track.artists?.map(a => a.name).join(', ') || '—';

  const art = track.album?.images?.[0]?.url;
  const artEl = document.getElementById('sp-album-art');
  artEl.src = art || '';
  artEl.style.display = art ? 'block' : 'none';

  const playBtn = document.getElementById('sp-play-btn');
  playBtn.textContent = isPlaying ? '⏸' : '▶';
}

// ==================== CONTROLES ====================
window.spotifyTogglePlay = function() {
  if (spotifyPlayer) spotifyPlayer.togglePlay();
};

window.spotifyNext = function() {
  if (spotifyPlayer) spotifyPlayer.nextTrack();
};

window.spotifyPrev = function() {
  if (spotifyPlayer) spotifyPlayer.previousTrack();
};

window.spotifySetVolume = function(val) {
  if (spotifyPlayer) spotifyPlayer.setVolume(val / 100);
};

// ==================== BUSCA ====================
window.spotifySearch = async function() {
  if (!spotifyAccessToken) return;
  const query = document.getElementById('spotify-search-input').value.trim();
  if (!query) return;

  const resultsEl = document.getElementById('spotify-search-results');
  resultsEl.innerHTML = '<div style="text-align:center;padding:0.5rem;color:var(--text-muted);font-size:0.8rem">Buscando...</div>';

  try {
    const res = await fetch(
      `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track,playlist&limit=8`,
      { headers: { Authorization: `Bearer ${spotifyAccessToken}` } }
    );
    const data = await res.json();

    resultsEl.innerHTML = '';
    const tracks = data.tracks?.items || [];
    const playlists = data.playlists?.items || [];
    const all = [...tracks.slice(0,5), ...playlists.slice(0,3)];

    if (!all.length) {
      resultsEl.innerHTML = '<div style="text-align:center;padding:0.5rem;color:var(--text-muted);font-size:0.8rem">Nenhum resultado</div>';
      return;
    }

    all.forEach(item => {
      const isPlaylist = item.type === 'playlist';
      const name = item.name;
      const sub = isPlaylist
        ? `${item.tracks?.total || '?'} músicas`
        : item.artists?.map(a => a.name).join(', ');
      const img = isPlaylist
        ? item.images?.[0]?.url
        : item.album?.images?.[0]?.url;
      const uri = item.uri;
      const type = isPlaylist ? 'Playlist' : 'Música';

      const el = document.createElement('div');
      el.className = 'spotify-result-item';
      el.innerHTML = `
        ${img ? `<img class="sp-result-thumb" src="${img}" alt="">` : '<div class="sp-result-thumb" style="background:var(--border);border-radius:4px"></div>'}
        <div class="sp-result-info">
          <div class="sp-result-name">${name}</div>
          <div class="sp-result-artist">${sub}</div>
          <div class="sp-result-type">${type}</div>
        </div>
      `;
      el.onclick = () => {
        if (isPlaylist) spotifyPlayContext(uri);
        else spotifyPlayTrack(uri);
        resultsEl.innerHTML = '';
        document.getElementById('spotify-search-input').value = '';
      };
      resultsEl.appendChild(el);
    });
  } catch (e) {
    resultsEl.innerHTML = '<div style="text-align:center;padding:0.5rem;color:var(--accent4);font-size:0.8rem">Erro na busca</div>';
    console.error('Spotify search error:', e);
  }
};

// ==================== TOCAR ====================
window.spotifyPlayTrack = async function(uri) {
  if (!spotifyAccessToken || !spotifyDeviceId) {
    if (typeof showToast === 'function') showToast('Spotify não conectado ainda', 'error');
    return;
  }
  try {
    await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${spotifyDeviceId}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${spotifyAccessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ uris: [uri] })
    });
  } catch(e) { console.error('Play error:', e); }
};

window.spotifyPlayContext = async function(contextUri) {
  if (!spotifyAccessToken || !spotifyDeviceId) {
    if (typeof showToast === 'function') showToast('Spotify não conectado ainda', 'error');
    return;
  }
  try {
    await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${spotifyDeviceId}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${spotifyAccessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ context_uri: contextUri })
    });
  } catch(e) { console.error('Play context error:', e); }
};

// ==================== DESCONECTAR ====================
window.spotifyDisconnect = function() {
  if (spotifyPlayer) {
    spotifyPlayer.disconnect();
    spotifyPlayer = null;
  }
  spotifyAccessToken = null;
  spotifyDeviceId = null;
  localStorage.removeItem(SPOTIFY_LS_KEY);

  document.getElementById('spotify-connect-section').style.display = '';
  document.getElementById('spotify-player-section').style.display = 'none';
  document.getElementById('spotify-status-badge').textContent = 'Desconectado';
  document.getElementById('spotify-status-badge').className = 'spotify-badge spotify-badge-off';
  document.getElementById('spotify-now-playing').style.display = 'none';

  const savedClientId = localStorage.getItem('fp_spotify_client_id') || '';
  document.getElementById('spotify-client-id').value = savedClientId;

  if (typeof showToast === 'function') showToast('Spotify desconectado', 'warning');
};

// ==================== ERRO ====================
function spotifyShowError(msg) {
  if (typeof showToast === 'function') showToast('🎵 ' + msg, 'error');
  document.getElementById('spotify-status-badge').textContent = 'Erro';
  document.getElementById('spotify-status-badge').className = 'spotify-badge spotify-badge-off';
}

// ==================== AUTO-INIT ====================
// Preenche o campo de client id se já salvo
document.addEventListener('DOMContentLoaded', () => {
  const savedClientId = localStorage.getItem('fp_spotify_client_id') || '';
  const el = document.getElementById('spotify-client-id');
  if (el && savedClientId) el.value = savedClientId;
  spotifyInit();
});
