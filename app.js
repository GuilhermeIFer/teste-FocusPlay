/**
 * app.js — Lógica principal do FocusPlay Arena
 * Módulo ES com Firebase e integração ao Spotify
 */

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import {
  getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword,
  signOut, onAuthStateChanged, updateProfile
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import {
  getFirestore, doc, setDoc, getDoc, updateDoc,
  collection, query, orderBy, limit, getDocs, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// ==================== FIREBASE CONFIG ====================
// Substitua com suas credenciais: https://console.firebase.google.com
const FIREBASE_CONFIG = {
  apiKey: "COLOQUE_SUA_API_KEY",
  authDomain: "COLOQUE_SEU_AUTH_DOMAIN",
  projectId: "COLOQUE_SEU_PROJECT_ID",
  storageBucket: "COLOQUE_SEU_STORAGE_BUCKET",
  messagingSenderId: "COLOQUE_SEU_MSG_SENDER",
  appId: "COLOQUE_SEU_APP_ID"
};

let app, auth, db;
let useFirebase = false;

try {
  if (FIREBASE_CONFIG.apiKey !== "COLOQUE_SUA_API_KEY") {
    app = initializeApp(FIREBASE_CONFIG);
    auth = getAuth(app);
    db = getFirestore(app);
    useFirebase = true;
    console.log("🔥 Firebase conectado!");
  } else {
    console.log("⚡ Modo offline (localStorage) — configure Firebase para cloud");
  }
} catch(e) {
  console.warn("Firebase não configurado, usando localStorage", e);
}

// ==================== LOCAL STORAGE DB ====================
const LS = {
  get: (k, def=null) => { try { const v = localStorage.getItem('fp_'+k); return v ? JSON.parse(v) : def; } catch { return def; } },
  set: (k, v) => { try { localStorage.setItem('fp_'+k, JSON.stringify(v)); } catch {} },
  del: (k) => { try { localStorage.removeItem('fp_'+k); } catch {} }
};

// ==================== GAME DATA ====================
const PLANTS = [
  { id:'wheat',    emoji:'🌾', name:'Trigo',      rarity:'common',    sessionMins:1,  coinYield:15,  seedCost:0,   unlockLevel:1,  desc:'Cresce rápido, rende pouco. Boa para começar.' },
  { id:'carrot',   emoji:'🥕', name:'Cenoura',    rarity:'common',    sessionMins:2,  coinYield:25,  seedCost:10,  unlockLevel:1,  desc:'Simples e confiável.' },
  { id:'corn',     emoji:'🌽', name:'Milho',      rarity:'common',    sessionMins:3,  coinYield:40,  seedCost:20,  unlockLevel:2,  desc:'Clássico da fazenda.' },
  { id:'tomato',   emoji:'🍅', name:'Tomate',     rarity:'rare',      sessionMins:5,  coinYield:80,  seedCost:50,  unlockLevel:3,  desc:'Precisa de atenção. Qualidade cai se você sair.' },
  { id:'pumpkin',  emoji:'🎃', name:'Abóbora',    rarity:'rare',      sessionMins:7,  coinYield:120, seedCost:80,  unlockLevel:4,  desc:'Robusta mas exigente.' },
  { id:'grape',    emoji:'🍇', name:'Uva',        rarity:'epic',      sessionMins:10, coinYield:200, seedCost:150, unlockLevel:5,  desc:'Progresso regride se você sair.' },
  { id:'melon',    emoji:'🍈', name:'Melão',      rarity:'epic',      sessionMins:12, coinYield:280, seedCost:200, unlockLevel:6,  desc:'Alta recompensa, alto risco.' },
  { id:'truffle',  emoji:'🍄', name:'Trufa',      rarity:'legendary', sessionMins:20, coinYield:500, seedCost:400, unlockLevel:8,  desc:'MORRE se você sair durante a sessão!' },
  { id:'crystal',  emoji:'💎', name:'Cristal',    rarity:'legendary', sessionMins:25, coinYield:800, seedCost:600, unlockLevel:10, desc:'A planta mais valiosa. Extremamente frágil.' },
];

const PLANT_STAGES = ['🌰','🌱','🌿','🪴'];
const RARITY_COLOR = { common:'q-common', rare:'q-rare', epic:'q-epic', legendary:'q-legendary' };
const RARITY_LABEL = { common:'Comum', rare:'Raro', epic:'Épico', legendary:'Lendário' };
const PENALTY_RULES = { common:'freeze', rare:'degrade', epic:'regress', legendary:'die' };

const SHOP_ITEMS = {
  expansions: [
    { id:'slot4',      name:'4º Slot',    icon:'🪣', price:200,  desc:'Plante 4 plantas por sessão',          effect:'slots', val:4 },
    { id:'slot5',      name:'5º Slot',    icon:'🪣', price:400,  desc:'Plante 5 plantas por sessão',          effect:'slots', val:5 },
    { id:'slot6',      name:'6º Slot',    icon:'🪣', price:700,  desc:'Plante 6 plantas por sessão',          effect:'slots', val:6 },
    { id:'greenhouse', name:'Estufa',     icon:'🏡', price:1500, desc:'+50% rendimento de todas as plantas',  effect:'greenhouse', val:1.5 },
  ],
  upgrades: [
    { id:'soil1',   name:'Solo Rico',     icon:'🌍', price:300, desc:'+20% rendimento de todas as plantas',  effect:'soil', val:1.2 },
    { id:'soil2',   name:'Solo Fértil',   icon:'🌏', price:600, desc:'+50% rendimento (acumulativo)',        effect:'soil', val:1.5 },
    { id:'fert1',   name:'Fertilizante',  icon:'🧪', price:100, desc:'Acelera 1 planta na próxima sessão',   effect:'fertilizer', val:1, consumable:true, qty:3 },
  ],
  cosmetics: [
    { id:'pet_cat',   name:'Gato Fofo',   icon:'🐱', price:500, desc:'Seu pet fica na fazenda te acompanhando' },
    { id:'pet_dog',   name:'Cachorro',    icon:'🐶', price:500, desc:'Fiel companheiro de estudos' },
    { id:'pet_fox',   name:'Raposa',      icon:'🦊', price:800, desc:'Esperta como você' },
    { id:'deco_star', name:'Estrelas',    icon:'⭐', price:300, desc:'Decoração brilhante para a fazenda' },
    { id:'deco_rain', name:'Chuva',       icon:'🌧️', price:300, desc:'Efeito de chuva na fazenda' },
  ]
};

const LEVELS = [
  { level:1,  name:'Sementinha',  emoji:'🌱', xpNeeded:0    },
  { level:2,  name:'Brotinho',    emoji:'🌿', xpNeeded:100  },
  { level:3,  name:'Agricultor',  emoji:'🧑‍🌾', xpNeeded:250  },
  { level:4,  name:'Fazendeiro',  emoji:'🌾', xpNeeded:500  },
  { level:5,  name:'Mestre Foco', emoji:'🎯', xpNeeded:900  },
  { level:6,  name:'Cultivador',  emoji:'🪴', xpNeeded:1500 },
  { level:7,  name:'Guardião',    emoji:'🌳', xpNeeded:2500 },
  { level:8,  name:'Lendário',    emoji:'💫', xpNeeded:4000 },
  { level:9,  name:'Mítico',      emoji:'🌌', xpNeeded:6000 },
  { level:10, name:'Arquimago',   emoji:'💎', xpNeeded:9000 },
];

const DAILY_CHALLENGES = [
  { id:'ch_sessions', icon:'⏱️', name:'Maratonista', desc:'Complete 3 sessões hoje',          target:3,  xpReward:50, coinReward:30 },
  { id:'ch_streak',   icon:'🔥', name:'Sem parar',   desc:'Não saia durante 1 sessão inteira',target:1,  xpReward:40, coinReward:20 },
  { id:'ch_harvest',  icon:'🌾', name:'Colheita',    desc:'Colha 2 plantas hoje',              target:2,  xpReward:60, coinReward:40 },
  { id:'ch_long',     icon:'🎯', name:'Foco longo',  desc:'Complete uma sessão de 45 min',     target:45, xpReward:80, coinReward:50 },
];

// ==================== GAME STATE ====================
let GS = {
  uid: null, name: 'Jogador', email: null, avatar: '😊',
  xp: 0, coins: 0, level: 1, streak: 0,
  lastSessionDate: null, totalSessions: 0, todaySessions: 0,
  totalFocusMins: 0, totalPlants: 0,
  farmSlots: 3, farmPlots: [],
  inventory: { wheat: 5, carrot: 2 },
  timerDuration: 25, timerMode: 'solo',
  timerRunning: false, timerPhase: 'focus',
  timerSecondsLeft: 25*60, timerTotalSeconds: 25*60,
  sessionStartTime: null, sessionsThisPomodoro: 0,
  currentSessionMins: 0, awayStartTime: null,
  purchased: {}, soilMultiplier: 1.0,
  hasGreenhouse: false, fertilizedSlot: -1,
  todayChallenges: {}, challengeProgress: {},
  rankScore: 0, rankWeekly: 0,
};

let timerInterval = null;
let currentPickSlot = -1;

// ==================== LOAD / SAVE ====================
function loadState() {
  const saved = LS.get('gamestate');
  if (saved) {
    GS = Object.assign(GS, saved);
    GS.timerRunning = false;
    GS.timerSecondsLeft = GS.timerDuration * 60;
  }
  checkStreak();
  initDailyChallenges();
}

function saveState() {
  LS.set('gamestate', GS);
  if (useFirebase && GS.uid) {
    try {
      updateDoc(doc(db, 'users', GS.uid), {
        xp: GS.xp, coins: GS.coins, level: GS.level,
        streak: GS.streak, totalSessions: GS.totalSessions,
        totalFocusMins: GS.totalFocusMins, rankScore: GS.rankScore,
        rankWeekly: GS.rankWeekly, name: GS.name, avatar: GS.avatar,
        updatedAt: serverTimestamp()
      }).catch(()=>{});
    } catch {}
  }
}

async function loadFirebaseState(uid) {
  if (!useFirebase) return;
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    if (snap.exists()) {
      GS = Object.assign(GS, snap.data(), { uid, timerRunning: false });
      GS.timerSecondsLeft = GS.timerDuration * 60;
    }
  } catch(e) { console.warn('Firebase load error', e); }
}

async function saveFirebaseNew(uid, name) {
  if (!useFirebase) return;
  try {
    await setDoc(doc(db, 'users', uid), {
      uid, name, xp:0, coins:0, level:1, streak:0,
      totalSessions:0, totalFocusMins:0, rankScore:0, rankWeekly:0,
      createdAt: serverTimestamp()
    });
  } catch {}
}

// ==================== AUTH ====================
function switchAuthTab(tab) {
  document.querySelectorAll('.auth-tab').forEach((t,i) => t.classList.toggle('active', (tab==='login'?0:1)===i));
  document.getElementById('auth-form-login').style.display = tab==='login' ? '' : 'none';
  document.getElementById('auth-form-register').style.display = tab==='register' ? '' : 'none';
  document.getElementById('auth-error').textContent = '';
}
window.switchAuthTab = switchAuthTab;

async function doLogin() {
  const email = document.getElementById('login-email').value.trim();
  const pass = document.getElementById('login-password').value;
  if (!email || !pass) { setAuthError('Preencha todos os campos'); return; }
  if (useFirebase) {
    try {
      const cred = await signInWithEmailAndPassword(auth, email, pass);
      GS.uid = cred.user.uid;
      GS.name = cred.user.displayName || email.split('@')[0];
      GS.email = email;
      await loadFirebaseState(GS.uid);
      enterGame();
    } catch(e) { setAuthError(firebaseErr(e)); }
  } else {
    const users = LS.get('users', {});
    const user = users[email];
    if (!user || user.pass !== btoa(pass)) { setAuthError('Email ou senha incorretos'); return; }
    GS.uid = user.uid; GS.name = user.name; GS.email = email;
    const savedGS = LS.get('gs_'+GS.uid);
    if (savedGS) GS = Object.assign(GS, savedGS, { timerRunning: false });
    enterGame();
  }
}
window.doLogin = doLogin;

async function doRegister() {
  const name = document.getElementById('reg-name').value.trim();
  const email = document.getElementById('reg-email').value.trim();
  const pass = document.getElementById('reg-password').value;
  if (!name || !email || !pass) { setAuthError('Preencha todos os campos'); return; }
  if (pass.length < 6) { setAuthError('Senha muito curta (mín. 6 chars)'); return; }
  if (useFirebase) {
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, pass);
      await updateProfile(cred.user, { displayName: name });
      GS.uid = cred.user.uid; GS.name = name; GS.email = email;
      await saveFirebaseNew(GS.uid, name);
      enterGame();
    } catch(e) { setAuthError(firebaseErr(e)); }
  } else {
    const users = LS.get('users', {});
    if (users[email]) { setAuthError('Email já cadastrado'); return; }
    const uid = 'u_' + Date.now();
    users[email] = { uid, name, pass: btoa(pass) };
    LS.set('users', users);
    GS.uid = uid; GS.name = name; GS.email = email;
    saveState();
    enterGame();
  }
}
window.doRegister = doRegister;

function doGuest() {
  GS.uid = 'guest_' + Date.now();
  GS.name = 'Visitante';
  loadState();
  enterGame();
}
window.doGuest = doGuest;

function doLogout() {
  if (!confirm('Sair do jogo?')) return;
  saveState();
  if (timerInterval) clearInterval(timerInterval);
  GS = { uid:null, name:'Jogador', email:null, avatar:'😊', xp:0, coins:0, level:1, streak:0, lastSessionDate:null, totalSessions:0, todaySessions:0, totalFocusMins:0, totalPlants:0, farmSlots:3, farmPlots:[], inventory:{wheat:5, carrot:2}, timerDuration:25, timerMode:'solo', timerRunning:false, timerPhase:'focus', timerSecondsLeft:25*60, timerTotalSeconds:25*60, sessionStartTime:null, sessionsThisPomodoro:0, currentSessionMins:0, awayStartTime:null, purchased:{}, soilMultiplier:1.0, hasGreenhouse:false, fertilizedSlot:-1, todayChallenges:{}, challengeProgress:{}, rankScore:0, rankWeekly:0 };
  if (useFirebase) signOut(auth).catch(()=>{});
  showScreen('screen-auth');
}
window.doLogout = doLogout;

function setAuthError(msg) { document.getElementById('auth-error').textContent = msg; }
function firebaseErr(e) {
  const m = { 'auth/user-not-found':'Usuário não encontrado','auth/wrong-password':'Senha incorreta','auth/email-already-in-use':'Email já cadastrado','auth/weak-password':'Senha muito fraca','auth/invalid-email':'Email inválido' };
  return m[e.code] || 'Erro: ' + e.message;
}

// ==================== NAVIGATION ====================
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

function switchPage(id) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  document.querySelectorAll('.nav-btn').forEach((b,i) => {
    const pages = ['page-home','page-timer','page-farm','page-shop','page-ranking'];
    b.classList.toggle('active', pages[i]===id);
  });
  if (id==='page-farm') renderFarm();
  if (id==='page-shop') renderShop();
  if (id==='page-ranking') renderRanking();
  if (id==='page-home') renderHome();
}
window.switchPage = switchPage;

function enterGame() {
  loadState();
  updateHUD();
  renderHome();
  renderFarm();
  renderShop();
  renderRanking();
  showScreen('screen-main');
  document.getElementById('loading-screen').style.display = 'none';
  setupVisibilityAPI();

  // Carrega o módulo do Spotify após entrar no jogo
  import('./spotify.js').catch(e => console.warn('Spotify module:', e));
}

// ==================== HUD ====================
function updateHUD() {
  document.getElementById('hdr-xp').textContent = GS.xp;
  document.getElementById('hdr-coins').textContent = GS.coins;
  document.getElementById('hdr-streak').textContent = GS.streak;
  document.getElementById('hdr-avatar').textContent = GS.avatar;

  const cur  = LEVELS[GS.level-1];
  const next = LEVELS[GS.level] || { xpNeeded: 99999 };
  const pct  = Math.min(100, ((GS.xp - cur.xpNeeded) / (next.xpNeeded - cur.xpNeeded)) * 100);
  document.getElementById('xp-fill').style.width = pct + '%';
  document.getElementById('xp-text').textContent = `${GS.xp} / ${next.xpNeeded} XP`;
  document.getElementById('hero-level-badge').textContent = `Nv.${GS.level} ${cur.emoji}`;
  document.getElementById('hero-name').textContent = GS.name;

  document.getElementById('hs-sessions').textContent = GS.totalSessions;
  document.getElementById('hs-focus').textContent = Math.floor(GS.totalFocusMins/60) + 'h';
  document.getElementById('hs-plants').textContent = GS.totalPlants;
  document.getElementById('streak-count').textContent = GS.streak;
  document.getElementById('streak-msg').textContent = GS.streak > 0 ? 'Incrível! Continue assim 🔥' : 'Faça uma sessão hoje para começar';
  document.getElementById('shop-coins-amt').textContent = GS.coins;
  document.getElementById('si-sessions').textContent = GS.todaySessions;
  document.getElementById('si-xp').textContent = GS.xp;
  document.getElementById('si-coins').textContent = GS.coins;
}

// ==================== HOME ====================
function renderHome() { updateHUD(); renderChallenges(); }

function renderChallenges() {
  const list = document.getElementById('challenges-list');
  list.innerHTML = '';
  DAILY_CHALLENGES.forEach(ch => {
    const prog = GS.challengeProgress[ch.id] || 0;
    const done = prog >= ch.target;
    const pct  = Math.min(100, (prog/ch.target)*100);
    list.innerHTML += `
      <div class="challenge-item">
        <div class="ch-icon">${ch.icon}</div>
        <div class="ch-info">
          <div class="ch-name">${ch.name}</div>
          <div class="ch-desc">${ch.desc}</div>
          <div class="ch-progress-bar"><div class="ch-progress-fill" style="width:${pct}%"></div></div>
        </div>
        <div>${done ? '<span class="ch-done">✅</span>' : `<span class="ch-reward">+${ch.xpReward} XP</span>`}</div>
      </div>`;
  });
}

// ==================== TIMER ====================
function setDuration(mins) {
  if (GS.timerRunning) return;
  GS.timerDuration = mins;
  GS.timerSecondsLeft = mins * 60;
  GS.timerTotalSeconds = mins * 60;
  document.querySelectorAll('.dur-btn').forEach(b => b.classList.toggle('active', parseInt(b.textContent)===mins));
  updateTimerDisplay();
  saveState();
}
window.setDuration = setDuration;

function setMode(mode) {
  if (GS.timerRunning) return;
  GS.timerMode = mode;
  document.querySelectorAll('.session-tab').forEach((t,i) => t.classList.toggle('active', (mode==='solo'?0:1)===i));
  document.getElementById('arena-badge-wrap').style.display = mode==='arena' ? '' : 'none';
  saveState();
}
window.setMode = setMode;

function toggleTimer() { GS.timerRunning ? pauseTimer() : startTimer(); }
window.toggleTimer = toggleTimer;

function startTimer() {
  GS.timerRunning = true;
  GS.sessionStartTime = Date.now();
  document.getElementById('btn-start').textContent = '⏸ Pausar';
  document.getElementById('btn-stop').style.display = '';
  updateTimerDisplay();

  timerInterval = setInterval(() => {
    GS.timerSecondsLeft--;
    if (GS.timerSecondsLeft <= 0) { sessionComplete(); return; }
    updateTimerDisplay();
    growPlants(1);
    if (GS.timerSecondsLeft % 30 === 0) saveState();
  }, 1000);

  showToast('🍅 Sessão iniciada! Foco total.', 'success');
  document.getElementById('active-session-banner').style.display = '';
}

function pauseTimer() {
  GS.timerRunning = false;
  clearInterval(timerInterval);
  document.getElementById('btn-start').textContent = '▶ Retomar';
  updateTimerDisplay();
}

function stopTimer() {
  if (!confirm('Encerrar sessão?')) return;
  GS.timerRunning = false;
  GS.timerPhase = 'focus';
  GS.timerSecondsLeft = GS.timerDuration * 60;
  clearInterval(timerInterval);
  document.getElementById('btn-start').textContent = '▶ Iniciar';
  document.getElementById('btn-stop').style.display = 'none';
  document.getElementById('timer-phase').textContent = 'Pronto para começar';
  document.getElementById('active-session-banner').style.display = 'none';
  updateTimerDisplay();
  saveState();
}
window.stopTimer = stopTimer;

function sessionComplete() {
  clearInterval(timerInterval);
  GS.timerRunning = false;

  const sessionMins = GS.timerDuration;
  const arenaBonus  = GS.timerMode === 'arena' ? 1.25 : 1;
  const xpGain   = Math.floor(sessionMins * 2 * arenaBonus);
  const coinGain = Math.floor(sessionMins * 1.5 * arenaBonus);

  GS.xp += xpGain; GS.coins += coinGain;
  GS.totalSessions++; GS.todaySessions++;
  GS.totalFocusMins += sessionMins;
  GS.currentSessionMins += sessionMins;
  GS.rankScore += xpGain; GS.rankWeekly += xpGain;

  updateChallengeProgress('ch_sessions', 1);
  if (sessionMins >= 45) updateChallengeProgress('ch_long', 45);

  GS.sessionsThisPomodoro++;
  if (GS.sessionsThisPomodoro % 4 === 0) {
    GS.timerPhase = 'long_break';
    GS.timerSecondsLeft = 15 * 60;
    GS.timerTotalSeconds = 15 * 60;
  } else {
    GS.timerPhase = 'short_break';
    GS.timerSecondsLeft = 5 * 60;
    GS.timerTotalSeconds = 5 * 60;
  }

  checkLevelUp(); updateHUD(); saveState();
  showToast(`🎉 Sessão completa! +${xpGain} XP, +${coinGain} moedas`, 'success');
  tryNotify(`✅ Sessão de ${sessionMins}min concluída! +${xpGain} XP`);

  document.getElementById('btn-start').textContent = '▶ Intervalo';
  document.getElementById('timer-phase').textContent = GS.timerPhase === 'long_break' ? '😴 Pausa longa (15min)' : '☕ Pausa curta (5min)';
  document.getElementById('timer-mode-label').textContent = GS.timerPhase === 'long_break' ? 'PAUSA LONGA' : 'PAUSA CURTA';
  document.getElementById('active-session-banner').style.display = 'none';
  updateTimerDisplay();
}

function updateTimerDisplay() {
  const m = Math.floor(GS.timerSecondsLeft / 60);
  const s = GS.timerSecondsLeft % 60;
  document.getElementById('timer-display').textContent = `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;

  const total  = GS.timerTotalSeconds || GS.timerDuration * 60;
  const offset = 553 * (GS.timerSecondsLeft / total);
  document.getElementById('timer-circle').style.strokeDashoffset = offset;

  const label = { focus:'FOCO', short_break:'PAUSA CURTA', long_break:'PAUSA LONGA' };
  document.getElementById('timer-mode-label').textContent = label[GS.timerPhase] || 'FOCO';
}

// ==================== FARM ====================
function growPlants(seconds) {
  if (!GS.timerRunning || GS.timerPhase !== 'focus') return;
  GS.farmPlots.forEach((plot, i) => {
    if (!plot || plot.ready) return;
    const mult = (GS.fertilizedSlot === i) ? 2 : 1;
    const greenhouse = GS.hasGreenhouse ? 1.5 : 1;
    plot.progress += (seconds / 60) * mult * greenhouse;
    if (plot.progress >= plot.totalNeeded) {
      plot.progress = plot.totalNeeded;
      plot.ready = true;
      showToast(`🌾 ${plot.name} pronta para colher!`, 'success');
    }
  });
}

function renderFarm() {
  const grid = document.getElementById('farm-grid');
  grid.innerHTML = '';
  while (GS.farmPlots.length < GS.farmSlots) GS.farmPlots.push(null);

  for (let i = 0; i < GS.farmSlots; i++) {
    const plot = GS.farmPlots[i];
    let html = `<div class="farm-slot" onclick="farmSlotClick(${i})">`;
    if (!plot) {
      html += `<div style="font-size:2rem">➕</div><div class="slot-name">Vazio</div>`;
    } else {
      const plant = PLANTS.find(p => p.id === plot.plantId);
      const pct   = Math.min(100, (plot.progress / plot.totalNeeded) * 100);
      const stage = PLANT_STAGES[Math.min(3, Math.floor(pct/25))];
      html += `
        <div class="slot-quality ${RARITY_COLOR[plant.rarity]}">${RARITY_LABEL[plant.rarity]}</div>
        ${plot.ready ? '<div class="slot-ready-badge">PRONTA</div>' : ''}
        <div class="slot-plant">${plot.ready ? plant.emoji : stage}</div>
        <div class="slot-name">${plant.name}</div>
        <div class="slot-progress-bar"><div class="slot-progress-fill" style="width:${pct}%"></div></div>`;
    }
    html += `</div>`;
    grid.innerHTML += html;
  }
  for (let i = GS.farmSlots; i < 6; i++) {
    grid.innerHTML += `<div class="farm-slot locked"><div style="font-size:1.5rem">🔒</div><div class="slot-name">Bloqueado</div></div>`;
  }

  const guide = document.getElementById('plant-guide');
  guide.innerHTML = '';
  PLANTS.forEach(p => {
    const unlocked = GS.level >= p.unlockLevel;
    guide.innerHTML += `
      <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:10px;padding:0.6rem;opacity:${unlocked?1:0.4}">
        <div style="display:flex;align-items:center;gap:0.4rem;margin-bottom:0.2rem">
          <span style="font-size:1.3rem">${p.emoji}</span>
          <span style="font-weight:800;font-size:0.8rem">${p.name}</span>
          <span class="slot-quality ${RARITY_COLOR[p.rarity]}" style="position:static;margin-left:auto">${RARITY_LABEL[p.rarity]}</span>
        </div>
        <div style="font-size:0.68rem;color:var(--text-muted)">${p.desc}</div>
        <div style="font-size:0.7rem;color:var(--accent3);margin-top:0.2rem">⏱ ${p.sessionMins}min • 🪙 ${p.coinYield} moedas • Nv.${p.unlockLevel}</div>
      </div>`;
  });
}

function farmSlotClick(i) {
  const plot = GS.farmPlots[i];
  if (!plot) { currentPickSlot = i; openSeedPicker(); }
  else if (plot.ready) { harvestPlant(i); }
  else { showToast(`${PLANTS.find(p=>p.id===plot.plantId).emoji} Crescendo... ${Math.floor((plot.progress/plot.totalNeeded)*100)}%`, 'warning'); }
}
window.farmSlotClick = farmSlotClick;

function openSeedPicker() {
  const grid = document.getElementById('seed-grid-content');
  grid.innerHTML = '';
  PLANTS.forEach(plant => {
    const count    = GS.inventory[plant.id] || 0;
    const unlocked = GS.level >= plant.unlockLevel;
    const available = count > 0 && unlocked;
    grid.innerHTML += `
      <div class="seed-item ${available?'':'unavailable'}" onclick="${available?`plantSeed('${plant.id}')`:''}" >
        <span class="seed-emoji">${plant.emoji}</span>
        <div class="seed-info">
          <div class="sn">${plant.name} ${count>0?`(${count})`:'(0)'}</div>
          <div class="sd">${plant.sessionMins}min de foco</div>
          <div class="sc">🪙 ${plant.coinYield} moedas</div>
          <span class="seed-item sq ${RARITY_COLOR[plant.rarity]}">${RARITY_LABEL[plant.rarity]}</span>
          ${!unlocked ? `<div style="font-size:0.65rem;color:var(--accent4)">🔒 Nível ${plant.unlockLevel} necessário</div>` : ''}
          ${count===0 && unlocked ? '<div style="font-size:0.65rem;color:var(--text-muted)">Compre na loja</div>' : ''}
        </div>
      </div>`;
  });
  document.getElementById('seed-picker').classList.add('open');
}
window.showInventory = openSeedPicker;

function closeSeedPicker() { document.getElementById('seed-picker').classList.remove('open'); }
window.closeSeedPicker = closeSeedPicker;

function plantSeed(plantId) {
  if (currentPickSlot < 0) return;
  const plant = PLANTS.find(p => p.id === plantId);
  if (!plant || (GS.inventory[plantId]||0) <= 0) { showToast('Sem sementes!', 'error'); return; }
  GS.inventory[plantId]--;
  GS.farmPlots[currentPickSlot] = { plantId, name: plant.name, progress: 0, totalNeeded: plant.sessionMins, quality: 100, ready: false };
  GS.totalPlants++;
  closeSeedPicker();
  renderFarm();
  saveState();
  showToast(`🌱 ${plant.name} plantada! Inicie uma sessão para crescer.`, 'success');
}
window.plantSeed = plantSeed;

function harvestPlant(i) {
  const plot = GS.farmPlots[i];
  if (!plot || !plot.ready) return;
  const plant  = PLANTS.find(p => p.id === plot.plantId);
  const earned = Math.floor(plant.coinYield * (plot.quality/100) * GS.soilMultiplier * (GS.hasGreenhouse ? 1.5 : 1));
  GS.coins += earned;
  GS.farmPlots[i] = null;
  updateChallengeProgress('ch_harvest', 1);
  renderFarm(); updateHUD(); saveState();
  showToast(`🌾 Colheu ${plant.name}! +${earned} 🪙`, 'success');
}

// ==================== SHOP ====================
function renderShop() {
  renderShopSection('shop-seeds', 'seeds');
  renderShopSection('shop-expansions', 'expansions');
  renderShopSection('shop-upgrades', 'upgrades');
  renderShopSection('shop-cosmetics', 'cosmetics');
  document.getElementById('shop-coins-amt').textContent = GS.coins;
}

function renderShopSection(elemId, type) {
  const el = document.getElementById(elemId);
  if (!el) return;
  el.innerHTML = '';
  if (type === 'seeds') {
    PLANTS.forEach(plant => {
      if (plant.seedCost === 0 && (GS.inventory[plant.id]||0) > 0) return;
      const count  = GS.inventory[plant.id] || 0;
      const canBuy = GS.coins >= plant.seedCost && GS.level >= plant.unlockLevel;
      el.innerHTML += `
        <div class="shop-item">
          <div class="si-icon">${plant.emoji}</div>
          <div class="si-name">${plant.name} <span class="slot-quality ${RARITY_COLOR[plant.rarity]}">${RARITY_LABEL[plant.rarity]}</span></div>
          <div class="si-desc">${plant.desc} • Você tem: ${count}</div>
          <div class="si-footer">
            <div class="si-price">🪙 ${plant.seedCost > 0 ? plant.seedCost : 'Grátis'}</div>
            ${GS.level < plant.unlockLevel
              ? `<span style="font-size:0.7rem;color:var(--accent4)">🔒 Nv.${plant.unlockLevel}</span>`
              : `<button class="btn btn-sm btn-yellow" onclick="buyItem('seed','${plant.id}')" ${canBuy?'':'disabled'}>Comprar</button>`}
          </div>
        </div>`;
    });
    return;
  }
  (SHOP_ITEMS[type] || []).forEach(item => {
    const bought = GS.purchased[item.id];
    const canBuy = GS.coins >= item.price && !bought;
    const qty    = item.consumable ? (GS.purchased[item.id+'_qty'] || 0) : null;
    el.innerHTML += `
      <div class="shop-item ${bought && !item.consumable ? 'purchased' : ''}">
        <div class="si-icon">${item.icon}</div>
        <div class="si-name">${item.name}</div>
        <div class="si-desc">${item.desc}${qty!==null ? ` • Você tem: ${qty}` : ''}</div>
        <div class="si-footer">
          <div class="si-price">🪙 ${item.price}</div>
          ${bought && !item.consumable
            ? '<span class="si-status">✅ Comprado</span>'
            : `<button class="btn btn-sm btn-yellow" onclick="buyItem('${type}','${item.id}')" ${canBuy?'':'disabled'}>Comprar</button>`}
        </div>
      </div>`;
  });
}

function buyItem(type, id) {
  if (type === 'seed') {
    const plant = PLANTS.find(p => p.id === id);
    if (!plant) return;
    if (plant.seedCost === 0) {
      GS.inventory[id] = (GS.inventory[id]||0) + 3;
      showToast(`🌱 +3 sementes de ${plant.name}!`, 'success');
    } else {
      if (GS.coins < plant.seedCost) { showToast('Moedas insuficientes!', 'error'); return; }
      GS.coins -= plant.seedCost;
      GS.inventory[id] = (GS.inventory[id]||0) + 1;
      showToast(`🌱 Comprou semente de ${plant.name}!`, 'success');
    }
  } else {
    const item = (SHOP_ITEMS[type]||[]).find(i => i.id === id);
    if (!item) return;
    if (GS.coins < item.price) { showToast('Moedas insuficientes!', 'error'); return; }
    GS.coins -= item.price;
    if (item.consumable) { GS.purchased[id+'_qty'] = (GS.purchased[id+'_qty']||0) + item.val; }
    else { GS.purchased[id] = true; }
    if (item.effect === 'slots')      GS.farmSlots = Math.max(GS.farmSlots, item.val);
    if (item.effect === 'greenhouse') GS.hasGreenhouse = true;
    if (item.effect === 'soil')       GS.soilMultiplier = Math.max(GS.soilMultiplier, item.val);
    showToast(`✨ ${item.name} comprado!`, 'success');
  }
  updateHUD(); renderShop(); renderFarm(); saveState();
}
window.buyItem = buyItem;

// ==================== RANKING ====================
let currentRankTab = 'daily';
function switchRankTab(tab) {
  currentRankTab = tab;
  document.querySelectorAll('.rank-tab').forEach((t,i) => t.classList.toggle('active', ['daily','weekly','all'][i]===tab));
  renderRanking();
}
window.switchRankTab = switchRankTab;

async function renderRanking() {
  const list = document.getElementById('rank-list');
  list.innerHTML = '<div style="text-align:center;padding:2rem;color:var(--text-muted)">Carregando...</div>';
  let players = [];
  if (useFirebase) {
    try {
      const field = currentRankTab === 'weekly' ? 'rankWeekly' : 'rankScore';
      const q     = query(collection(db, 'users'), orderBy(field, 'desc'), limit(20));
      players = (await getDocs(q)).docs.map(d => ({ ...d.data(), uid: d.id }));
    } catch { players = generateFakePlayers(); }
  } else {
    players = generateFakePlayers();
  }

  if (!players.find(p => p.uid === GS.uid)) {
    players.push({ uid: GS.uid, name: GS.name, level: GS.level, xp: GS.xp, rankScore: GS.rankScore, avatar: GS.avatar });
    players.sort((a,b) => b.rankScore - a.rankScore);
  }

  list.innerHTML = '';
  players.slice(0,15).forEach((p,i) => {
    const pos      = i+1;
    const isMe     = p.uid === GS.uid;
    const posClass = pos===1?'gold':pos===2?'silver':pos===3?'bronze':'';
    const score    = currentRankTab === 'weekly' ? (p.rankWeekly||p.rankScore) : (p.rankScore||0);
    list.innerHTML += `
      <div class="rank-item ${isMe?'me':''}">
        <div class="rank-pos ${posClass}">${pos<=3?['🥇','🥈','🥉'][pos-1]:pos}</div>
        <div class="rank-avatar" style="background:linear-gradient(135deg,var(--accent),var(--accent2))">${p.avatar||'😊'}</div>
        <div class="rank-info">
          <div class="ri-name">${p.name}${isMe?' (você)':''}</div>
          <div class="ri-level">Nível ${p.level||1}</div>
        </div>
        <div class="rank-score">
          <div class="rs-val">${(score||0).toLocaleString()}</div>
          <div class="rs-lbl">XP</div>
        </div>
      </div>`;
  });
}

function generateFakePlayers() {
  const names   = ['Lucas Silva','Ana Vitória','Pedro Henrique','Mariana Costa','Gabriel Santos','Julia Ferreira','Rafael Lima','Beatriz Oliveira','Mateus Souza','Larissa Alves'];
  const avatars = ['😎','🧠','💪','🎯','⚡','🌟','🔥','💎','🦊','🐺'];
  return names.map((name,i) => ({
    uid:'fake_'+i, name, avatar:avatars[i],
    level: Math.floor(Math.random()*8)+2,
    rankScore: Math.floor(Math.random()*5000)+500,
    rankWeekly: Math.floor(Math.random()*1000)+100
  })).sort((a,b) => b.rankScore - a.rankScore);
}

// ==================== XP & LEVELING ====================
function checkLevelUp() {
  const newLevel = LEVELS.findLast(l => GS.xp >= l.xpNeeded)?.level || 1;
  if (newLevel > GS.level) {
    GS.level = newLevel;
    const lvl = LEVELS[newLevel-1];
    document.getElementById('lu-emoji').textContent = lvl.emoji;
    document.getElementById('lu-level').textContent = `${newLevel} — ${lvl.name}`;
    document.getElementById('lu-reward').textContent = '+50 moedas de bônus!';
    GS.coins += 50;
    document.getElementById('levelup-modal').classList.add('open');
  }
}

function closeLevelUpModal() {
  document.getElementById('levelup-modal').classList.remove('open');
  updateHUD();
}
window.closeLevelUpModal = closeLevelUpModal;

// ==================== CHALLENGES ====================
function initDailyChallenges() {
  const today = new Date().toDateString();
  if (GS.lastChallengeDate !== today) {
    GS.lastChallengeDate = today;
    GS.challengeProgress = {};
  }
}

function updateChallengeProgress(id, amount) {
  if (!GS.challengeProgress) GS.challengeProgress = {};
  const prev = GS.challengeProgress[id] || 0;
  const ch   = DAILY_CHALLENGES.find(c => c.id === id);
  if (!ch || prev >= ch.target) return;
  GS.challengeProgress[id] = prev + amount;
  if (GS.challengeProgress[id] >= ch.target && prev < ch.target) {
    GS.xp += ch.xpReward; GS.coins += ch.coinReward;
    showToast(`🎯 Desafio "${ch.name}" completo! +${ch.xpReward} XP`, 'success');
    checkLevelUp();
  }
  renderChallenges();
}

// ==================== STREAK ====================
function checkStreak() {
  const yesterday = new Date(Date.now()-86400000).toDateString();
  if (GS.lastSessionDate && GS.lastSessionDate !== new Date().toDateString() && GS.lastSessionDate !== yesterday) {
    GS.streak = 0;
  }
}

function markSessionToday() {
  const today = new Date().toDateString();
  if (GS.lastSessionDate !== today) {
    GS.lastSessionDate = today;
    GS.streak++;
  }
}

// ==================== VISIBILITY API (Penalty) ====================
function setupVisibilityAPI() {
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (GS.timerRunning && GS.timerPhase === 'focus') GS.awayStartTime = Date.now();
    } else {
      if (GS.awayStartTime) {
        const awaySecs = Math.floor((Date.now() - GS.awayStartTime) / 1000);
        GS.awayStartTime = null;
        if (awaySecs > 5) applyPenalties(awaySecs);
      }
    }
  });
}

function applyPenalties(awaySecs) {
  const awayMins = awaySecs / 60;
  const penalties = [];

  GS.farmPlots.forEach((plot, i) => {
    if (!plot || plot.ready) return;
    const plant = PLANTS.find(p => p.id === plot.plantId);
    const rule  = PENALTY_RULES[plant.rarity];
    if (rule === 'freeze') {
      penalties.push({ name: plant.name, emoji: plant.emoji, effect: 'Congelada' });
    } else if (rule === 'degrade') {
      const loss = Math.min(50, awayMins * 10);
      plot.quality = Math.max(0, plot.quality - loss);
      penalties.push({ name: plant.name, emoji: plant.emoji, effect: `Qualidade: -${Math.floor(loss)}%` });
    } else if (rule === 'regress') {
      const reg = awayMins * 0.5;
      plot.progress = Math.max(0, plot.progress - reg);
      penalties.push({ name: plant.name, emoji: plant.emoji, effect: `Progresso voltou ${Math.floor(reg*10)/10}min` });
    } else if (rule === 'die') {
      GS.farmPlots[i] = null;
      penalties.push({ name: plant.name, emoji: '💀', effect: 'MORREU! Semente perdida' });
    }
  });

  clearInterval(timerInterval);
  GS.timerRunning = false;
  document.getElementById('btn-start').textContent = '▶ Retomar';
  document.getElementById('active-session-banner').style.display = 'none';

  if (penalties.length > 0) {
    document.getElementById('penalty-modal-time').textContent = `Você ficou ${awaySecs}s fora do app durante uma sessão ativa.`;
    document.getElementById('penalty-list').innerHTML = penalties.map(p =>
      `<div class="penalty-item"><span class="penalty-icon">${p.emoji}</span><div><div style="font-weight:700">${p.name}</div><div class="penalty-effect">${p.effect}</div></div></div>`
    ).join('');
    document.getElementById('penalty-modal').classList.add('open');
  }

  renderFarm(); saveState();
}

function closePenaltyModal() { document.getElementById('penalty-modal').classList.remove('open'); }
window.closePenaltyModal = closePenaltyModal;

// ==================== NOTIFICATIONS ====================
function tryNotify(msg) {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'granted') {
    new Notification('FocusPlay Arena 🌱', { body: msg });
  } else if (Notification.permission !== 'denied') {
    Notification.requestPermission().then(p => { if (p === 'granted') new Notification('FocusPlay Arena 🌱', { body: msg }); });
  }
}

// ==================== TOAST ====================
function showToast(msg, type='success') {
  const tc = document.getElementById('toast-container');
  const t  = document.createElement('div');
  t.className = `toast ${type}`;
  t.textContent = msg;
  tc.appendChild(t);
  setTimeout(() => { t.style.opacity='0'; t.style.transform='translateX(100%)'; t.style.transition='all 0.3s'; setTimeout(()=>t.remove(), 300); }, 3000);
}
// Expõe globalmente para uso no spotify.js
window.showToast = showToast;

// ==================== INIT ====================
window.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    if (useFirebase) {
      onAuthStateChanged(auth, async user => {
        if (user) {
          GS.uid = user.uid;
          GS.name = user.displayName || user.email.split('@')[0];
          GS.email = user.email;
          loadState();
          await loadFirebaseState(GS.uid);
          enterGame();
        } else {
          document.getElementById('loading-screen').style.display = 'none';
        }
      });
    } else {
      document.getElementById('loading-screen').style.display = 'none';
    }
    updateTimerDisplay();
  }, 1200);
});
