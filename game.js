(() => {
  function showFatalOverlay(title, detail){
    if(!document || !document.body) return;
    let pre = document.getElementById('fatalOverlay');
    if(!pre){
      pre = document.createElement('pre');
      pre.id = 'fatalOverlay';
      pre.style.position = 'fixed';
      pre.style.inset = '0';
      pre.style.zIndex = '9999';
      pre.style.margin = '0';
      pre.style.padding = '24px';
      pre.style.whiteSpace = 'pre-wrap';
      pre.style.overflow = 'auto';
      pre.style.background = '#120a0a';
      pre.style.color = '#ffd7d7';
      pre.style.font = '14px/1.45 Consolas, monospace';
      document.body.appendChild(pre);
    }
    pre.textContent = title + '\n\n' + detail;
  }

  window.addEventListener('error', (event) => {
    const source = [event.filename || '', event.lineno || 0, event.colno || 0].filter(Boolean).join(':');
    const stack = event.error && event.error.stack ? '\n\n' + event.error.stack : '';
    showFatalOverlay('Beacon Runner fatal error', String(event.message || 'Unknown error') + (source ? '\n' + source : '') + stack);
  });

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event && event.reason;
    const text = reason && reason.stack ? reason.stack : String(reason || 'Unknown rejection');
    showFatalOverlay('Beacon Runner unhandled rejection', text);
  });

  const canvas = document.getElementById('runCanvas');
  const ctx = canvas.getContext('2d');
  const domApi = window.BeaconRunDom || {
    el(tagName, options = {}) {
      const node = document.createElement(tagName);
      if(options.className) node.className = options.className;
      if(options.text !== undefined) node.textContent = String(options.text);
      if(options.children && options.children.length) node.append(...options.children);
      return node;
    },
    replace(node, children = []) {
      node.replaceChildren(...children);
    }
  };
  const scoresApi = window.BeaconRunScores || null;

  const startBtn = document.getElementById('startBtn');
  const pauseBtn = document.getElementById('pauseBtn');
  const tutorialBtn = document.getElementById('tutorialBtn');
  const soundBtn = document.getElementById('soundBtn');
  const touchBtn = document.getElementById('touchBtn');
  const difficultyBtn = document.getElementById('difficultyBtn');
  const scoreModal = document.getElementById('scoreModal');
  const scoreModalScore = document.getElementById('scoreModalScore');
  const scoreModalStatus = document.getElementById('scoreModalStatus');
  const scoreModalSubtitle = document.getElementById('scoreModalSubtitle');
  const scoreEntrySection = document.getElementById('scoreEntrySection');
  const scoreEntryHint = document.getElementById('scoreEntryHint');
  const scoreNameInput = document.getElementById('scoreNameInput');
  const scoreList = document.getElementById('scoreList');
  const scoreListNote = document.getElementById('scoreListNote');
  const saveScoreBtn = document.getElementById('saveScoreBtn');
  const retryBtn = document.getElementById('retryBtn');

  const VIEW_W = 1280;
  const VIEW_H = 760;
  const DISPLAY_FONT_STACK = '"Bahnschrift","Arial Narrow","Trebuchet MS","Segoe UI",Arial,sans-serif';
  const BODY_FONT_STACK = '"Bahnschrift","Trebuchet MS","Segoe UI",Arial,sans-serif';
  const HORIZON_Y = 0.19;
  const CAMERA_HEIGHT = 0.92;
  const CAMERA_DEPTH = 1.15;
  const ROAD_HALF_WIDTH = 1.15;
  const VISUAL_CURVE_SCALE = 0.58;
  const VISUAL_HILL_SCALE = 0;
  const SEGMENT_LENGTH = 28;
  const DRAW_DISTANCE = 148;
  const PLAYER_PLANE_Z = SEGMENT_LENGTH * 0.9;
  const LANE_FRACTIONS = [-0.3, 0, 0.3];
  const LANE_MATCH_THRESHOLD = 0.34;
  const PLAYER_ANCHOR_SMOOTH = 12;
  const LANE_SETTLE_SPEED = 15.5;
  const PLAIN_NEAR_SLICE_COUNT = 14;
  const LOW_DETAIL_NEAR_SLICE_COUNT = 26;
  const PICKUP_LANE_THRESHOLD = 0.34;
  const OBSTACLE_LANE_THRESHOLD = 0.23;
  const PIT_LANE_THRESHOLD = 0.21;
  const BASE_SPEED = 118;
  const MAX_SPEED = 184;
  const BOOST_EXTRA_SPEED = 92;
  const SUPER_BASE_SPEED = 152;
  const SUPER_MAX_SPEED = 234;
  const SUPER_BOOST_EXTRA_SPEED = 112;
  const STARTING_LIVES = 3;
  const COINS_PER_EXTRA_LIFE = 100;
  const JUMP_VELOCITY = 7.4;
  const GRAVITY = 18.6;
  const JUMP_BUFFER_TIME = 0.14;
  const GROUND_GRACE_TIME = 0.08;
  const SHIELD_DURATION = 6;
  const MAGNET_DURATION = 6;
  const BOOST_DURATION = 5.4;
  const HIT_FLASH_DURATION = 0.72;
  const RECOVERY_DURATION = 1.05;
  const GAMEOVER_HOLD_DURATION = 3;
  const GAMEOVER_FADE_DURATION = 0.78;
  const ONE_UP_DURATION = 1.75;
  const ATTRACT_RESET_DELAY = 0.5;
  const ATTRACT_THINK_INTERVAL = 0.06;
  const STORAGE_KEYS = {
    best: 'beacon_runner_best',
    mute: 'beacon_runner_mute',
    superDifficulty: 'beacon_runner_super_difficulty',
    touchButtons: 'beacon_runner_touch_buttons',
    tutorialDone: 'beacon_runner_tutorial_done'
  };

  const DAY_STATES = [
    { name: 'Day', top: '#6d472d', mid: '#9c6a45', low: '#4b3626', bottom: '#1b140f', glow: 'rgba(240,191,120,0.18)' },
    { name: 'Dusk', top: '#5f3027', mid: '#8f573c', low: '#4a2a28', bottom: '#17100d', glow: 'rgba(242,152,94,0.16)' },
    { name: 'Night', top: '#171c2a', mid: '#24293b', low: '#151723', bottom: '#08090d', glow: 'rgba(126,156,230,0.1)' },
    { name: 'Dawn', top: '#4b372a', mid: '#7d604d', low: '#564233', bottom: '#18120f', glow: 'rgba(246,202,133,0.14)' }
  ];

  const WEATHER_STATES = [
    { name: 'Clear', haze: 0.12, dust: 0.08, overlay: 'rgba(0,0,0,0)' },
    { name: 'Dust', haze: 0.24, dust: 0.22, overlay: 'rgba(182,118,72,0.12)' },
    { name: 'Storm', haze: 0.34, dust: 0.3, overlay: 'rgba(96,66,44,0.2)' },
    { name: 'Clear', haze: 0.12, dust: 0.08, overlay: 'rgba(0,0,0,0)' }
  ];

  const ITEM_DRAW = {
    coin: { roadFrac: 0.12, heightRatio: 1, lift: 0.18, glow: 'rgba(225,164,90,0.28)' },
    beacon: { roadFrac: 0.14, heightRatio: 1.15, lift: 0.18, glow: 'rgba(157,219,183,0.24)' },
    shield: { roadFrac: 0.14, heightRatio: 1, lift: 0.18, glow: 'rgba(157,219,183,0.26)' },
    magnet: { roadFrac: 0.14, heightRatio: 1, lift: 0.18, glow: 'rgba(225,164,90,0.24)' },
    boost: { roadFrac: 0.14, heightRatio: 1, lift: 0.18, glow: 'rgba(201,154,255,0.22)' },
    obstacle: { roadFrac: 0.28, heightRatio: 1.06, lift: 0.02 },
    pit: { roadFrac: 0.29, heightRatio: 0.44, lift: 0.02 }
  };

  const images = loadImages({
    logo: 'assets/beaconrun.png',
    sheet: 'assets/character_sheet.png',
    coin: 'assets/coin.png',
    life: 'assets/life.png',
    beacon: 'assets/beacon.png',
    shield: 'assets/shield.png',
    magnet: 'assets/magnet.png',
    boost: 'assets/boost.png',
    drone: 'assets/drone.png',
    gameover: 'assets/gameover.png',
    wall1: 'assets/obstacles_wall_1.png',
    wall2: 'assets/obstacles_wall_2.png',
    pit1: 'assets/obstacle_high_1.png',
    pit2: 'assets/obstacle_high_2.png',
    pit3: 'assets/obstacle_high_3.png'
  });

  const state = {
    mode: 'menu',
    score: 0,
    best: Number(localStorage.getItem(STORAGE_KEYS.best) || '0'),
    difficulty: 'normal',
    lives: STARTING_LIVES,
    maxLives: STARTING_LIVES,
    speed: BASE_SPEED,
    speedTarget: BASE_SPEED,
    position: 0,
    previousPosition: 0,
    distance: 0,
    lane: 1,
    laneVisual: 1,
    jumpHeight: 0,
    jumpVelocity: 0,
    jumpBuffer: 0,
    groundGrace: 0,
    grounded: true,
    runnerAnim: 0,
    landImpact: 0,
    recovery: 0,
    shield: 0,
    magnet: 0,
    boost: 0,
    hitFlash: 0,
    shake: 0,
    gameOverHold: 0,
    attractResetTimer: 0,
    attractThinkTimer: 0,
    warning: '',
    warningTimer: 0,
    toast: { text: '', timer: 0 },
    oneUpTimer: 0,
    currentTag: 'Dust Run',
    action: 'Idle',
    dayClock: 0,
    weatherClock: 0,
    skyShift: 0,
    segments: [],
    items: [],
    segmentOffset: 0,
    nextSegmentZ: 0,
    nextSegmentY: 0,
    patternCount: 0,
    patternHistory: [],
    playerScreenX: VIEW_W * 0.5,
    playerScreenY: VIEW_H * 0.64,
    tutorial: {
      active: false,
      step: 0,
      lane: false,
      jump: false,
      power: false,
      announcedStep: -1
    },
    run: { coins: 0, beacons: 0, passed: 0, boosts: 0 },
    scorecard: { name: '', finalScore: 0 }
  };

  const settings = {
    muted: localStorage.getItem(STORAGE_KEYS.mute) === '1',
    superDifficulty: localStorage.getItem(STORAGE_KEYS.superDifficulty) === '1',
    touchButtons: localStorage.getItem(STORAGE_KEYS.touchButtons) === '1'
  };

  const scoreEntryState = { visible: false, qualifies: false, saved: false, savedEntry: null };
  let lastScoreModalSnapshot = '';
  let nextItemId = 1;
  let lastTime = performance.now();
  let audioCtx = null;
  let audioResumePromise = null;
  const renderFrame = {
    visible: [],
    byIndex: new Map(),
    sprites: []
  };

  const viewFrame = {
    left: 0,
    top: 0,
    right: VIEW_W,
    bottom: VIEW_H,
    width: VIEW_W,
    height: VIEW_H,
    scale: 1
  };

  const uiCache = {
    modeDataset: '',
    pauseLabel: '',
    startLabel: '',
    soundLabel: '',
    touchLabel: '',
    difficultyLabel: ''
  };

  const skyRenderCache = {
    gradientKey: '',
    gradient: null,
    bottomFade: null
  };

  const skyline = buildSkyline();
  state.tutorial.active = shouldRunTutorial();

  function loadImages(map){
    const result = {};
    Object.entries(map).forEach(([key, src]) => {
      const image = new Image();
      image.src = src;
      result[key] = image;
    });
    return result;
  }

  function buildSkyline(){
    const near = [];
    const far = [];
    const mid = [];
    for(let i = 0; i < 18; i++) near.push({ x: i * 122, width: 64 + (i % 5) * 20, height: 56 + (i % 4) * 30, type: i % 3 === 0 ? 'tower' : i % 4 === 0 ? 'dish' : 'ruin' });
    for(let i = 0; i < 12; i++) mid.push({ x: i * 176, width: 90 + (i % 4) * 22, height: 44 + (i % 3) * 20, type: i % 3 === 1 ? 'tower' : 'ruin' });
    for(let i = 0; i < 10; i++) far.push({ x: i * 214, width: 110 + (i % 4) * 24, height: 36 + (i % 3) * 16, type: i % 2 === 0 ? 'ruin' : 'tower' });
    return { near, mid, far };
  }

  function getViewportHeight(){
    return Math.max(1, Math.round(window.visualViewport ? window.visualViewport.height : window.innerHeight));
  }

  function syncViewportCss(){
    document.documentElement.style.setProperty('--app-height', getViewportHeight() + 'px');
  }

  function getPlayerTargetY(){
    return clamp(viewFrame.top + viewFrame.height * 0.64, viewFrame.top + 240, viewFrame.bottom - 110);
  }

  function getBottomDetailCutoffY(){
    return viewFrame.top + viewFrame.height * 0.8;
  }

  function isCompactViewport(){
    return viewFrame.width < 520;
  }

  function fitCanvas(){
    syncViewportCss();
    const stage = canvas.parentElement;
    const width = Math.max(1, stage.clientWidth);
    const height = Math.max(1, stage.clientHeight);
    const dpr = window.devicePixelRatio || 1;
    const scale = Math.max(width / VIEW_W, height / VIEW_H);
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    viewFrame.scale = scale;
    viewFrame.width = width / scale;
    viewFrame.height = height / scale;
    viewFrame.left = (VIEW_W - viewFrame.width) * 0.5;
    viewFrame.top = (VIEW_H - viewFrame.height) * 0.5;
    viewFrame.right = viewFrame.left + viewFrame.width;
    viewFrame.bottom = viewFrame.top + viewFrame.height;
    const offsetX = (width - VIEW_W * scale) * 0.5;
    const offsetY = (height - VIEW_H * scale) * 0.5;
    ctx.setTransform(scale * dpr, 0, 0, scale * dpr, offsetX * dpr, offsetY * dpr);
    state.playerScreenY = getPlayerTargetY();
    skyRenderCache.gradientKey = '';
    skyRenderCache.gradient = null;
    skyRenderCache.bottomFade = null;
  }

  function clamp(value, min, max){ return Math.max(min, Math.min(max, value)); }
  function lerp(a, b, t){ return a + (b - a) * t; }
  function easeIn(a, b, t){ return a + (b - a) * t * t; }
  function easeOut(a, b, t){ return a + (b - a) * (1 - Math.pow(1 - t, 2)); }
  function easeInOut(a, b, t){ return a + (b - a) * ((-Math.cos(t * Math.PI) / 2) + 0.5); }
  function randomIndex(size){ return (Math.random() * size) | 0; }
  function sample(list){ return list[randomIndex(list.length)]; }
  function maybe(probability){ return Math.random() < probability; }
  function shuffledLanes(){
    const lanes = [0, 1, 2];
    for(let i = lanes.length - 1; i > 0; i--){
      const j = randomIndex(i + 1);
      const temp = lanes[i];
      lanes[i] = lanes[j];
      lanes[j] = temp;
    }
    return lanes;
  }

  function randomJumpHazardVariant(){
    const roll = Math.random();
    if(roll < 0.34) return 'pit1';
    if(roll < 0.67) return 'pit2';
    return 'pit3';
  }

  function randomWallVariant(){
    return Math.random() < 0.5 ? 'wall1' : 'wall2';
  }

  function isAttractMode(){
    return state.mode === 'menu';
  }

  function imageReady(image){
    return !!(image && image.complete && image.naturalWidth > 0 && image.naturalHeight > 0);
  }

  function hexToRgb(hex){
    const clean = hex.replace('#', '');
    return {
      r: parseInt(clean.slice(0, 2), 16),
      g: parseInt(clean.slice(2, 4), 16),
      b: parseInt(clean.slice(4, 6), 16)
    };
  }

  function mixColor(a, b, t){
    const c1 = hexToRgb(a);
    const c2 = hexToRgb(b);
    const mix = (x, y) => Math.round(lerp(x, y, t));
    return 'rgb(' + mix(c1.r, c2.r) + ',' + mix(c1.g, c2.g) + ',' + mix(c1.b, c2.b) + ')';
  }

  function parseRgba(value){
    if(value.startsWith('#')){
      const rgb = hexToRgb(value);
      return { r: rgb.r, g: rgb.g, b: rgb.b, a: 1 };
    }
    const match = value.match(/rgba?\(([^)]+)\)/i);
    if(!match) return { r: 0, g: 0, b: 0, a: 1 };
    const parts = match[1].split(',').map((part) => Number(part.trim()));
    return { r: parts[0] || 0, g: parts[1] || 0, b: parts[2] || 0, a: parts.length > 3 ? parts[3] : 1 };
  }

  function mixRgba(a, b, t){
    const c1 = parseRgba(a);
    const c2 = parseRgba(b);
    const mix = (x, y) => Math.round(lerp(x, y, t));
    return 'rgba(' + mix(c1.r, c2.r) + ',' + mix(c1.g, c2.g) + ',' + mix(c1.b, c2.b) + ',' + lerp(c1.a, c2.a, t).toFixed(3) + ')';
  }

  function getCycleState(list, clock, duration){
    if(!Array.isArray(list) || list.length === 0){
      return { current: null, next: null, t: 0 };
    }
    const safeClock = Number.isFinite(clock) ? clock : 0;
    const safeDuration = Number.isFinite(duration) && duration > 0 ? duration : 1;
    const raw = safeClock / safeDuration;
    const wrapped = ((raw % list.length) + list.length) % list.length;
    const index = Math.floor(wrapped) % list.length;
    const current = list[index] || list[0];
    const next = list[(index + 1) % list.length] || current;
    return { current, next, t: wrapped - index };
  }

  function getCachedSkyGradient(dayState){
    const fallback = DAY_STATES[0] || {
      top: '#6d472d',
      mid: '#9c6a45',
      low: '#4b3626',
      bottom: '#1b140f',
      glow: 'rgba(240,191,120,0.18)'
    };
    const current = dayState && dayState.current ? dayState.current : fallback;
    const next = dayState && dayState.next ? dayState.next : current;
    const blend = Math.round(clamp(dayState && Number.isFinite(dayState.t) ? dayState.t : 0, 0, 1) * 64) / 64;
    const top = mixColor(current.top, next.top, blend);
    const mid = mixColor(current.mid, next.mid, blend);
    const low = mixColor(current.low, next.low, blend);
    const bottom = mixColor(current.bottom, next.bottom, blend);
    const key = [top, mid, low, bottom].join('|');
    if(skyRenderCache.gradientKey !== key){
      const gradient = ctx.createLinearGradient(0, 0, 0, VIEW_H);
      gradient.addColorStop(0, top);
      gradient.addColorStop(0.24, mid);
      gradient.addColorStop(0.58, low);
      gradient.addColorStop(1, bottom);
      skyRenderCache.gradientKey = key;
      skyRenderCache.gradient = gradient;
    }
    return skyRenderCache.gradient;
  }

  function getBottomFadeGradient(){
    if(!skyRenderCache.bottomFade){
      const fade = ctx.createLinearGradient(0, VIEW_H * 0.68, 0, VIEW_H);
      fade.addColorStop(0, 'rgba(18,13,10,0)');
      fade.addColorStop(1, 'rgba(18,13,10,0.76)');
      skyRenderCache.bottomFade = fade;
    }
    return skyRenderCache.bottomFade;
  }

  function sanitizeArcadeName(name){
    if(scoresApi && typeof scoresApi.sanitizeName === 'function') return scoresApi.sanitizeName(name);
    return String(name || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 6);
  }

  function formatArcadeName(name){
    if(scoresApi && typeof scoresApi.formatName === 'function') return scoresApi.formatName(name);
    return sanitizeArcadeName(name);
  }

  function loadScoreboard(){ return scoresApi ? scoresApi.load() : []; }
  function scoreQualifies(score){ return scoresApi ? scoresApi.qualifies(loadScoreboard(), score) : false; }
  function isSuperDifficulty(){ return state.difficulty === 'super'; }
  function shouldRunTutorial(){ return !settings.superDifficulty && localStorage.getItem(STORAGE_KEYS.tutorialDone) !== '1'; }
  function getBaseSpeed(){ return isSuperDifficulty() ? SUPER_BASE_SPEED : BASE_SPEED; }
  function getMaxSpeed(){ return isSuperDifficulty() ? SUPER_MAX_SPEED : MAX_SPEED; }
  function getBoostExtraSpeed(){ return isSuperDifficulty() ? SUPER_BOOST_EXTRA_SPEED : BOOST_EXTRA_SPEED; }

  function saveSettings(){
    localStorage.setItem(STORAGE_KEYS.mute, settings.muted ? '1' : '0');
    localStorage.setItem(STORAGE_KEYS.superDifficulty, settings.superDifficulty ? '1' : '0');
    localStorage.setItem(STORAGE_KEYS.touchButtons, settings.touchButtons ? '1' : '0');
  }

  function applyTouchButtons(){
    document.body.classList.toggle('show-touch', settings.touchButtons);
    document.body.classList.toggle('hide-touch', !settings.touchButtons);
  }

  function vibrate(pattern){
    if(navigator.vibrate) navigator.vibrate(pattern);
  }

  function ensureAudio(){
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if(!Ctor) return null;
    if(!audioCtx) audioCtx = new Ctor();
    return audioCtx;
  }

  function primeAudio(){
    const ac = ensureAudio();
    if(!ac) return Promise.resolve(null);
    if(ac.state === 'running') return Promise.resolve(ac);
    if(!audioResumePromise){
      audioResumePromise = ac.resume().catch(() => null).finally(() => {
        audioResumePromise = null;
      });
    }
    return audioResumePromise.then(() => ac);
  }

  function playTone(options){
    const ac = ensureAudio();
    if(!ac) return;

    const scheduleTone = () => {
      const now = ac.currentTime + (options.delay || 0);
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = options.type || 'sine';
      osc.frequency.setValueAtTime(options.from, now);
      if(options.to !== undefined){
        osc.frequency.exponentialRampToValueAtTime(Math.max(40, options.to), now + options.duration);
      }
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(options.volume || 0.08, now + Math.min(0.02, options.duration * 0.35));
      gain.gain.exponentialRampToValueAtTime(0.0001, now + options.duration);
      osc.connect(gain);
      gain.connect(ac.destination);
      osc.start(now);
      osc.stop(now + options.duration + 0.03);
    };

    if(ac.state !== 'running'){
      primeAudio().then((runningAudio) => {
        if(!runningAudio || runningAudio.state !== 'running') return;
        scheduleTone();
      }).catch(() => {});
      return;
    }

    scheduleTone();
  }

  function playSound(kind){
    if(settings.muted) return;
    switch(kind){
      case 'jump': playTone({ from: 300, to: 620, duration: 0.12, type: 'triangle', volume: 0.075 }); break;
      case 'slide': playTone({ from: 180, to: 120, duration: 0.1, type: 'square', volume: 0.055 }); break;
      case 'land': playTone({ from: 140, to: 82, duration: 0.09, type: 'sine', volume: 0.05 }); break;
      case 'coin': playTone({ from: 820, to: 1080, duration: 0.08, type: 'triangle', volume: 0.055 }); break;
      case 'beacon':
        playTone({ from: 340, to: 720, duration: 0.16, type: 'triangle', volume: 0.075 });
        playTone({ from: 720, to: 980, duration: 0.15, type: 'sine', volume: 0.05, delay: 0.04 });
        break;
      case 'shield': playTone({ from: 440, to: 820, duration: 0.18, type: 'sine', volume: 0.065 }); break;
      case 'magnet': playTone({ from: 240, to: 470, duration: 0.16, type: 'square', volume: 0.055 }); break;
      case 'boost': playTone({ from: 240, to: 820, duration: 0.18, type: 'sawtooth', volume: 0.06 }); break;
      case 'shield-hit': playTone({ from: 540, to: 210, duration: 0.18, type: 'triangle', volume: 0.075 }); break;
      case 'hit': playTone({ from: 170, to: 68, duration: 0.22, type: 'sawtooth', volume: 0.09 }); break;
      case 'gameover': playTone({ from: 150, to: 72, duration: 0.32, type: 'sawtooth', volume: 0.11 }); break;
      default: break;
    }
  }

  function buildScoreRow(className, rankText, nameText, scoreText){
    return domApi.el('li', {
      className,
      children: [
        domApi.el('span', { className: 'score-rank', text: rankText }),
        domApi.el('span', { className: 'score-name', text: nameText }),
        domApi.el('span', { className: 'score-value', text: scoreText })
      ]
    });
  }

  function renderScoreRows(scores, pendingName){
    if(!scoreList) return;
    const rows = scores.length ? scores : [{ rank: 1, name: '------', score: 0, pending: false }];
    const fragment = document.createDocumentFragment();
    rows.forEach((entry, index) => {
      const name = entry.score > 0 || entry.name ? formatArcadeName(entry.name || pendingName || '') : '------';
      const pendingClass = entry.pending ? ' is-pending' : '';
      const rank = entry.rank || (index + 1);
      fragment.appendChild(buildScoreRow('score-row' + pendingClass, '#' + String(rank).padStart(2, '0'), name, String(entry.score)));
    });
    domApi.replace(scoreList, [fragment]);
  }

  function getModalScoreRows(scores){
    if(!scores.length) return [];
    let focusIndex = scores.findIndex((entry) => entry.pending);
    if(focusIndex === -1 && scoreEntryState.savedEntry){
      focusIndex = scores.findIndex((entry) => entry.createdAt === scoreEntryState.savedEntry.createdAt);
    }
    if(focusIndex === -1) focusIndex = Math.max(0, scores.length - 1);
    const start = clamp(focusIndex - 1, 0, Math.max(0, scores.length - 3));
    return scores.slice(start, start + 3).map((entry, index) => ({
      rank: start + index + 1,
      name: entry.name,
      score: entry.score,
      pending: !!entry.pending,
      createdAt: entry.createdAt
    }));
  }

  function getScorePreview(){
    const scores = loadScoreboard();
    const finalScore = Math.floor(state.scorecard.finalScore || state.score);
    if(scoreEntryState.qualifies && !scoreEntryState.saved && scoresApi){
      const previewName = sanitizeArcadeName(state.scorecard.name);
      const candidate = { name: previewName, score: finalScore, createdAt: Date.now(), pending: true };
      return scoresApi.withCandidate(scores, candidate).map((entry) => ({
        name: entry.name,
        score: entry.score,
        pending: entry.createdAt === candidate.createdAt
      }));
    }
    return scores;
  }

  function getScoreModalSnapshot(){
    const preview = getScorePreview();
    return JSON.stringify({
      scores: getModalScoreRows(preview),
      qualifies: scoreEntryState.qualifies,
      saved: scoreEntryState.saved,
      finalScore: Math.floor(state.scorecard.finalScore || state.score),
      name: sanitizeArcadeName(state.scorecard.name)
    });
  }

  function updateScoreEntryUi(){
    const snapshot = getScoreModalSnapshot();
    if(snapshot === lastScoreModalSnapshot) return;
    lastScoreModalSnapshot = snapshot;

    const finalScore = Math.floor(state.scorecard.finalScore || state.score);
    const cleanName = sanitizeArcadeName(state.scorecard.name);
    const canSave = scoreEntryState.qualifies && !scoreEntryState.saved && cleanName.length > 0;

    if(scoreModalScore) scoreModalScore.textContent = String(finalScore);
    if(scoreEntrySection) scoreEntrySection.hidden = !scoreEntryState.qualifies || scoreEntryState.saved;
    if(scoreModal) scoreModal.classList.toggle('entry-active', !!scoreEntrySection && !scoreEntrySection.hidden);
    if(saveScoreBtn){
      saveScoreBtn.hidden = !scoreEntryState.qualifies && !scoreEntryState.saved;
      saveScoreBtn.disabled = !canSave;
      saveScoreBtn.textContent = scoreEntryState.saved ? 'Saved to Top 10' : 'Save Score';
    }
    if(scoreModalStatus){
      if(scoreEntryState.saved) scoreModalStatus.textContent = 'Saved to the leaderboard';
      else if(scoreEntryState.qualifies) scoreModalStatus.textContent = 'Leaderboard spot unlocked';
      else scoreModalStatus.textContent = 'Leaderboard unchanged';
    }
    if(scoreModalSubtitle){
      scoreModalSubtitle.textContent = scoreEntryState.qualifies
        ? 'You made the board. Add your name and lock the run in.'
        : 'This run missed the board, but the leaderboard is right here.';
    }
    if(scoreEntryHint){
      scoreEntryHint.textContent = scoreEntryState.saved
        ? 'Saved. You can jump back in or open the full scorecard.'
        : 'Use up to 6 letters. The list updates while you type.';
    }
    if(scoreListNote) scoreListNote.textContent = scoreEntryState.qualifies || scoreEntryState.saved ? 'Nearby scores' : 'Top 10 cutoff';
    renderScoreRows(getModalScoreRows(getScorePreview()), cleanName);
  }

  function hideScoreModal(){
    scoreEntryState.visible = false;
    lastScoreModalSnapshot = '';
    if(scoreModal) scoreModal.hidden = true;
    if(scoreModal) scoreModal.classList.remove('entry-active');
  }

  function openScoreModal(){
    scoreEntryState.visible = true;
    lastScoreModalSnapshot = '';
    if(scoreModal) scoreModal.hidden = false;
    if(scoreNameInput) scoreNameInput.value = state.scorecard.name;
    updateScoreEntryUi();
    if(scoreEntryState.qualifies && !scoreEntryState.saved && scoreNameInput){
      scoreNameInput.focus();
      scoreNameInput.select();
    }
  }

  function saveScoreEntry(){
    if(!scoreEntryState.qualifies || scoreEntryState.saved) return;
    const finalName = sanitizeArcadeName(state.scorecard.name);
    if(finalName.length < 1){
      toast('Enter a name to save');
      return;
    }
    const savedEntry = { name: finalName, score: Math.floor(state.scorecard.finalScore), createdAt: Date.now() };
    if(scoresApi) scoresApi.insert(savedEntry);
    scoreEntryState.saved = true;
    scoreEntryState.savedEntry = savedEntry;
    state.scorecard.name = finalName;
    if(scoreNameInput) scoreNameInput.value = finalName;
    toast('Score saved for ' + finalName);
    updateScoreEntryUi();
  }

  function toast(text){
    state.toast.text = text;
    state.toast.timer = 1.4;
  }

  function getTutorialStepMeta(step = state.tutorial.step){
    if(step === 0) return {
      title: 'Step 1',
      heading: 'Switch Lanes',
      tip: 'Press Left or Right to move into another lane.',
      controls: ['LEFT', 'RIGHT']
    };
    if(step === 1) return {
      title: 'Step 2',
      heading: 'Jump The Break',
      tip: 'Press Up to clear the floor break ahead.',
      controls: ['UP']
    };
    if(step === 2) return {
      title: 'Step 3',
      heading: 'Grab The Power-Up',
      tip: 'Collect the glowing pickup to finish the tutorial.',
      controls: ['COLLECT']
    };
    return null;
  }

  function getTutorialTip(){
    const meta = getTutorialStepMeta();
    return meta ? meta.tip : '';
  }

  function announceTutorialStep(step, force){
    if(!state.tutorial.active) return;
    if(!force && state.tutorial.announcedStep === step) return;
    state.tutorial.announcedStep = step;
    const meta = getTutorialStepMeta(step);
    if(!meta) return;
    toast('Tutorial: ' + meta.heading);
    vibrate(10);
  }

  function setTutorialStep(step){
    if(!state.tutorial.active || state.tutorial.step === step) return;
    state.tutorial.step = step;
    announceTutorialStep(step, true);
  }

  function resetWorld(){
    state.segments = [];
    state.items = [];
    state.segmentOffset = 0;
    state.nextSegmentZ = 0;
    state.nextSegmentY = 0;
    state.patternCount = 0;
    state.patternHistory = [];
    if(state.tutorial.active){
      addRoad(8, 18, 8, 0, 0, 1, 'Tutorial Run', 'Quiet');
      addCoinTrail(5, 1, 4, 1, 0.54);
      addItemAt(10, 1, 'obstacle', 0.56);
      addCoinTrail(10, 0, 5, 1, 0.55);
      addCoinTrail(10, 2, 4, 1, 0.55);
      addItemAt(17, 0, 'pit', 0.58);
      addCoinTrail(18, 0, 3, 1, 0.55);
      addItemAt(19, 0, 'shield', 0.56);
      addCoinTrail(19, 2, 3, 1, 0.55);
    } else {
      addRoad(8, 14, 8, 0, 0, 1, 'Dust Run', 'Quiet');
      addCoinTrail(8, 1, 6, 1, 0.54);
      addItemAt(18, 1, 'beacon', 0.6);
      if(isSuperDifficulty()){
        addItemAt(11, 0, 'obstacle', 0.56);
        addItemAt(15, 2, 'pit', 0.58);
        addItemAt(20, 1, 'obstacle', 0.56);
      }
    }
    ensureWorldAhead();
  }

  function resetRunState(options = {}){
    const tutorialRequested = !!options.tutorial;
    const allowAutoTutorial = options.allowAutoTutorial !== false;
    state.mode = options.mode || 'playing';
    state.difficulty = tutorialRequested ? 'normal' : options.difficulty || (settings.superDifficulty ? 'super' : 'normal');
    state.score = 0;
    state.lives = STARTING_LIVES;
    state.maxLives = STARTING_LIVES;
    state.speed = getBaseSpeed();
    state.speedTarget = getBaseSpeed();
    state.position = 0;
    state.previousPosition = 0;
    state.distance = 0;
    state.lane = 1;
    state.laneVisual = 1;
    state.jumpHeight = 0;
    state.jumpVelocity = 0;
    state.jumpBuffer = 0;
    state.groundGrace = GROUND_GRACE_TIME;
    state.grounded = true;
    state.runnerAnim = 0;
    state.landImpact = 0;
    state.recovery = 0;
    state.shield = 0;
    state.magnet = 0;
    state.boost = 0;
    state.hitFlash = 0;
    state.shake = 0;
    state.gameOverHold = 0;
    state.attractResetTimer = 0;
    state.attractThinkTimer = 0;
    state.warning = '';
    state.warningTimer = 0;
    state.toast = { text: '', timer: 0 };
    state.oneUpTimer = 0;
    state.currentTag = 'Dust Run';
    state.action = state.mode === 'menu' ? 'Demo' : 'Run';
    state.dayClock = 0;
    state.weatherClock = 0;
    state.skyShift = 0;
    state.playerScreenX = VIEW_W * 0.5;
    state.playerScreenY = getPlayerTargetY();
    state.tutorial.active = tutorialRequested || (allowAutoTutorial && shouldRunTutorial());
    state.tutorial.step = 0;
    state.tutorial.lane = false;
    state.tutorial.jump = false;
    state.tutorial.power = false;
    state.tutorial.announcedStep = -1;
    state.run = { coins: 0, beacons: 0, passed: 0, boosts: 0, extraLivesEarned: 0 };
    state.scorecard.name = '';
    state.scorecard.finalScore = 0;
    scoreEntryState.qualifies = false;
    scoreEntryState.saved = false;
    scoreEntryState.savedEntry = null;
    if(scoreNameInput) scoreNameInput.value = '';
    resetWorld();
    if(state.tutorial.active) announceTutorialStep(0, true);
  }

  function startRun(options = {}){
    primeAudio();
    hideScoreModal();
    resetRunState({ mode: 'playing', tutorial: !!options.tutorial, allowAutoTutorial: true });
    syncUi(true);
  }

  function startAttractMode(){
    hideScoreModal();
    resetRunState({ mode: 'menu', tutorial: false, allowAutoTutorial: false, difficulty: 'normal' });
    syncUi(true);
  }

  function startTutorialRun(){
    if(scoreEntryState.visible) hideScoreModal();
    startRun({ tutorial: true });
  }

  function gameOver(){
    state.mode = 'gameover';
    state.gameOverHold = GAMEOVER_HOLD_DURATION;
    state.recovery = 0;
    state.hitFlash = 0;
    state.shake = 0;
    state.warning = '';
    state.warningTimer = 0;
    state.toast = { text: '', timer: 0 };
    state.oneUpTimer = 0;
    state.best = Math.max(state.best, Math.floor(state.score));
    localStorage.setItem(STORAGE_KEYS.best, String(state.best));
    state.scorecard.finalScore = Math.floor(state.score);
    state.scorecard.name = '';
    scoreEntryState.qualifies = scoreQualifies(state.scorecard.finalScore);
    scoreEntryState.saved = false;
    scoreEntryState.savedEntry = null;
    playSound('gameover');
    hideScoreModal();
    syncUi(true);
  }

  function togglePause(){
    if(state.mode === 'playing') state.mode = 'paused';
    else if(state.mode === 'paused') state.mode = 'playing';
    syncUi(true);
  }

  function onLane(dir, options = {}){
    if(state.mode !== 'playing' && !options.force) return;
    const nextLane = clamp(state.lane + dir, 0, 2);
    if(state.tutorial.active && nextLane !== state.lane) state.tutorial.lane = true;
    if(nextLane !== state.lane && !isAttractMode()) vibrate(8);
    state.lane = nextLane;
  }

  function canJumpNow(){
    return state.grounded || state.groundGrace > 0;
  }

  function performJump(){
    const attract = isAttractMode();
    state.jumpVelocity = JUMP_VELOCITY;
    state.jumpBuffer = 0;
    state.groundGrace = 0;
    state.grounded = false;
    state.landImpact = 0.08;
    if(state.tutorial.active) state.tutorial.jump = true;
    if(!attract){
      playSound('jump');
      vibrate(12);
    }
  }

  function jump(options = {}){
    if(state.mode !== 'playing' && !options.force) return;
    state.jumpBuffer = JUMP_BUFFER_TIME;
    if(canJumpNow()) performJump();
  }

  function laneToFraction(laneValue){
    return lerp(LANE_FRACTIONS[0], LANE_FRACTIONS[2], clamp(laneValue / 2, 0, 1));
  }

  function laneAligned(itemLane, threshold){
    return Math.abs(itemLane - state.laneVisual) <= threshold;
  }

  function getRoadColors(index, mood){
    const moodTint = mood === 'Pressure' ? '#6d3b2f' : mood === 'Focus' ? '#58442d' : mood === 'Fast' ? '#5c3326' : '#4d3a2c';
    return {
      dust: index % 2 ? '#433225' : '#513d2d',
      shoulder: index % 2 ? '#5a4534' : '#69513e',
      road: index % 2 ? '#31251e' : '#3c2d24',
      wear: index % 2 ? 'rgba(255,232,196,0.04)' : 'rgba(0,0,0,0.09)',
      lane: 'rgba(243,230,207,0.11)',
      edge: 'rgba(225,164,90,0.24)',
      edgeBright: 'rgba(245,207,142,0.42)',
      crack: 'rgba(18,13,10,0.4)',
      accent: moodTint
    };
  }

  function addSegment(curve, hill, width, tag, mood){
    const index = state.segmentOffset + state.segments.length;
    const y1 = state.nextSegmentY;
    const y2 = y1 + hill * VISUAL_HILL_SCALE;
    const z1 = state.nextSegmentZ;
    const z2 = z1 + SEGMENT_LENGTH;
    const segment = { index, z1, z2, y1, y2, curve: curve * VISUAL_CURVE_SCALE, width, tag, mood, colors: getRoadColors(index, mood) };
    state.segments.push(segment);
    state.nextSegmentZ = z2;
    state.nextSegmentY = y2;
    return segment;
  }

  function addRoad(enter, hold, leave, curve, hill, width, tag, mood){
    const finalCurve = curve;
    for(let i = 0; i < enter; i++) addSegment(easeIn(0, finalCurve, i / Math.max(1, enter)), easeInOut(0, hill, i / Math.max(1, enter)), easeInOut(1, width, i / Math.max(1, enter)), tag, mood);
    for(let i = 0; i < hold; i++) addSegment(finalCurve, hill, width, tag, mood);
    for(let i = 0; i < leave; i++) addSegment(easeOut(finalCurve, 0, i / Math.max(1, leave)), easeInOut(hill, 0, i / Math.max(1, leave)), easeInOut(width, 1, i / Math.max(1, leave)), tag, mood);
  }

  function addItemAt(segmentIndex, lane, kind, offset){
    const segment = state.segments[segmentIndex];
    if(!segment) return;
    const item = { id: nextItemId++, lane, kind, z: segment.z1 + (offset || 0.55) * SEGMENT_LENGTH, resolved: false };
    if(kind === 'pit') item.variant = randomJumpHazardVariant();
    if(kind === 'obstacle') item.variant = randomWallVariant();
    state.items.push(item);
  }

  function addCoinTrail(startSegment, lane, count, spacing, offset){
    for(let i = 0; i < count; i += 2) addItemAt(startSegment + i * (spacing || 1), lane, 'coin', offset === undefined ? 0.54 : offset);
  }

  function addRewardSet(startSegment, lane, rewardKind){
    addCoinTrail(startSegment, lane, 3, 1, 0.54);
    addItemAt(startSegment + 3, lane, rewardKind, 0.56);
  }

  function addZigZagCoins(startSegment, startLane, count, offset){
    let lane = startLane;
    for(let i = 0; i < count; i++){
      if(i % 2 === 0) addItemAt(startSegment + i, lane, 'coin', offset === undefined ? 0.55 : offset);
      if(i < count - 1 && maybe(0.72)){
        const dir = maybe(0.5) ? -1 : 1;
        lane = clamp(lane + dir, 0, 2);
      }
    }
  }

  function addBeaconOrPowerup(segmentIndex, lane){
    const roll = Math.random();
    const kind = roll < 0.18 ? 'beacon' : roll < 0.46 ? 'shield' : roll < 0.73 ? 'magnet' : 'boost';
    addItemAt(segmentIndex, lane, kind, 0.56);
  }

  function buildStraightPattern(){
    const start = state.segments.length;
    const lanes = shuffledLanes();
    addRoad(6, 20, 6, 0, 0, 1, 'Dust Flats', 'Quiet');
    addZigZagCoins(start + 4, lanes[0], 8, 0.56);
    addCoinTrail(start + 7, lanes[1], 5, 1, 0.55);
    if(maybe(0.6)) addItemAt(start + 13, lanes[1], 'obstacle', 0.56);
    if(maybe(0.42)) addItemAt(start + 18, lanes[2], 'pit', 0.58);
    addBeaconOrPowerup(start + 16, lanes[2]);
  }

  function buildPitChoicePattern(){
    const start = state.segments.length;
    const lanes = shuffledLanes();
    const pitLane = lanes[0];
    const safeLane = lanes[1];
    const bonusLane = lanes[2];
    addRoad(6, 18, 6, 0.0032, 0, 1, 'Vault Bend', 'Pressure');
    addCoinTrail(start + 4, pitLane, 4, 1, 0.54);
    addItemAt(start + 10, pitLane, 'pit', 0.58);
    addCoinTrail(start + 10, safeLane, 7, 1, 0.56);
    addCoinTrail(start + 12, bonusLane, 4, 1, 0.55);
    addItemAt(start + 16, bonusLane, 'obstacle', 0.56);
    if(maybe(0.52)) addItemAt(start + 19, safeLane, 'pit', 0.58);
    if(maybe(0.62)) addBeaconOrPowerup(start + 15, safeLane);
  }

  function buildCraterFieldPattern(){
    const start = state.segments.length;
    const lanes = shuffledLanes();
    addRoad(6, 18, 6, -0.003, 0, 1, 'Collapsed Right', 'Focus');
    addCoinTrail(start + 4, lanes[0], 4, 1, 0.55);
    addCoinTrail(start + 5, lanes[1], 3, 1, 0.55);
    addItemAt(start + 10, lanes[2], 'pit', 0.58);
    addCoinTrail(start + 12, lanes[1], 5, 1, 0.56);
    addItemAt(start + 15, lanes[0], 'obstacle', 0.56);
    addItemAt(start + 18, lanes[2], 'pit', 0.58);
    if(maybe(0.58)) addItemAt(start + 21, lanes[1], 'obstacle', 0.56);
    if(maybe(0.5)) addBeaconOrPowerup(start + 16, lanes[1]);
  }

  function buildCenterBlockPattern(){
    const start = state.segments.length;
    const lanes = shuffledLanes();
    const blockLane = lanes[0];
    addRoad(4, 16, 4, 0, 0.01, 1, 'Broken Rise', 'Fast');
    addCoinTrail(start + 4, lanes[1], 4, 1, 0.54);
    addCoinTrail(start + 4, lanes[2], 4, 1, 0.54);
    addItemAt(start + 8, blockLane, 'obstacle', 0.55);
    addCoinTrail(start + 10, lanes[1], 3, 1, 0.55);
    addItemAt(start + 15, lanes[2], 'obstacle', 0.56);
    if(maybe(0.48)) addItemAt(start + 19, lanes[1], 'pit', 0.58);
    addBeaconOrPowerup(start + 12, lanes[2]);
  }

  function buildMagnetPattern(){
    const start = state.segments.length;
    const lanes = shuffledLanes();
    addRoad(6, 18, 6, 0.0024, -0.008, 1, 'Ash Sweep', 'Flow');
    addRewardSet(start + 4, lanes[0], 'magnet');
    addCoinTrail(start + 10, 0, 5, 1, 0.54);
    addCoinTrail(start + 10, 1, 5, 1, 0.54);
    addCoinTrail(start + 10, 2, 5, 1, 0.54);
    if(maybe(0.42)) addItemAt(start + 17, lanes[1], 'obstacle', 0.56);
    if(maybe(0.4)) addItemAt(start + 20, lanes[2], 'pit', 0.58);
  }

  function buildShieldPattern(){
    const start = state.segments.length;
    const lanes = shuffledLanes();
    addRoad(6, 16, 6, -0.0026, 0.012, 1, 'Ruin Shelf', 'Focus');
    addCoinTrail(start + 4, lanes[0], 6, 1, 0.54);
    addRewardSet(start + 11, lanes[1], 'shield');
    addItemAt(start + 18, lanes[2], 'obstacle', 0.55);
    addCoinTrail(start + 19, lanes[0], 3, 1, 0.55);
    addItemAt(start + 21, lanes[0], 'pit', 0.58);
  }

  function buildBoostPattern(){
    const start = state.segments.length;
    const lanes = shuffledLanes();
    addRoad(8, 22, 8, 0, -0.012, 1.02, 'Ravine Drop', 'Fast');
    addRewardSet(start + 5, lanes[0], 'boost');
    addZigZagCoins(start + 10, lanes[0], 7, 0.55);
    addItemAt(start + 18, lanes[1], 'pit', 0.58);
    addCoinTrail(start + 20, lanes[2], 4, 1, 0.55);
    addItemAt(start + 22, lanes[0], 'obstacle', 0.56);
  }

  function buildWeavePattern(){
    const start = state.segments.length;
    const lanes = shuffledLanes();
    addRoad(6, 22, 6, 0.0035, 0, 1, 'Scrap Weave', 'Pressure');
    addItemAt(start + 6, lanes[0], 'obstacle', 0.56);
    addItemAt(start + 12, lanes[1], 'pit', 0.58);
    addItemAt(start + 18, lanes[2], 'pit', 0.58);
    addCoinTrail(start + 7, lanes[2], 3, 1, 0.55);
    addCoinTrail(start + 20, lanes[0], 4, 1, 0.55);
    addItemAt(start + 22, lanes[1], 'obstacle', 0.56);
    addItemAt(start + 24, lanes[0], 'pit', 0.58);
    if(maybe(0.55)) addBeaconOrPowerup(start + 22, lanes[2]);
  }

  function buildComboPattern(){
    const start = state.segments.length;
    const lanes = shuffledLanes();
    addRoad(8, 20, 8, -0.0038, -0.01, 0.98, 'Temple Pass', 'Pressure');
    addItemAt(start + 7, lanes[0], 'pit', 0.58);
    addCoinTrail(start + 9, lanes[1], 4, 1, 0.55);
    addItemAt(start + 14, lanes[2], 'pit', 0.58);
    addCoinTrail(start + 17, lanes[2], 4, 1, 0.55);
    addItemAt(start + 22, lanes[1], 'obstacle', 0.55);
    addItemAt(start + 25, lanes[0], 'pit', 0.58);
    if(maybe(0.6)) addBeaconOrPowerup(start + 24, lanes[2]);
  }

  function buildRecoveryPattern(){
    const start = state.segments.length;
    addRoad(8, 24, 8, 0, 0, 1, 'Recovery Flats', 'Quiet');
    addCoinTrail(start + 5, 0, 4, 1, 0.54);
    addCoinTrail(start + 9, 1, 4, 1, 0.54);
    addCoinTrail(start + 13, 2, 4, 1, 0.54);
    addBeaconOrPowerup(start + 18, 1);
  }

  function buildStoneFakeoutPattern(){
    const start = state.segments.length;
    const lanes = shuffledLanes();
    const baitLane = lanes[0];
    const escapeLane = lanes[1];
    const supportLane = lanes[2];
    addRoad(6, 20, 6, maybe(0.5) ? 0.0026 : -0.0026, 0, 1, 'Stone Feint', 'Pressure');
    addCoinTrail(start + 4, baitLane, 4, 1, 0.55);
    addItemAt(start + 10, baitLane, 'obstacle', 0.56);
    addCoinTrail(start + 8, escapeLane, 7, 1, 0.55);
    addCoinTrail(start + 11, supportLane, 4, 1, 0.55);
    addItemAt(start + 17, supportLane, 'obstacle', 0.56);
    if(maybe(0.5)) addItemAt(start + 20, escapeLane, 'pit', 0.58);
    if(maybe(0.48)) addBeaconOrPowerup(start + 16, escapeLane);
  }

  function buildDoubleStonePattern(){
    const start = state.segments.length;
    const lanes = shuffledLanes();
    addRoad(6, 20, 6, maybe(0.5) ? 0.0032 : -0.0032, 0.008, 1, 'Ruin Gate', 'Pressure');
    addItemAt(start + 7, lanes[0], 'obstacle', 0.56);
    addCoinTrail(start + 8, lanes[1], 5, 1, 0.55);
    addItemAt(start + 14, lanes[2], 'obstacle', 0.56);
    addItemAt(start + 19, lanes[0], 'pit', 0.58);
    addCoinTrail(start + 15, lanes[0], 4, 1, 0.55);
    addBeaconOrPowerup(start + 18, lanes[1]);
  }

  function buildSafeRecoveryPattern(){
    const start = state.segments.length;
    addRoad(10, 28, 10, 0, 0, 1, 'Safe Basin', 'Quiet');
    addZigZagCoins(start + 6, 1, 8, 0.54);
    addCoinTrail(start + 16, 0, 4, 1, 0.54);
    addCoinTrail(start + 16, 2, 4, 1, 0.54);
    addBeaconOrPowerup(start + 22, 1);
  }

  function buildJackpotPattern(){
    const start = state.segments.length;
    const lanes = shuffledLanes();
    addRoad(8, 26, 8, maybe(0.5) ? 0.002 : -0.002, -0.004, 1.02, 'Jackpot Corridor', 'Flow');
    addCoinTrail(start + 5, 0, 8, 1, 0.54);
    addCoinTrail(start + 5, 1, 8, 1, 0.54);
    addCoinTrail(start + 5, 2, 8, 1, 0.54);
    addRewardSet(start + 10, lanes[0], sample(['boost', 'magnet']));
    addRewardSet(start + 14, lanes[1], sample(['shield', 'beacon']));
    addCoinTrail(start + 18, lanes[2], 6, 1, 0.55);
    addBeaconOrPowerup(start + 22, lanes[0]);
  }

  function buildWallRushPattern(){
    const start = state.segments.length;
    const lanes = shuffledLanes();
    addRoad(8, 24, 8, maybe(0.5) ? 0.003 : -0.003, 0.002, 1, 'Wall Rush', 'Pressure');
    addItemAt(start + 6, lanes[0], 'obstacle', 0.56);
    addItemAt(start + 11, lanes[1], 'obstacle', 0.56);
    addItemAt(start + 16, lanes[2], 'obstacle', 0.56);
    addItemAt(start + 21, lanes[0], 'pit', 0.58);
    addCoinTrail(start + 8, lanes[2], 3, 1, 0.55);
    addCoinTrail(start + 18, lanes[1], 3, 1, 0.55);
    if(maybe(0.42)) addBeaconOrPowerup(start + 23, lanes[2]);
  }

  function buildCraterStormPattern(){
    const start = state.segments.length;
    const lanes = shuffledLanes();
    addRoad(8, 22, 8, maybe(0.5) ? -0.0034 : 0.0034, -0.004, 0.98, 'Crater Storm', 'Pressure');
    addItemAt(start + 7, lanes[0], 'pit', 0.58);
    addItemAt(start + 12, lanes[2], 'pit', 0.58);
    addItemAt(start + 16, lanes[1], 'obstacle', 0.56);
    addItemAt(start + 20, lanes[0], 'pit', 0.58);
    addItemAt(start + 23, lanes[2], 'obstacle', 0.56);
    addCoinTrail(start + 9, lanes[1], 4, 1, 0.55);
    if(maybe(0.35)) addBeaconOrPowerup(start + 24, lanes[1]);
  }

  function buildGauntletPattern(){
    const start = state.segments.length;
    const lanes = shuffledLanes();
    addRoad(8, 24, 8, maybe(0.5) ? 0.0034 : -0.0034, 0.004, 1, 'Gauntlet Run', 'Pressure');
    addItemAt(start + 6, lanes[0], 'obstacle', 0.56);
    addItemAt(start + 11, lanes[1], 'pit', 0.58);
    addItemAt(start + 16, lanes[2], 'pit', 0.58);
    addItemAt(start + 21, lanes[2], 'obstacle', 0.56);
    addCoinTrail(start + 8, lanes[2], 3, 1, 0.55);
    addCoinTrail(start + 18, lanes[0], 3, 1, 0.55);
  }

  function buildPinchPattern(){
    const start = state.segments.length;
    const lanes = shuffledLanes();
    addRoad(6, 18, 6, maybe(0.5) ? -0.0028 : 0.0028, -0.006, 0.98, 'Pinch Pass', 'Pressure');
    addItemAt(start + 7, lanes[0], 'obstacle', 0.56);
    addItemAt(start + 7, lanes[1], 'obstacle', 0.56);
    addCoinTrail(start + 9, lanes[2], 5, 1, 0.55);
    addItemAt(start + 15, lanes[1], 'pit', 0.58);
    addBeaconOrPowerup(start + 18, lanes[2]);
  }

  function buildCheckpointPattern(){
    const start = state.segments.length;
    addRoad(8, 24, 8, 0, 0, 1, 'Ruined Checkpoint', 'Focus');
    addCoinTrail(start + 5, 1, 6, 1, 0.55);
    addItemAt(start + 8, 0, 'obstacle', 0.56);
    addItemAt(start + 8, 2, 'obstacle', 0.56);
    addCoinTrail(start + 10, 1, 4, 1, 0.55);
    addItemAt(start + 15, 1, 'pit', 0.58);
    addCoinTrail(start + 16, 2, 4, 1, 0.55);
    addBeaconOrPowerup(start + 20, 1);
  }

  function buildTowerPattern(){
    const start = state.segments.length;
    const lanes = shuffledLanes();
    addRoad(8, 24, 8, maybe(0.5) ? 0.003 : -0.003, 0, 1, 'Tower Corridor', 'Flow');
    addCoinTrail(start + 5, lanes[0], 4, 1, 0.54);
    addCoinTrail(start + 10, lanes[1], 4, 1, 0.54);
    addCoinTrail(start + 15, lanes[2], 4, 1, 0.54);
    addItemAt(start + 9, lanes[2], 'obstacle', 0.56);
    addItemAt(start + 14, lanes[0], 'pit', 0.58);
    addItemAt(start + 19, lanes[1], 'obstacle', 0.56);
    addBeaconOrPowerup(start + 22, lanes[2]);
  }

  function buildBeaconJackpotPattern(){
    const start = state.segments.length;
    const lanes = shuffledLanes();
    addRoad(8, 26, 8, maybe(0.5) ? 0.002 : -0.002, -0.004, 1.02, 'Beacon Jackpot', 'Flow');
    addCoinTrail(start + 5, 0, 8, 1, 0.54);
    addCoinTrail(start + 5, 1, 8, 1, 0.54);
    addCoinTrail(start + 5, 2, 8, 1, 0.54);
    addItemAt(start + 13, lanes[0], 'beacon', 0.56);
    addItemAt(start + 15, lanes[1], sample(['boost', 'magnet']), 0.56);
    addItemAt(start + 17, lanes[2], sample(['shield', 'beacon']), 0.56);
    addCoinTrail(start + 19, lanes[1], 5, 1, 0.55);
  }

  function buildCollapseFakeoutPattern(){
    const start = state.segments.length;
    const lanes = shuffledLanes();
    const baitLane = lanes[0];
    const switchLane = lanes[1];
    const rewardLane = lanes[2];
    addRoad(8, 22, 8, maybe(0.5) ? -0.0032 : 0.0032, 0, 0.98, 'Collapse Fakeout', 'Pressure');
    addCoinTrail(start + 5, baitLane, 5, 1, 0.55);
    addItemAt(start + 11, baitLane, 'obstacle', 0.56);
    addCoinTrail(start + 9, switchLane, 4, 1, 0.55);
    addItemAt(start + 15, switchLane, 'pit', 0.58);
    addCoinTrail(start + 16, rewardLane, 5, 1, 0.55);
    addBeaconOrPowerup(start + 21, rewardLane);
  }

  function buildDenseCraterPattern(){
    const start = state.segments.length;
    const lanes = shuffledLanes();
    addRoad(8, 24, 8, maybe(0.5) ? 0.0035 : -0.0035, -0.004, 0.98, 'Crater Gauntlet', 'Pressure');
    addItemAt(start + 6, lanes[0], 'pit', 0.58);
    addItemAt(start + 10, lanes[1], 'pit', 0.58);
    addItemAt(start + 14, lanes[2], 'pit', 0.58);
    addItemAt(start + 18, lanes[1], 'obstacle', 0.56);
    addItemAt(start + 21, lanes[0], 'pit', 0.58);
    addCoinTrail(start + 7, lanes[2], 3, 1, 0.55);
    addCoinTrail(start + 15, lanes[0], 3, 1, 0.55);
    if(maybe(0.52)) addBeaconOrPowerup(start + 22, lanes[2]);
  }

  function hasHazardNear(segmentIndex, lane){
    return state.items.some((item) => {
      if(item.resolved) return false;
      if(item.kind !== 'obstacle' && item.kind !== 'pit') return false;
      return Math.abs(Math.floor(item.z / SEGMENT_LENGTH) - segmentIndex) <= 1 && item.lane === lane;
    });
  }

  function hazardCountNear(segmentIndex){
    let count = 0;
    for(const item of state.items){
      if(item.resolved) continue;
      if(item.kind !== 'obstacle' && item.kind !== 'pit') continue;
      if(Math.abs(Math.floor(item.z / SEGMENT_LENGTH) - segmentIndex) <= 1) count++;
    }
    return count;
  }

  function isPressurePattern(entry){
    return entry.id === 'pitChoice'
      || entry.id === 'craterField'
      || entry.id === 'centerBlock'
      || entry.id === 'stoneFakeout'
      || entry.id === 'wallRush'
      || entry.id === 'gauntlet'
      || entry.id === 'doubleStone'
      || entry.id === 'pinch'
      || entry.id === 'craterStorm'
      || entry.id === 'weave'
      || entry.id === 'combo';
  }

  function getPatternWeight(entry){
    const pressureRamp = clamp(state.distance / 3200, 0, 1);
    if(!isSuperDifficulty()){
      let weight = entry.weight;
      if(entry.id === 'recovery' || entry.id === 'safeRecovery') weight *= lerp(1, 0.58, pressureRamp);
      else if(entry.id === 'straight') weight *= lerp(1, 0.68, pressureRamp);
      else if(entry.id === 'jackpot') weight *= lerp(1, 0.92, pressureRamp);
      else if(isPressurePattern(entry)) weight *= lerp(1, 1.28, pressureRamp);
      return weight;
    }
    if(entry.id === 'recovery' || entry.id === 'safeRecovery') return entry.weight * 0.18;
    if(entry.id === 'jackpot') return entry.weight * 0.55;
    if(entry.id === 'straight') return entry.weight * 0.45;
    if(isPressurePattern(entry)) return entry.weight * 2.05;
    return entry.weight * 1.45;
  }

  function addDynamicPressure(startIndex, endIndex){
    if(state.tutorial.active) return;
    const usableStart = startIndex + 6;
    const usableEnd = endIndex - 4;
    if(usableEnd <= usableStart) return;
    const pressureRamp = clamp(state.distance / 3400, 0, 1);
    let extraCount = 0;
    if(isSuperDifficulty()){
      extraCount = 2 + (Math.random() < 0.75 ? 1 : 0) + (Math.random() < 0.35 ? 1 : 0);
    } else {
      if(pressureRamp > 0.22 && Math.random() < lerp(0.22, 0.74, pressureRamp)) extraCount++;
      if(pressureRamp > 0.58 && Math.random() < lerp(0.08, 0.42, pressureRamp)) extraCount++;
    }
    if(extraCount <= 0) return;
    const maxCluster = isSuperDifficulty() ? 3 : 2;
    for(let i = 0; i < extraCount; i++){
      const segmentIndex = usableStart + randomIndex(Math.max(1, usableEnd - usableStart));
      const lane = randomIndex(3);
      if(hasHazardNear(segmentIndex, lane)) continue;
      if(hazardCountNear(segmentIndex) >= maxCluster) continue;
      const kind = Math.random() < 0.58 ? 'obstacle' : 'pit';
      addItemAt(segmentIndex, lane, kind, kind === 'pit' ? 0.58 : 0.56);
    }
  }

  function selectPattern(){
    const tier = clamp(Math.floor(state.distance / 1600), 0, 3);
    const tier0 = [
      { id: 'straight', build: buildStraightPattern, weight: 2.9 },
      { id: 'pitChoice', build: buildPitChoicePattern, weight: 1.55 },
      { id: 'craterField', build: buildCraterFieldPattern, weight: 1.3 },
      { id: 'checkpoint', build: buildCheckpointPattern, weight: 1.2 },
      { id: 'tower', build: buildTowerPattern, weight: 0.95 },
      { id: 'recovery', build: buildRecoveryPattern, weight: 0.92 },
      { id: 'safeRecovery', build: buildSafeRecoveryPattern, weight: 0.65 },
      { id: 'centerBlock', build: buildCenterBlockPattern, weight: 1.45 },
      { id: 'stoneFakeout', build: buildStoneFakeoutPattern, weight: 1.1 },
      { id: 'wallRush', build: buildWallRushPattern, weight: 1.05 },
      { id: 'gauntlet', build: buildGauntletPattern, weight: 0.9 }
    ];
    const tier1 = [
      { id: 'pitChoice', build: buildPitChoicePattern, weight: 1.95 },
      { id: 'craterField', build: buildCraterFieldPattern, weight: 1.65 },
      { id: 'checkpoint', build: buildCheckpointPattern, weight: 1.05 },
      { id: 'tower', build: buildTowerPattern, weight: 1.0 },
      { id: 'centerBlock', build: buildCenterBlockPattern, weight: 1.8 },
      { id: 'stoneFakeout', build: buildStoneFakeoutPattern, weight: 1.45 },
      { id: 'wallRush', build: buildWallRushPattern, weight: 1.4 },
      { id: 'gauntlet', build: buildGauntletPattern, weight: 1.28 },
      { id: 'collapse', build: buildCollapseFakeoutPattern, weight: 1.05 },
      { id: 'magnet', build: buildMagnetPattern, weight: 1.4 },
      { id: 'shield', build: buildShieldPattern, weight: 1.3 },
      { id: 'craterStorm', build: buildCraterStormPattern, weight: 1.2 },
      { id: 'recovery', build: buildRecoveryPattern, weight: 0.55 },
      { id: 'safeRecovery', build: buildSafeRecoveryPattern, weight: 0.45 }
    ];
    const tier2 = [
      { id: 'checkpoint', build: buildCheckpointPattern, weight: 0.92 },
      { id: 'tower', build: buildTowerPattern, weight: 1.02 },
      { id: 'centerBlock', build: buildCenterBlockPattern, weight: 1.82 },
      { id: 'pitChoice', build: buildPitChoicePattern, weight: 1.55 },
      { id: 'craterField', build: buildCraterFieldPattern, weight: 1.45 },
      { id: 'doubleStone', build: buildDoubleStonePattern, weight: 1.7 },
      { id: 'stoneFakeout', build: buildStoneFakeoutPattern, weight: 1.65 },
      { id: 'pinch', build: buildPinchPattern, weight: 1.55 },
      { id: 'wallRush', build: buildWallRushPattern, weight: 1.65 },
      { id: 'craterStorm', build: buildCraterStormPattern, weight: 1.5 },
      { id: 'denseCrater', build: buildDenseCraterPattern, weight: 1.46 },
      { id: 'collapse', build: buildCollapseFakeoutPattern, weight: 1.32 },
      { id: 'gauntlet', build: buildGauntletPattern, weight: 1.9 },
      { id: 'magnet', build: buildMagnetPattern, weight: 1.4 },
      { id: 'boost', build: buildBoostPattern, weight: 1.3 },
      { id: 'weave', build: buildWeavePattern, weight: 1.8 },
      { id: 'recovery', build: buildRecoveryPattern, weight: 0.38 },
      { id: 'safeRecovery', build: buildSafeRecoveryPattern, weight: 0.42 },
      { id: 'beaconJackpot', build: buildBeaconJackpotPattern, weight: 0.38 }
    ];
    const tier3 = [
      { id: 'tower', build: buildTowerPattern, weight: 0.94 },
      { id: 'weave', build: buildWeavePattern, weight: 1.8 },
      { id: 'boost', build: buildBoostPattern, weight: 1.2 },
      { id: 'pitChoice', build: buildPitChoicePattern, weight: 1.45 },
      { id: 'craterField', build: buildCraterFieldPattern, weight: 1.35 },
      { id: 'combo', build: buildComboPattern, weight: 1.7 },
      { id: 'doubleStone', build: buildDoubleStonePattern, weight: 1.8 },
      { id: 'stoneFakeout', build: buildStoneFakeoutPattern, weight: 1.55 },
      { id: 'pinch', build: buildPinchPattern, weight: 1.8 },
      { id: 'wallRush', build: buildWallRushPattern, weight: 1.75 },
      { id: 'craterStorm', build: buildCraterStormPattern, weight: 1.7 },
      { id: 'denseCrater', build: buildDenseCraterPattern, weight: 1.72 },
      { id: 'collapse', build: buildCollapseFakeoutPattern, weight: 1.55 },
      { id: 'gauntlet', build: buildGauntletPattern, weight: 2.05 },
      { id: 'shield', build: buildShieldPattern, weight: 1.1 },
      { id: 'recovery', build: buildRecoveryPattern, weight: 0.28 },
      { id: 'safeRecovery', build: buildSafeRecoveryPattern, weight: 0.3 },
      { id: 'beaconJackpot', build: buildBeaconJackpotPattern, weight: 0.52 }
    ];
    const pool = tier === 0 ? tier0 : tier === 1 ? tier1 : tier === 2 ? tier2 : tier3;
    const recent = state.patternHistory.slice(-2);
    const available = pool.filter((entry) => !recent.includes(entry.id));
    const source = available.length ? available : pool;
    let totalWeight = 0;
    source.forEach((entry) => { totalWeight += getPatternWeight(entry); });
    let pick = Math.random() * totalWeight;
    let pattern = source[source.length - 1];
    for(const entry of source){
      pick -= getPatternWeight(entry);
      if(pick <= 0){
        pattern = entry;
        break;
      }
    }
    state.patternCount++;
    state.patternHistory.push(pattern.id);
    if(state.patternHistory.length > 5) state.patternHistory.shift();
    const beforeSegments = state.segments.length;
    pattern.build();
    addDynamicPressure(beforeSegments, state.segments.length);
  }

  function ensureWorldAhead(){
    const targetZ = state.position + SEGMENT_LENGTH * (DRAW_DISTANCE + 40);
    while(state.nextSegmentZ < targetZ){
      selectPattern();
    }
  }

  function pruneWorld(){
    const keepFromZ = state.position - SEGMENT_LENGTH * 8;
    let removeCount = 0;
    while(removeCount < state.segments.length && state.segments[removeCount].z2 < keepFromZ){
      removeCount++;
    }
    if(removeCount > 0){
      state.segments.splice(0, removeCount);
      state.segmentOffset += removeCount;
    }

    if(state.items.length > 220){
      const pruneFromZ = state.position - SEGMENT_LENGTH * 5;
      state.items = state.items.filter((item) => !(item.resolved && item.z < pruneFromZ) && item.z >= pruneFromZ - SEGMENT_LENGTH * 2);
    }
  }

  function resolveHit(item, message){
    if(state.recovery > 0 || item.resolved) return;
    const attract = isAttractMode();
    item.resolved = true;
    if(state.shield > 0){
      state.shield = 0;
      state.recovery = 0.7;
      state.hitFlash = HIT_FLASH_DURATION * (attract ? 0.32 : 0.6);
      state.shake = attract ? 0.08 : 0.18;
      if(!attract){
        state.warning = 'Shield saved you';
        state.warningTimer = 0.8;
        toast('Shield saved you');
        playSound('shield-hit');
        vibrate([14, 18, 14]);
      }
      return;
    }
    state.lives--;
    state.recovery = RECOVERY_DURATION;
    state.hitFlash = HIT_FLASH_DURATION;
    state.shake = 0.34;
    state.warning = message;
    state.warningTimer = 0.95;
    state.jumpHeight = 0;
    state.jumpVelocity = 0;
    state.jumpBuffer = 0;
    state.groundGrace = GROUND_GRACE_TIME;
    state.grounded = true;
    state.lane = 1;
    if(state.lives <= 0){
      if(attract){
        state.recovery = 0;
        state.attractResetTimer = ATTRACT_RESET_DELAY;
        state.action = 'Demo';
      } else {
        gameOver();
      }
      return;
    }
    if(!attract){
      toast('Life lost');
      playSound('hit');
      vibrate([20, 24, 20]);
    } else {
      state.warning = '';
      state.warningTimer = 0;
      state.toast = { text: '', timer: 0 };
      state.oneUpTimer = 0;
    }
  }

  function getPickupScore(kind){
    if(kind === 'coin') return 100;
    if(kind === 'beacon') return 500;
    if(kind === 'shield') return 150;
    if(kind === 'magnet') return 150;
    if(kind === 'boost') return 180;
    return 0;
  }

  function getPickupLabel(kind){
    if(kind === 'coin' || kind === 'beacon') return '+' + String(getPickupScore(kind));
    if(kind === 'shield') return 'SHIELD';
    if(kind === 'magnet') return 'MAGNET';
    if(kind === 'boost') return 'BOOST';
    return '';
  }

  function maybeAwardExtraLifeFromCoins(attract){
    const earnedMilestones = Math.floor(state.run.coins / COINS_PER_EXTRA_LIFE);
    if(earnedMilestones <= state.run.extraLivesEarned) return;
    state.run.extraLivesEarned = earnedMilestones;
    state.lives++;
    state.maxLives = Math.max(state.maxLives, state.lives);
    if(!attract){
      state.oneUpTimer = ONE_UP_DURATION;
      playSound('beacon');
      vibrate([12, 20, 12]);
      syncUi(true);
    }
  }

  function collectItem(item){
    if(item.resolved) return;
    const attract = isAttractMode();
    item.resolved = true;
    const pickupScore = getPickupScore(item.kind);
    if(pickupScore > 0) state.score += pickupScore;
    if(item.kind === 'coin'){
      state.run.coins++;
      maybeAwardExtraLifeFromCoins(attract);
      if(!attract) playSound('coin');
    } else if(item.kind === 'beacon'){
      state.run.beacons++;
      if(!attract){
        toast('Beacon collected');
        playSound('beacon');
        vibrate(14);
      }
    } else if(item.kind === 'shield'){
      state.shield = SHIELD_DURATION;
      if(!attract){
        toast('Shield ready');
        playSound('shield');
        vibrate([10, 18, 10]);
      }
    } else if(item.kind === 'magnet'){
      state.magnet = MAGNET_DURATION;
      if(!attract){
        toast('Magnet ready');
        playSound('magnet');
        vibrate([10, 18, 10]);
      }
    } else if(item.kind === 'boost'){
      state.boost = BOOST_DURATION;
      state.speed = Math.max(state.speed, getBaseSpeed() + getBoostExtraSpeed() * 0.9);
      state.speedTarget = Math.max(state.speedTarget, getMaxSpeed() + getBoostExtraSpeed() * 0.9);
      state.run.boosts++;
      if(!attract){
        toast('Boost on');
        playSound('boost');
        vibrate([12, 20, 12]);
      }
    }
    if(state.tutorial.active && (item.kind === 'shield' || item.kind === 'magnet' || item.kind === 'boost')) state.tutorial.power = true;
  }

  function pickupZone(item){
    if(item.kind === 'coin') return { front: state.magnet > 0 ? 18 : 8.8, rear: -2.4 };
    return { front: state.magnet > 0 ? 16 : 8, rear: -2.2 };
  }

  function hazardZone(item){
    if(item.kind === 'pit') return { front: 5.1, rear: -0.9 };
    return { front: 4.7, rear: -0.85 };
  }

  function getPlayerDistance(itemZ, position){
    return itemZ - (position + PLAYER_PLANE_Z);
  }

  function findNearestAttractHazard(lane, kind, maxDistance){
    let nearestItem = null;
    let nearestDistance = Infinity;
    for(const item of state.items){
      if(item.resolved || item.kind !== kind || item.lane !== lane) continue;
      const distance = getPlayerDistance(item.z, state.position);
      if(distance < -3 || distance > maxDistance || distance >= nearestDistance) continue;
      nearestDistance = distance;
      nearestItem = item;
    }
    return nearestItem ? { item: nearestItem, distance: nearestDistance } : null;
  }

  function chooseAttractLane(){
    const scores = [-0.2, 0, -0.2];
    for(const item of state.items){
      if(item.resolved) continue;
      const distance = getPlayerDistance(item.z, state.position);
      if(distance < -4 || distance > 56) continue;
      if(item.kind === 'coin'){
        scores[item.lane] += distance < 20 ? 2.3 : 1.15;
      } else if(item.kind === 'beacon'){
        scores[item.lane] += distance < 24 ? 5.4 : 3.8;
      } else if(item.kind === 'shield' || item.kind === 'magnet' || item.kind === 'boost'){
        scores[item.lane] += distance < 24 ? 4.8 : 3.2;
      } else if(item.kind === 'obstacle'){
        scores[item.lane] -= distance < 13 ? 18 : distance < 24 ? 8.5 : 3.4;
      } else if(item.kind === 'pit'){
        scores[item.lane] -= distance < 10 ? 6.2 : distance < 22 ? 2.2 : 0.9;
      }
    }

    for(let lane = 0; lane < 3; lane++){
      scores[lane] -= Math.abs(lane - state.laneVisual) * 0.7;
      const obstacle = findNearestAttractHazard(lane, 'obstacle', 18);
      const pit = findNearestAttractHazard(lane, 'pit', 12);
      if(obstacle) scores[lane] -= 16 - obstacle.distance * 0.45;
      if(pit && !canJumpNow()) scores[lane] -= 8 - pit.distance * 0.35;
    }

    let bestLane = state.lane;
    let bestScore = -Infinity;
    for(let lane = 0; lane < 3; lane++){
      if(scores[lane] > bestScore){
        bestScore = scores[lane];
        bestLane = lane;
      }
    }
    return bestLane;
  }

  function updateAttract(dt){
    if(state.attractResetTimer > 0){
      state.attractResetTimer = Math.max(0, state.attractResetTimer - dt);
      if(state.attractResetTimer === 0){
        startAttractMode();
      }
      return;
    }

    state.attractThinkTimer -= dt;
    if(state.attractThinkTimer <= 0){
      state.attractThinkTimer = ATTRACT_THINK_INTERVAL;

      const currentLane = state.lane;
      const obstacleAhead = findNearestAttractHazard(currentLane, 'obstacle', 18);
      const pitAhead = findNearestAttractHazard(currentLane, 'pit', 13);
      let targetLane = chooseAttractLane();

      if(obstacleAhead && obstacleAhead.distance < 10.8){
        const escapeLane = chooseAttractLane();
        if(escapeLane !== currentLane) targetLane = escapeLane;
      }

      if(pitAhead && pitAhead.distance < 8.8){
        if(canJumpNow() || state.jumpHeight > 0.16){
          jump({ force: true });
        } else {
          targetLane = chooseAttractLane();
        }
      }

      if(targetLane > state.lane) onLane(1, { force: true });
      else if(targetLane < state.lane) onLane(-1, { force: true });
    }

    update(dt);
    if(state.mode === 'menu'){
      state.action = state.hitFlash > 0
        ? 'Demo'
        : !state.grounded
          ? 'Demo Jump'
          : Math.abs(state.lane - state.laneVisual) > 0.04
            ? 'Demo Shift'
            : 'Demo';
    }
  }

  function overlapsZone(previousDistance, currentDistance, zone){
    return currentDistance <= zone.front && previousDistance >= zone.rear;
  }

  function evaluateItems(){
    for(const item of state.items){
      if(item.resolved) continue;
      const pickupLaneHit = laneAligned(item.lane, PICKUP_LANE_THRESHOLD);
      const hazardThreshold = item.kind === 'pit' ? PIT_LANE_THRESHOLD : OBSTACLE_LANE_THRESHOLD;
      const hazardLaneHit = laneAligned(item.lane, hazardThreshold);
      const previousDistance = getPlayerDistance(item.z, state.previousPosition);
      const distance = getPlayerDistance(item.z, state.position);
      if(item.kind === 'coin' || item.kind === 'beacon' || item.kind === 'shield' || item.kind === 'magnet' || item.kind === 'boost'){
        const zone = pickupZone(item);
        if(distance < zone.rear){
          item.resolved = true;
          continue;
        }
        if(!overlapsZone(previousDistance, distance, zone)) continue;
        if(pickupLaneHit || state.magnet > 0) collectItem(item);
        continue;
      }

      const zone = hazardZone(item);
      if(distance < zone.rear){
        item.resolved = true;
        state.run.passed++;
        continue;
      }
      if(!overlapsZone(previousDistance, distance, zone)) continue;
      if(!hazardLaneHit) continue;

      if(item.kind === 'pit' && state.jumpHeight < 0.62){ resolveHit(item, 'Jump the break'); return; }
      if(item.kind === 'obstacle'){ resolveHit(item, 'Switch lanes to avoid the wall'); return; }
    }

  }

  function syncUiLabel(node, cacheKey, value){
    if(!node) return;
    if(uiCache[cacheKey] === value) return;
    uiCache[cacheKey] = value;
    node.textContent = value;
  }

  function syncUi(force){
    if(force || uiCache.modeDataset !== state.mode){
      uiCache.modeDataset = state.mode;
      document.body.dataset.mode = state.mode;
    }

    syncUiLabel(pauseBtn, 'pauseLabel', state.mode === 'paused' ? 'Resume' : 'Pause');
    syncUiLabel(startBtn, 'startLabel', state.mode === 'menu' ? 'Start Run' : 'Restart Run');
    syncUiLabel(soundBtn, 'soundLabel', settings.muted ? 'Sound: Off' : 'Sound: On');
    syncUiLabel(touchBtn, 'touchLabel', settings.touchButtons ? 'Controls: On' : 'Controls: Off');
    syncUiLabel(difficultyBtn, 'difficultyLabel', settings.superDifficulty ? 'Difficulty: Super' : 'Difficulty: Normal');
  }

  function update(dt){
    state.dayClock += dt;
    state.weatherClock += dt;
    if(state.warningTimer > 0) state.warningTimer = Math.max(0, state.warningTimer - dt);
    if(state.hitFlash > 0) state.hitFlash = Math.max(0, state.hitFlash - dt);
    if(state.shake > 0) state.shake = Math.max(0, state.shake - dt);
    if(state.recovery > 0) state.recovery = Math.max(0, state.recovery - dt);
    if(state.toast.timer > 0) state.toast.timer = Math.max(0, state.toast.timer - dt);
    if(state.oneUpTimer > 0) state.oneUpTimer = Math.max(0, state.oneUpTimer - dt);
    if(state.shield > 0) state.shield = Math.max(0, state.shield - dt);
    if(state.magnet > 0) state.magnet = Math.max(0, state.magnet - dt);
    if(state.boost > 0) state.boost = Math.max(0, state.boost - dt);
    if(state.jumpBuffer > 0) state.jumpBuffer = Math.max(0, state.jumpBuffer - dt);
    if(!state.grounded) state.groundGrace = Math.max(0, state.groundGrace - dt);

    if(!state.grounded || state.jumpHeight > 0){
      const airborne = !state.grounded || state.jumpHeight > 0;
      state.jumpHeight += state.jumpVelocity * dt;
      state.jumpVelocity -= GRAVITY * dt;
      if(state.jumpHeight <= 0){
        state.jumpHeight = 0;
        state.jumpVelocity = 0;
        state.grounded = true;
        state.groundGrace = GROUND_GRACE_TIME;
        if(airborne){
          state.landImpact = 0.22;
          if(!isAttractMode()) playSound('land');
        }
      }
    }

    if(state.grounded && state.jumpBuffer > 0 && canJumpNow()) performJump();
    if(state.landImpact > 0) state.landImpact = Math.max(0, state.landImpact - dt * 2.3);
    state.runnerAnim += !state.grounded ? dt * 5.2 : dt * 9.4;

    const ramp = clamp(state.distance / 2600, 0, 1);
    state.speedTarget = lerp(getBaseSpeed(), getMaxSpeed(), ramp) + (state.boost > 0 ? getBoostExtraSpeed() : 0);
    state.speed += (state.speedTarget - state.speed) * Math.min(1, dt * 3.8);
    state.laneVisual += (state.lane - state.laneVisual) * (1 - Math.exp(-dt * LANE_SETTLE_SPEED));
    if(Math.abs(state.lane - state.laneVisual) < 0.008) state.laneVisual = state.lane;
    state.previousPosition = state.position;
    state.position += state.speed * dt;
    state.distance = state.position;
    ensureWorldAhead();
    evaluateItems();
    pruneWorld();
    if(state.tutorial.active){
      if(state.tutorial.step === 0 && state.tutorial.lane) setTutorialStep(1);
      if(state.tutorial.step === 1 && state.tutorial.jump) setTutorialStep(2);
      if(state.tutorial.step === 2 && state.tutorial.power){
        state.tutorial.active = false;
        localStorage.setItem(STORAGE_KEYS.tutorialDone, '1');
        toast('Tutorial complete');
        vibrate([12, 18, 12]);
      }
    }
    state.score += dt * (92 + state.speed * 0.75 + (state.boost > 0 ? 28 : 0));

    const currentIndex = Math.floor((state.position + SEGMENT_LENGTH * 3) / SEGMENT_LENGTH) - state.segmentOffset;
    const currentSegment = state.segments[currentIndex] || state.segments[0];
    state.currentTag = currentSegment ? currentSegment.tag : 'Dust Run';
    state.action = state.hitFlash > 0 ? 'Hit' : !state.grounded ? 'Jump' : 'Run';
  }

  function projectPoint(worldX, worldY, relZ, width, out){
    if(relZ <= 0.02) return null;
    const scale = CAMERA_DEPTH / relZ;
    const target = out || {};
    target.x = VIEW_W * 0.5 + worldX * scale * VIEW_W * 0.5;
    target.y = VIEW_H * HORIZON_Y + (CAMERA_HEIGHT - worldY) * scale * VIEW_H * 0.5;
    target.scale = scale;
    target.roadHalf = ROAD_HALF_WIDTH * (width || 1) * scale * VIEW_W * 0.5;
    return target;
  }

  function drawQuad(x1, y1, w1, x2, y2, w2, color){
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x1 - w1, y1);
    ctx.lineTo(x2 - w2, y2);
    ctx.lineTo(x2 + w2, y2);
    ctx.lineTo(x1 + w1, y1);
    ctx.closePath();
    ctx.fill();
  }

  function drawTrapezoid(left1, right1, y1, left2, right2, y2, color){
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(left1, y1);
    ctx.lineTo(left2, y2);
    ctx.lineTo(right2, y2);
    ctx.lineTo(right1, y1);
    ctx.closePath();
    ctx.fill();
  }

  function drawRoadBase(renderSeg){
    const p1 = renderSeg.p1;
    const p2 = renderSeg.p2;
    const colors = renderSeg.segment.colors;
    drawQuad(p1.x, p1.y, p1.roadHalf * 1.12, p2.x, p2.y, p2.roadHalf * 1.12, colors.shoulder);
    drawQuad(p1.x, p1.y, p1.roadHalf, p2.x, p2.y, p2.roadHalf, colors.road);
    drawQuad(p1.x, p1.y, p1.roadHalf * 0.54, p2.x, p2.y, p2.roadHalf * 0.52, colors.wear);
  }

  function drawRoadsideAccent(renderSeg){
    if(renderSeg.plainNear) return;
    const tag = renderSeg.segment.tag;
    const index = renderSeg.segment.index;
    const leftOuter1 = renderSeg.p1.x - renderSeg.p1.roadHalf * 1.08;
    const leftInner1 = renderSeg.p1.x - renderSeg.p1.roadHalf * 1.01;
    const leftOuter2 = renderSeg.p2.x - renderSeg.p2.roadHalf * 1.08;
    const leftInner2 = renderSeg.p2.x - renderSeg.p2.roadHalf * 1.01;
    const rightInner1 = renderSeg.p1.x + renderSeg.p1.roadHalf * 1.01;
    const rightOuter1 = renderSeg.p1.x + renderSeg.p1.roadHalf * 1.08;
    const rightInner2 = renderSeg.p2.x + renderSeg.p2.roadHalf * 1.01;
    const rightOuter2 = renderSeg.p2.x + renderSeg.p2.roadHalf * 1.08;

    if(tag.includes('Checkpoint') && index % 8 === 0){
      drawTrapezoid(leftOuter1, leftInner1, renderSeg.p1.y, leftOuter2, leftInner2, renderSeg.p2.y, 'rgba(115,101,88,0.75)');
      drawTrapezoid(rightInner1, rightOuter1, renderSeg.p1.y, rightInner2, rightOuter2, renderSeg.p2.y, 'rgba(115,101,88,0.75)');
    } else if(tag.includes('Tower') && index % 10 === 0){
      drawTrapezoid(leftOuter1, leftInner1, renderSeg.p1.y, leftOuter2, leftInner2, renderSeg.p2.y, 'rgba(78,68,59,0.72)');
      drawTrapezoid(rightInner1, rightOuter1, renderSeg.p1.y, rightInner2, rightOuter2, renderSeg.p2.y, 'rgba(78,68,59,0.72)');
    } else if(tag.includes('Beacon') && index % 6 === 0){
      drawTrapezoid(leftOuter1, leftInner1, renderSeg.p1.y, leftOuter2, leftInner2, renderSeg.p2.y, 'rgba(0,255,216,0.22)');
      drawTrapezoid(rightInner1, rightOuter1, renderSeg.p1.y, rightInner2, rightOuter2, renderSeg.p2.y, 'rgba(0,255,216,0.22)');
    } else if(tag.includes('Collapse') && index % 7 === 0){
      drawTrapezoid(leftOuter1, leftInner1, renderSeg.p1.y, leftOuter2, leftInner2, renderSeg.p2.y, 'rgba(52,34,24,0.8)');
    } else if(tag.includes('Crater') && index % 5 === 0){
      drawTrapezoid(rightInner1, rightOuter1, renderSeg.p1.y, rightInner2, rightOuter2, renderSeg.p2.y, 'rgba(153,92,56,0.34)');
    }
  }

  function drawRoadSegment(renderSeg){
    drawRoadBase(renderSeg);
    drawRoadsideAccent(renderSeg);
  }

  function drawSky(dt){
    state.skyShift += dt * 0.005;
    const day = getCycleState(DAY_STATES, state.dayClock, 34);
    const weather = getCycleState(WEATHER_STATES, state.weatherClock, 18);
    const dayCurrent = day.current || DAY_STATES[0];
    const dayNext = day.next || dayCurrent;
    const weatherCurrent = weather.current || WEATHER_STATES[0];
    const weatherNext = weather.next || weatherCurrent;
    ctx.fillStyle = getCachedSkyGradient(day);
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    ctx.fillStyle = mixRgba(dayCurrent.glow, dayNext.glow, day.t);
    ctx.beginPath();
    ctx.arc(VIEW_W * 0.5, VIEW_H * 0.16, 170, 0, Math.PI * 2);
    ctx.fill();

    const night = dayCurrent.name === 'Night' || dayNext.name === 'Night';
    if(night){
      ctx.fillStyle = 'rgba(214,226,255,0.76)';
      ctx.beginPath();
      ctx.arc(VIEW_W * 0.74, VIEW_H * 0.14, 28, 0, Math.PI * 2);
      ctx.fill();
      for(let i = 0; i < 14; i++){
        ctx.globalAlpha = 0.35 + Math.sin(state.dayClock * 0.9 + i) * 0.15;
        ctx.fillRect((i * 153 + 60) % VIEW_W, 26 + (i % 7) * 24, 2, 2);
      }
      ctx.globalAlpha = 1;
    }

    const haze = lerp(weatherCurrent.haze, weatherNext.haze, weather.t);
    const dust = lerp(weatherCurrent.dust, weatherNext.dust, weather.t);
    drawSkylineBand(skyline.far, VIEW_H * 0.45, night ? 'rgba(24,25,39,0.62)' : 'rgba(56,43,33,0.46)', state.skyShift * 20, 1, night);
    drawSkylineBand(skyline.mid, VIEW_H * 0.48, night ? 'rgba(26,27,42,0.72)' : 'rgba(48,36,27,0.56)', state.skyShift * 28, 1.06, night);
    drawSkylineBand(skyline.near, VIEW_H * 0.5, night ? 'rgba(28,29,46,0.82)' : 'rgba(42,31,23,0.72)', state.skyShift * 36, 1.14, night);
    drawSetpieceBackdrop(state.currentTag, night);

    ctx.fillStyle = mixRgba('rgba(0,0,0,0)', weatherCurrent.overlay, weather.t);
    ctx.fillRect(0, VIEW_H * 0.4, VIEW_W, VIEW_H * 0.6);

    if(haze > 0.01){
      ctx.fillStyle = 'rgba(223,184,138,' + (0.03 + haze * 0.1).toFixed(3) + ')';
      for(let i = 0; i < 5; i++){
        ctx.beginPath();
        ctx.ellipse(VIEW_W * (i / 4), VIEW_H * 0.54 + i * 18, 260, 34, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    if(dust > 0.01){
      ctx.fillStyle = 'rgba(193,142,94,' + (0.02 + dust * 0.08).toFixed(3) + ')';
      for(let i = 0; i < 6; i++){
        const x = ((state.skyShift * 120) + i * 128) % (VIEW_W + 320) - 160;
        const y = VIEW_H * (0.28 + (i % 6) * 0.06);
        ctx.beginPath();
        ctx.ellipse(x, y, 76 + (i % 3) * 12, 16 + (i % 4) * 4, 0.04, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function drawSkylineBand(items, baseY, color, drift, scale, night){
    ctx.save();
    ctx.fillStyle = color;
    for(let i = 0; i < items.length; i++){
      const item = items[i];
      const x = ((item.x + drift) % (VIEW_W + 260)) - 130;
      const width = item.width * scale;
      const height = item.height * scale;
      const left = x - width / 2;
      const top = baseY - height;
      if(item.type === 'tower'){
        ctx.beginPath();
        ctx.moveTo(left + width * 0.18, baseY);
        ctx.lineTo(left + width * 0.38, top);
        ctx.lineTo(left + width * 0.62, top);
        ctx.lineTo(left + width * 0.82, baseY);
        ctx.closePath();
        ctx.fill();
      } else if(item.type === 'dish'){
        ctx.fillRect(left + width * 0.43, top + height * 0.18, width * 0.14, height * 0.82);
        ctx.beginPath();
        ctx.ellipse(left + width * 0.5, top + height * 0.18, width * 0.24, height * 0.18, -0.26, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.moveTo(left, baseY);
        ctx.lineTo(left + width * 0.16, top + height * 0.28);
        ctx.lineTo(left + width * 0.34, top);
        ctx.lineTo(left + width * 0.56, top + height * 0.34);
        ctx.lineTo(left + width * 0.78, top + height * 0.1);
        ctx.lineTo(left + width, baseY);
        ctx.closePath();
        ctx.fill();
      }
    }
    ctx.restore();
  }

  function drawSetpieceBackdrop(tag, night){
    const silhouette = night ? 'rgba(28,31,48,0.9)' : 'rgba(45,33,25,0.76)';
    const accent = night ? 'rgba(124,218,255,0.2)' : 'rgba(225,164,90,0.16)';
    const baseY = VIEW_H * 0.53;
    ctx.save();
    if(tag.includes('Checkpoint')){
      ctx.fillStyle = silhouette;
      ctx.fillRect(VIEW_W * 0.32, baseY - 54, 26, 54);
      ctx.fillRect(VIEW_W * 0.66, baseY - 54, 26, 54);
      ctx.fillRect(VIEW_W * 0.32, baseY - 62, VIEW_W * 0.36, 18);
      ctx.fillStyle = accent;
      ctx.fillRect(VIEW_W * 0.41, baseY - 56, VIEW_W * 0.18, 6);
    } else if(tag.includes('Tower')){
      ctx.fillStyle = silhouette;
      ctx.beginPath();
      ctx.moveTo(VIEW_W * 0.5 - 14, baseY);
      ctx.lineTo(VIEW_W * 0.5 - 4, baseY - 126);
      ctx.lineTo(VIEW_W * 0.5 + 4, baseY - 126);
      ctx.lineTo(VIEW_W * 0.5 + 14, baseY);
      ctx.closePath();
      ctx.fill();
      ctx.fillRect(VIEW_W * 0.38, baseY - 80, 12, 80);
      ctx.fillRect(VIEW_W * 0.62, baseY - 72, 12, 72);
      ctx.fillStyle = accent;
      ctx.fillRect(VIEW_W * 0.48, baseY - 118, 32, 6);
    } else if(tag.includes('Beacon')){
      ctx.fillStyle = silhouette;
      ctx.fillRect(VIEW_W * 0.4, baseY - 64, 18, 64);
      ctx.fillRect(VIEW_W * 0.5 - 9, baseY - 86, 18, 86);
      ctx.fillRect(VIEW_W * 0.58, baseY - 64, 18, 64);
      ctx.fillStyle = accent;
      ctx.beginPath();
      ctx.arc(VIEW_W * 0.5, baseY - 96, 32, 0, Math.PI * 2);
      ctx.fill();
    } else if(tag.includes('Collapse')){
      ctx.fillStyle = silhouette;
      ctx.beginPath();
      ctx.moveTo(VIEW_W * 0.24, baseY);
      ctx.lineTo(VIEW_W * 0.3, baseY - 40);
      ctx.lineTo(VIEW_W * 0.38, baseY - 22);
      ctx.lineTo(VIEW_W * 0.42, baseY);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(VIEW_W * 0.58, baseY);
      ctx.lineTo(VIEW_W * 0.64, baseY - 48);
      ctx.lineTo(VIEW_W * 0.72, baseY - 28);
      ctx.lineTo(VIEW_W * 0.76, baseY);
      ctx.closePath();
      ctx.fill();
    } else if(tag.includes('Crater')){
      ctx.fillStyle = silhouette;
      ctx.fillRect(VIEW_W * 0.34, baseY - 46, 10, 46);
      ctx.fillRect(VIEW_W * 0.66, baseY - 46, 10, 46);
      ctx.fillStyle = accent;
      ctx.fillRect(VIEW_W * 0.34, baseY - 42, 10, 8);
      ctx.fillRect(VIEW_W * 0.66, baseY - 42, 10, 8);
    }
    ctx.restore();
  }

  function buildVisibleSegments(){
    const absoluteBaseIndex = Math.floor(state.position / SEGMENT_LENGTH);
    const baseIndex = Math.max(0, absoluteBaseIndex - state.segmentOffset);
    const basePercent = (state.position % SEGMENT_LENGTH) / SEGMENT_LENGTH;
    let x = 0;
    let dx = -(state.segments[baseIndex] ? state.segments[baseIndex].curve * basePercent : 0);
    let clipY = viewFrame.bottom;
    const visible = renderFrame.visible;
    const byIndex = renderFrame.byIndex;
    let visibleCount = 0;
    byIndex.clear();

    for(let i = 0; i < DRAW_DISTANCE; i++){
      const segment = state.segments[baseIndex + i];
      if(!segment) break;
      const relZ1 = (segment.z1 - state.position) / SEGMENT_LENGTH;
      const relZ2 = (segment.z2 - state.position) / SEGMENT_LENGTH;
      let renderSeg = visible[visibleCount];
      if(!renderSeg){
        renderSeg = { segment: null, p1: {}, p2: {}, plainNear: false, lowDetailNear: false };
        visible[visibleCount] = renderSeg;
      }
      const p1 = projectPoint(x, segment.y1, relZ1, segment.width, renderSeg.p1);
      x += dx;
      dx += segment.curve;
      const p2 = projectPoint(x, segment.y2, relZ2, segment.width, renderSeg.p2);
      if(!p1 || !p2) continue;
      renderSeg.segment = segment;
      byIndex.set(segment.index, renderSeg);
      if(p2.y >= clipY) continue;
      visibleCount++;
      clipY = p2.y;
    }

    visible.length = visibleCount;
    for(let index = 0; index < visibleCount; index++){
      const renderSeg = visible[index];
      const inBottomBand = renderSeg.p1.y > getBottomDetailCutoffY() || renderSeg.p2.y > getBottomDetailCutoffY();
      renderSeg.plainNear = index < PLAIN_NEAR_SLICE_COUNT;
      renderSeg.lowDetailNear = !renderSeg.plainNear && (index < LOW_DETAIL_NEAR_SLICE_COUNT || inBottomBand);
    }

    return { visible, byIndex };
  }

  function projectTrackPoint(segmentRender, t, laneValue, out){
    const fraction = laneToFraction(laneValue);
    const roadHalf = lerp(segmentRender.p1.roadHalf, segmentRender.p2.roadHalf, t);
    const target = out || {};
    target.x = lerp(segmentRender.p1.x, segmentRender.p2.x, t) + roadHalf * fraction;
    target.y = lerp(segmentRender.p1.y, segmentRender.p2.y, t);
    target.roadHalf = roadHalf;
    target.scale = lerp(segmentRender.p1.scale, segmentRender.p2.scale, t);
    return target;
  }

  function resolveRenderableSegment(segmentIndex, renderMap){
    for(let offset = 0; offset <= 2; offset++){
      const forward = renderMap.get(segmentIndex + offset);
      if(forward) return forward;
      if(offset > 0){
        const backward = renderMap.get(segmentIndex - offset);
        if(backward) return backward;
      }
    }
    return renderMap.values().next().value;
  }

  function getPlayerAnchor(renderMap){
    const anchorZ = state.position + PLAYER_PLANE_Z;
    const segmentIndex = Math.floor(anchorZ / SEGMENT_LENGTH);
    const renderSeg = resolveRenderableSegment(segmentIndex, renderMap);
    if(!renderSeg) return { x: (viewFrame.left + viewFrame.right) * 0.5, y: getPlayerTargetY() };
    const t = clamp((anchorZ - renderSeg.segment.z1) / SEGMENT_LENGTH, 0, 1);
    const point = projectTrackPoint(renderSeg, t, state.laneVisual, renderSeg.anchorPoint || (renderSeg.anchorPoint = {}));
    const centeredLaneX = (viewFrame.left + viewFrame.right) * 0.5 + (state.laneVisual - 1) * Math.min(VIEW_W * 0.17, viewFrame.width * 0.24);
    return {
      x: lerp(point.x, centeredLaneX, 0.94),
      y: getPlayerTargetY()
    };
  }

  function drawBottomFade(){
    ctx.fillStyle = getBottomFadeGradient();
    ctx.fillRect(viewFrame.left - 40, viewFrame.top + viewFrame.height * 0.68, viewFrame.width + 80, viewFrame.height * 0.32);
  }

  function projectItem(item, renderMap, out){
    const distanceToPlayer = item.z - (state.position + PLAYER_PLANE_Z);
    if(distanceToPlayer < -0.05) return null;
    const segmentIndex = Math.floor(item.z / SEGMENT_LENGTH);
    const renderSeg = renderMap.get(segmentIndex) || resolveRenderableSegment(segmentIndex, renderMap);
    if(!renderSeg) return null;
    const t = clamp((item.z - renderSeg.segment.z1) / SEGMENT_LENGTH, 0, 1);
    const point = projectTrackPoint(renderSeg, t, item.lane, out);
    if(point.y < viewFrame.top - 40 || point.y > viewFrame.top + viewFrame.height * 0.66) return null;
    return point;
  }

  function getDepthFactor(point){
    return clamp((point.y - VIEW_H * (HORIZON_Y + 0.02)) / (VIEW_H * 0.72), 0, 1);
  }

  function drawPickupBadge(point, kind){
    const draw = ITEM_DRAW[kind];
    const size = Math.max(26, point.roadHalf * draw.roadFrac * 2);
    const height = size * draw.heightRatio;
    const y = point.y - height * draw.lift;
    const label = getPickupLabel(kind);
    const isScorePickup = kind === 'coin' || kind === 'beacon';
    const isPowerPickup = kind === 'shield' || kind === 'magnet' || kind === 'boost';
    ctx.save();
    ctx.globalAlpha = 0.58 + clamp((point.y - VIEW_H * HORIZON_Y) / (VIEW_H * 0.7), 0, 0.42);
    ctx.fillStyle = draw.glow;
    ctx.beginPath();
    ctx.ellipse(point.x, y + height * 0.24, size * 0.42, height * 0.16, 0, 0, Math.PI * 2);
    ctx.fill();
    const image = images[kind];
    if(imageReady(image)){
      const iconW = size * 0.78;
      const iconH = height * 0.78;
      ctx.drawImage(image, point.x - iconW / 2, y - height * 0.88, iconW, iconH);
    } else {
      ctx.fillStyle = kind === 'coin' ? '#efc57a' : kind === 'beacon' || kind === 'shield' ? '#9ddbb7' : kind === 'magnet' ? '#e1a45a' : '#c898ff';
      ctx.fillRect(point.x - size * 0.16, y - height * 0.72, size * 0.32, height * 0.32);
    }
    if(label){
      const labelY = y + Math.max(16, height * 0.38);
      const fontSize = Math.round(clamp(size * (isPowerPickup ? 0.26 : 0.24), isPowerPickup ? 12 : 11, isPowerPickup ? 20 : 18));
      ctx.font = (isScorePickup ? '800 ' : '900 ') + fontSize + 'px ' + DISPLAY_FONT_STACK;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      if(isPowerPickup){
        const metrics = ctx.measureText(label);
        const badgeWidth = Math.max(fontSize * 3.8, metrics.width + fontSize * 0.9);
        const badgeHeight = Math.max(18, fontSize * 1.24);
        const badgeX = point.x - badgeWidth * 0.5;
        const badgeY = labelY - badgeHeight * 0.5;
        const fill =
          kind === 'shield' ? 'rgba(157,219,183,0.22)' :
          kind === 'magnet' ? 'rgba(225,164,90,0.22)' :
          'rgba(200,152,255,0.22)';
        const stroke =
          kind === 'shield' ? 'rgba(157,219,183,0.72)' :
          kind === 'magnet' ? 'rgba(225,164,90,0.72)' :
          'rgba(200,152,255,0.7)';
        ctx.fillStyle = fill;
        ctx.fillRect(badgeX, badgeY, badgeWidth, badgeHeight);
        ctx.strokeStyle = stroke;
        ctx.lineWidth = Math.max(2, fontSize * 0.14);
        ctx.strokeRect(badgeX, badgeY, badgeWidth, badgeHeight);
      }
      ctx.lineWidth = Math.max(3, fontSize * 0.32);
      ctx.strokeStyle = 'rgba(7,14,18,0.8)';
      ctx.fillStyle = kind === 'coin' ? '#f7dc8f' : kind === 'beacon' ? '#b7f6d6' : 'rgba(232,247,255,0.94)';
      ctx.strokeText(label, point.x, labelY);
      ctx.fillText(label, point.x, labelY);
    }
    ctx.restore();
  }

  function drawObstacle(point, item){
    const depth = getDepthFactor(point);
    const laneWidth = (point.roadHalf * 2) / 3;
    const width = Math.min(laneWidth * 0.78, Math.max(lerp(20, 52, depth), laneWidth * 0.56));
    const image = images[item && item.variant ? item.variant : 'wall1'];
    ctx.save();
    if(imageReady(image)){
      const aspect = image.width / image.height;
      const height = width / aspect;
      ctx.drawImage(image, point.x - width * 0.5, point.y - height, width, height);
      ctx.restore();
      return;
    }
    const height = width * 1.02;
    ctx.fillStyle = '#7f786f';
    ctx.fillRect(point.x - width * 0.34, point.y - height, width * 0.68, height);
    ctx.restore();
  }

  function drawPit(point, item){
    const depth = getDepthFactor(point);
    const width = Math.max(lerp(22, 64, depth), point.roadHalf * ITEM_DRAW.pit.roadFrac * 2);
    const height = Math.max(lerp(10, 30, depth), width * ITEM_DRAW.pit.heightRatio);
    const image = images[item && item.variant ? item.variant : 'pit1'];
    ctx.save();
    if(imageReady(image)){
      ctx.drawImage(image, point.x - width * 0.5, point.y - height * 0.5, width, height);
    } else {
      ctx.fillStyle = 'rgba(17,12,9,0.95)';
      ctx.beginPath();
      ctx.ellipse(point.x, point.y, width * 0.46, height * 0.28, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,145,98,0.92)';
      ctx.lineWidth = Math.max(3, width * 0.04);
      ctx.beginPath();
      ctx.ellipse(point.x, point.y, width * 0.46, height * 0.28, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawItems(renderMap){
    const sprites = renderFrame.sprites;
    let spriteCount = 0;
    for(const item of state.items){
      if(item.resolved) continue;
      if(item.z < state.position - SEGMENT_LENGTH * 2) continue;
      if(item.z > state.position + SEGMENT_LENGTH * (DRAW_DISTANCE - 8)) continue;
      let sprite = sprites[spriteCount];
      if(!sprite){
        sprite = { depth: 0, item: null, point: {} };
        sprites[spriteCount] = sprite;
      }
      const point = projectItem(item, renderMap, sprite.point);
      if(!point) continue;
      sprite.depth = point.y;
      sprite.item = item;
      spriteCount++;
    }
    sprites.length = spriteCount;
    sprites.sort((a, b) => a.depth - b.depth);
    for(let i = 0; i < spriteCount; i++){
      const sprite = sprites[i];
      const item = sprite.item;
      const point = sprite.point;
      if(item.kind === 'coin' || item.kind === 'beacon' || item.kind === 'shield' || item.kind === 'magnet' || item.kind === 'boost') drawPickupBadge(point, item.kind);
      else if(item.kind === 'obstacle') drawObstacle(point, item);
      else if(item.kind === 'pit') drawPit(point, item);
    }
  }

  function drawPlayer(anchor, frameNow){
    const playerX = anchor.x;
    const bodyY = anchor.y - state.jumpHeight * 190;
    const bob = Math.sin(frameNow * 0.008) * 4;
    const lean = (state.lane - state.laneVisual) * 0.16;
    const squashX = 1 + state.landImpact * 0.18;
    const squashY = 1 - state.landImpact * 0.12;

    ctx.save();
    ctx.translate(playerX, bodyY + 6);
    ctx.rotate(lean);
    ctx.scale(squashX, squashY);
    ctx.translate(-playerX, -(bodyY + 6));

    if(state.shield > 0){
      ctx.globalAlpha = 0.18 + Math.sin(frameNow * 0.012) * 0.06;
      ctx.fillStyle = 'rgba(157,219,183,0.72)';
      ctx.beginPath();
      ctx.arc(playerX, bodyY - 38, 72, 0, Math.PI * 2);
      ctx.fill();
    }

    if(state.magnet > 0){
      ctx.globalAlpha = 0.34;
      ctx.strokeStyle = 'rgba(225,164,90,0.78)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(playerX, bodyY - 42, 58, -0.9, 0.9);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(playerX, bodyY - 42, 58, Math.PI - 0.9, Math.PI + 0.9);
      ctx.stroke();
    }

    if(state.boost > 0){
      ctx.globalAlpha = 0.22 + Math.sin(frameNow * 0.018) * 0.06;
      ctx.strokeStyle = 'rgba(225,164,90,0.92)';
      ctx.lineCap = 'round';
      for(let i = 0; i < 3; i++){
        ctx.lineWidth = 8 - i * 2;
        ctx.beginPath();
        ctx.moveTo(playerX - 34, bodyY - 22 + i * 14);
        ctx.lineTo(playerX - 96 - i * 18, bodyY - 10 + i * 12);
        ctx.stroke();
      }
    }

    ctx.globalAlpha = 1;

    const sheet = images.sheet;
    if(imageReady(sheet)){
      const frame = state.hitFlash > 0 ? 2 : !state.grounded ? 1 : Math.floor(state.runnerAnim) % 4;
      const sx = frame * 96;
      const drawW = 126;
      const drawH = 168;
      ctx.drawImage(sheet, sx, 0, 96, 128, playerX - drawW / 2, bodyY - drawH + bob, drawW, drawH);
    }

    ctx.restore();
  }

  function drawLivesHud(originX, originY, width, compact){
    const panelHeight = compact ? 20 : 23;
    const panelY = originY;
    const lifeX = originX;
    const lifeSize = compact ? 13 : 15;
    const valueX = originX + (compact ? 20 : 23);
    const centerY = panelY + panelHeight * 0.5;
    const lifeY = centerY - lifeSize * 0.5;
    const life = images.life;

    ctx.fillStyle = 'rgba(0,255,216,0.06)';
    ctx.fillRect(originX - 6, panelY, width + 12, panelHeight);
    ctx.strokeStyle = 'rgba(0,255,216,0.2)';
    ctx.strokeRect(originX - 6, panelY, width + 12, panelHeight);
    if(imageReady(life)){
      ctx.drawImage(life, lifeX, lifeY, lifeSize, lifeSize);
    } else {
      ctx.fillStyle = 'rgba(0,255,216,0.9)';
      ctx.beginPath();
      ctx.moveTo(lifeX + lifeSize * 0.5, lifeY);
      ctx.lineTo(lifeX + lifeSize, lifeY + lifeSize * 0.38);
      ctx.lineTo(lifeX + lifeSize * 0.8, lifeY + lifeSize);
      ctx.lineTo(lifeX + lifeSize * 0.2, lifeY + lifeSize);
      ctx.lineTo(lifeX, lifeY + lifeSize * 0.38);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(232,247,255,0.96)';
    ctx.font = (compact ? '800 11px' : '800 12px') + ' ' + DISPLAY_FONT_STACK;
    ctx.textBaseline = 'middle';
    ctx.fillText(formatHudCounter(state.lives), valueX, centerY + 0.5);
    ctx.textBaseline = 'alphabetic';
  }

  function drawCoinHud(originX, originY, width, compact){
    const progress = state.run.coins % COINS_PER_EXTRA_LIFE;
    const panelHeight = compact ? 20 : 23;
    const panelY = originY;
    const coinChipX = originX;
    const coinChipSize = compact ? 13 : 15;
    const valueX = originX + (compact ? 20 : 23);
    const centerY = panelY + panelHeight * 0.5;
    const coinChipY = centerY - coinChipSize * 0.5;
    const coin = images.coin;

    ctx.fillStyle = 'rgba(255,184,77,0.13)';
    ctx.fillRect(originX - 6, panelY, width + 12, panelHeight);
    ctx.strokeStyle = 'rgba(255,184,77,0.3)';
    ctx.strokeRect(originX - 6, panelY, width + 12, panelHeight);

    if(imageReady(coin)){
      ctx.drawImage(coin, coinChipX, coinChipY, coinChipSize, coinChipSize);
    } else {
      ctx.fillStyle = 'rgba(225,164,90,0.92)';
      ctx.beginPath();
      ctx.arc(coinChipX + coinChipSize * 0.5, coinChipY + coinChipSize * 0.5, compact ? 7 : 8, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = 'rgba(255,199,112,0.98)';
    ctx.font = (compact ? '800 11px' : '800 12px') + ' ' + DISPLAY_FONT_STACK;
    ctx.textBaseline = 'middle';
    ctx.fillText(formatHudCounter(progress), valueX, centerY + 0.5);
    ctx.textBaseline = 'alphabetic';
  }

  function formatHudNumber(value){
    return Math.floor(value).toLocaleString('en-US');
  }

  function formatHudCounter(value){
    return String(Math.max(0, Math.floor(value))).padStart(2, '0');
  }

  function drawHudStatTile(originX, originY, width, height, label, value, palette, compact){
    const valueText = String(value);
    let valueSize = compact ? 12 : 14;
    if(valueText.length >= 6) valueSize -= 1;
    if(valueText.length >= 8) valueSize -= 1;

    ctx.fillStyle = palette.fill;
    ctx.fillRect(originX, originY, width, height);
    ctx.strokeStyle = palette.stroke;
    ctx.strokeRect(originX, originY, width, height);
    ctx.fillStyle = palette.label;
    ctx.font = (compact ? '700 7px' : '700 8px') + ' ' + DISPLAY_FONT_STACK;
    ctx.fillText(label, originX + 6, originY + (compact ? 9 : 10));
    ctx.textAlign = 'right';
    ctx.fillStyle = palette.value;
    ctx.font = '800 ' + valueSize + 'px ' + DISPLAY_FONT_STACK;
    ctx.fillText(valueText, originX + width - 6, originY + (compact ? 20 : 23));
    ctx.textAlign = 'left';
  }

  function drawCanvasHud(){
    if(state.mode === 'menu') return;
    ctx.save();
    const compact = isCompactViewport();
    const left = viewFrame.left + 14;
    const right = viewFrame.right - 18;
    const top = viewFrame.top + 14;
    const compactWidth = compact ? 176 : 214;
    const compactHeight = compact ? 76 : 88;
    const tileGap = compact ? 4 : 6;
    const tileHeight = compact ? 22 : 26;
    const tileWidth = Math.floor((compactWidth - 18 - tileGap) / 2);
    ctx.fillStyle = 'rgba(8,17,24,0.58)';
    ctx.fillRect(left, top, compactWidth, compactHeight);
    ctx.strokeStyle = 'rgba(0,255,216,0.2)';
    ctx.strokeRect(left, top, compactWidth, compactHeight);
    drawHudStatTile(left + 9, top + 8, tileWidth, tileHeight, 'SCORE', formatHudNumber(state.score), {
      fill: 'rgba(255,255,255,0.04)',
      stroke: 'rgba(255,255,255,0.08)',
      label: 'rgba(232,247,255,0.58)',
      value: 'rgba(255,220,166,0.98)'
    }, compact);
    drawHudStatTile(left + 9 + tileWidth + tileGap, top + 8, tileWidth, tileHeight, 'BEST', formatHudNumber(state.best), {
      fill: 'rgba(0,255,216,0.05)',
      stroke: 'rgba(0,255,216,0.12)',
      label: 'rgba(190,252,244,0.62)',
      value: 'rgba(232,247,255,0.96)'
    }, compact);
    drawCoinHud(left + 9, top + (compact ? 36 : 42), compactWidth - 18, compact);
    drawLivesHud(left + 9, top + (compact ? 58 : 65), compactWidth - 18, compact);

    const chips = [];
    if(state.shield > 0) chips.push({ label: 'Shield', value: state.shield / SHIELD_DURATION, color: 'rgba(157,219,183,0.9)' });
    if(state.magnet > 0) chips.push({ label: 'Magnet', value: state.magnet / MAGNET_DURATION, color: 'rgba(225,164,90,0.9)' });
    if(state.boost > 0) chips.push({ label: 'Boost', value: state.boost / BOOST_DURATION, color: 'rgba(200,152,255,0.88)' });

    if(compact){
      const chipWidth = 92;
      for(let index = 0; index < chips.length; index++){
        const chip = chips[index];
        const x = right - chipWidth;
        const y = top + index * 26;
        ctx.fillStyle = 'rgba(8,17,24,0.56)';
        ctx.fillRect(x, y, chipWidth, 22);
        ctx.strokeStyle = 'rgba(0,255,216,0.16)';
        ctx.strokeRect(x, y, chipWidth, 22);
        ctx.fillStyle = chip.color;
        ctx.fillRect(x, y + 18, chipWidth * clamp(chip.value, 0, 1), 3);
        ctx.fillStyle = 'rgba(232,247,255,0.9)';
        ctx.fillText(chip.label, x + 8, y + 14);
      }
    } else {
      let chipRight = right;
      chips.forEach((chip) => {
        const width = 126;
        const x = chipRight - width;
        const y = top + 4;
        ctx.fillStyle = 'rgba(8,17,24,0.56)';
        ctx.fillRect(x, y, width, 28);
        ctx.strokeStyle = 'rgba(0,255,216,0.16)';
        ctx.strokeRect(x, y, width, 28);
        ctx.fillStyle = chip.color;
        ctx.fillRect(x, y + 22, width * clamp(chip.value, 0, 1), 4);
        ctx.fillStyle = 'rgba(232,247,255,0.9)';
        ctx.fillText(chip.label, x + 10, y + 17);
        chipRight = x - 10;
      });
    }

    if(state.toast.timer > 0 && state.toast.text){
      ctx.globalAlpha = clamp(state.toast.timer / 1.4, 0, 1);
      const toastWidth = Math.min(300, viewFrame.width - 28);
      const toastX = (viewFrame.left + viewFrame.right - toastWidth) * 0.5;
      ctx.fillStyle = 'rgba(8,17,24,0.74)';
      ctx.fillRect(toastX, top + compactHeight + 10, toastWidth, 34);
      ctx.strokeStyle = 'rgba(0,255,216,0.18)';
      ctx.strokeRect(toastX, top + compactHeight + 10, toastWidth, 34);
      ctx.fillStyle = 'rgba(232,247,255,0.92)';
      ctx.textAlign = 'center';
      ctx.fillText(state.toast.text, (viewFrame.left + viewFrame.right) * 0.5, top + compactHeight + 32);
      ctx.textAlign = 'left';
    }
    ctx.restore();
  }

  function drawTutorialOverlay(){
    if(state.mode !== 'playing' || !state.tutorial.active) return;
    const meta = getTutorialStepMeta();
    if(!meta) return;
    ctx.save();
    const width = Math.min(468, viewFrame.width - 24);
    const height = isCompactViewport() ? 116 : 108;
    const x = (viewFrame.left + viewFrame.right - width) * 0.5;
    const y = Math.max(viewFrame.top + 84, viewFrame.bottom - height - 104);
    ctx.fillStyle = 'rgba(8,17,24,0.78)';
    ctx.fillRect(x, y, width, height);
    ctx.strokeStyle = 'rgba(0,255,216,0.24)';
    ctx.strokeRect(x, y, width, height);
    ctx.fillStyle = 'rgba(0,255,216,0.08)';
    ctx.fillRect(x + 1, y + 1, width - 2, 26);
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(0,255,216,0.82)';
    ctx.font = '700 12px ' + DISPLAY_FONT_STACK;
    ctx.fillText(meta.title + ' of 3', (viewFrame.left + viewFrame.right) * 0.5, y + 18);
    ctx.fillStyle = 'rgba(232,247,255,0.92)';
    ctx.font = '800 24px ' + DISPLAY_FONT_STACK;
    ctx.fillText(meta.heading, (viewFrame.left + viewFrame.right) * 0.5, y + 50);
    ctx.fillStyle = 'rgba(232,247,255,0.74)';
    ctx.font = '600 14px ' + BODY_FONT_STACK;
    ctx.fillText(meta.tip, (viewFrame.left + viewFrame.right) * 0.5, y + 72);
    const barX = x + 28;
    const barY = y + 86;
    const barWidth = width - 56;
    const segmentGap = 10;
    const segmentWidth = (barWidth - segmentGap * 2) / 3;
    for(let i = 0; i < 3; i++){
      ctx.fillStyle = i < state.tutorial.step ? 'rgba(255,184,77,0.9)' : i === state.tutorial.step ? 'rgba(0,255,216,0.9)' : 'rgba(255,255,255,0.08)';
      ctx.fillRect(barX + i * (segmentWidth + segmentGap), barY, segmentWidth, 6);
    }
    const badges = meta.controls;
    const badgeGap = 8;
    const badgeWidth = Math.min(72, (width - 56 - badgeGap * (badges.length - 1)) / badges.length);
    badges.forEach((label, index) => {
      const badgeX = x + 28 + index * (badgeWidth + badgeGap);
      const badgeY = y + 92;
      ctx.fillStyle = 'rgba(0,255,216,0.08)';
      ctx.fillRect(badgeX, badgeY, badgeWidth, 24);
      ctx.strokeStyle = 'rgba(0,255,216,0.22)';
      ctx.strokeRect(badgeX, badgeY, badgeWidth, 24);
      ctx.fillStyle = 'rgba(232,247,255,0.92)';
      ctx.font = '700 12px ' + DISPLAY_FONT_STACK;
      ctx.fillText(label, badgeX + badgeWidth * 0.5, badgeY + 16);
    });
    ctx.textAlign = 'left';
    ctx.restore();
  }

  function drawOneUpOverlay(){
    if(state.mode !== 'playing' || state.oneUpTimer <= 0) return;
    const progress = 1 - clamp(state.oneUpTimer / ONE_UP_DURATION, 0, 1);
    const alpha = clamp(state.oneUpTimer / ONE_UP_DURATION, 0, 1);
    const centerX = (viewFrame.left + viewFrame.right) * 0.5;
    const iconSize = isCompactViewport() ? 42 : 50;
    const textSize = isCompactViewport() ? 28 : 34;
    const totalHeight = iconSize + textSize + 16;
    const topY = viewFrame.top + 54 - progress * 10;
    const text = '1UP';

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.textAlign = 'center';
    const panelWidth = isCompactViewport() ? 102 : 116;
    ctx.fillStyle = 'rgba(8,17,24,0.72)';
    ctx.fillRect(centerX - panelWidth * 0.5, topY - 10, panelWidth, totalHeight);
    ctx.strokeStyle = 'rgba(255,184,77,0.36)';
    ctx.strokeRect(centerX - panelWidth * 0.5, topY - 10, panelWidth, totalHeight);

    const life = images.life;
    if(imageReady(life)){
      ctx.drawImage(life, centerX - iconSize * 0.5, topY, iconSize, iconSize);
    } else {
      ctx.fillStyle = 'rgba(255,184,77,0.96)';
      ctx.beginPath();
      ctx.moveTo(centerX, topY);
      ctx.lineTo(centerX + iconSize * 0.5, topY + iconSize * 0.38);
      ctx.lineTo(centerX + iconSize * 0.4, topY + iconSize);
      ctx.lineTo(centerX - iconSize * 0.4, topY + iconSize);
      ctx.lineTo(centerX - iconSize * 0.5, topY + iconSize * 0.38);
      ctx.closePath();
      ctx.fill();
    }

    ctx.fillStyle = 'rgba(255,220,166,0.98)';
    ctx.font = '900 ' + textSize + 'px ' + DISPLAY_FONT_STACK;
    ctx.fillText(text, centerX, topY + iconSize + textSize - 2);
    ctx.restore();
  }

  function drawWarningOverlay(){
    if(state.mode === 'menu') return;
    if(state.hitFlash <= 0 && state.warningTimer <= 0) return;
    const alpha = Math.min(1, state.hitFlash / HIT_FLASH_DURATION);
    const linger = Math.min(1, state.warningTimer / 0.95);
    const width = Math.min(460, viewFrame.width - 28);
    const x = (viewFrame.left + viewFrame.right - width) * 0.5;
    const y = viewFrame.top + 48;
    ctx.save();
    ctx.globalAlpha = alpha * 0.28;
    ctx.fillStyle = '#ff7c5a';
    ctx.fillRect(viewFrame.left, viewFrame.top, viewFrame.width, viewFrame.height);
    ctx.globalAlpha = Math.max(alpha, linger * 0.92);
    ctx.fillStyle = 'rgba(8,17,24,0.82)';
    ctx.fillRect(x, y, width, 96);
    ctx.strokeStyle = 'rgba(0,255,216,0.24)';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, width, 96);
    ctx.fillStyle = 'rgba(232,247,255,0.95)';
    ctx.font = '800 30px ' + DISPLAY_FONT_STACK;
    ctx.textAlign = 'center';
    ctx.fillText(state.warning || 'Watch the timing', (viewFrame.left + viewFrame.right) * 0.5, y + 44);
    ctx.font = '600 14px ' + BODY_FONT_STACK;
    ctx.fillText('Up jumps. Left and right switch lanes.', (viewFrame.left + viewFrame.right) * 0.5, y + 72);
    ctx.restore();
  }

  function drawStateOverlay(frameNow){
    if(state.mode === 'playing') return;
    const centerX = (viewFrame.left + viewFrame.right) * 0.5;
    const centerY = viewFrame.top + viewFrame.height * 0.46;
    const gameOverFade = state.mode === 'gameover'
      ? clamp(state.gameOverHold / GAMEOVER_FADE_DURATION, 0, 1)
      : 1;
    ctx.save();
    ctx.globalAlpha = state.mode === 'gameover' ? gameOverFade : 1;
    ctx.fillStyle = 'rgba(4,9,12,0.46)';
    ctx.fillRect(viewFrame.left, viewFrame.top, viewFrame.width, viewFrame.height);
    if(state.mode === 'menu'){
      const pulse = 0.5 + Math.sin(frameNow * 0.0044) * 0.5;
      const enterBlink = (Math.floor(frameNow / 520) % 2) === 0 ? 1 : 0.28;
      const logo = images.logo;
      if(imageReady(logo)){
        const logoW = Math.min(360, viewFrame.width * 0.52) * (1 + pulse * 0.018);
        const logoH = logoW * (logo.height / Math.max(1, logo.width));
        const logoY = centerY - logoH - 26;
        ctx.save();
        ctx.globalAlpha = 0.96;
        ctx.shadowColor = 'rgba(0,255,216,' + (0.18 + pulse * 0.16).toFixed(3) + ')';
        ctx.shadowBlur = 16 + pulse * 16;
        ctx.drawImage(logo, centerX - logoW * 0.5, logoY, logoW, logoH);
        ctx.restore();
      }
      ctx.textAlign = 'center';
      ctx.globalAlpha = enterBlink;
      ctx.fillStyle = 'rgba(232,247,255,0.96)';
      ctx.font = '800 42px ' + DISPLAY_FONT_STACK;
      ctx.fillText('PRESS ENTER', centerX, centerY + 16);
      ctx.restore();
      return;
    }
    if(state.mode === 'gameover'){
      const image = images.gameover;
      if(imageReady(image)){
        const imageW = Math.min(260, viewFrame.width * 0.42);
        const imageH = imageW * (image.height / Math.max(1, image.width));
        const imageY = centerY - imageH - 34;
        ctx.globalAlpha = 0.86;
        ctx.drawImage(image, centerX - imageW * 0.5, imageY, imageW, imageH);
        ctx.globalAlpha = 1;
      }
    }
    ctx.fillStyle = 'rgba(232,247,255,0.96)';
    ctx.textAlign = 'center';
    ctx.font = '800 42px ' + DISPLAY_FONT_STACK;
    const title = state.mode === 'paused' ? 'PAUSED' : state.mode === 'gameover' ? 'GAME OVER' : 'PRESS ENTER';
    ctx.fillText(title, centerX, centerY);
    ctx.restore();
  }

  function render(frameNow, dt){
    drawSky(dt);
    const shakeAmount = state.shake > 0 ? state.shake * 22 : 0;
    const shakeX = shakeAmount ? (Math.random() - 0.5) * shakeAmount : 0;
    const shakeY = shakeAmount ? (Math.random() - 0.5) * shakeAmount * 0.42 : 0;
    ctx.save();
    ctx.translate(shakeX, shakeY);

    const road = buildVisibleSegments();
    for(let i = road.visible.length - 1; i >= 0; i--) drawRoadSegment(road.visible[i]);
    drawBottomFade();
    drawItems(road.byIndex);
    const playerAnchor = getPlayerAnchor(road.byIndex);
    const smoothFactor = Math.min(1, dt * PLAYER_ANCHOR_SMOOTH);
    state.playerScreenX = lerp(state.playerScreenX, playerAnchor.x, smoothFactor);
    state.playerScreenY = lerp(state.playerScreenY, playerAnchor.y, smoothFactor);
    drawPlayer({ x: state.playerScreenX, y: state.playerScreenY }, frameNow);
    drawCanvasHud();
    drawOneUpOverlay();
    drawTutorialOverlay();
    drawWarningOverlay();
    drawStateOverlay(frameNow);
    ctx.restore();
  }

  function tick(now){
    const dt = Math.min(0.033, (now - lastTime) / 1000);
    lastTime = now;
    if(state.mode === 'playing') update(dt);
    else if(state.mode === 'menu') updateAttract(dt);
    else if(state.mode === 'gameover' && state.gameOverHold > 0){
      state.gameOverHold = Math.max(0, state.gameOverHold - dt);
      if(state.gameOverHold === 0 && !scoreEntryState.visible) openScoreModal();
    }
    render(now, dt);
    requestAnimationFrame(tick);
  }

  function refreshScoreModalIfVisible(){
    if(scoreEntryState.visible) updateScoreEntryUi();
  }

  let touchGesture = null;

  function getTrackedTouch(touchList){
    if(!touchGesture || !touchList) return null;
    for(let i = 0; i < touchList.length; i++){
      if(touchList[i].identifier === touchGesture.id) return touchList[i];
    }
    return null;
  }

  function clearTouchGesture(){
    touchGesture = null;
  }

  function finishTouchGesture(touch){
    if(!touchGesture || !touch) return;
    const dx = touch.clientX - touchGesture.x;
    const dy = touch.clientY - touchGesture.y;
    const adx = Math.abs(dx);
    const ady = Math.abs(dy);
    clearTouchGesture();

    if(Math.max(adx, ady) < 26){
      if(state.mode === 'gameover' && state.gameOverHold > 0) return;
      if(state.mode === 'menu' || state.mode === 'gameover'){
        startRun();
        return;
      }
      if(state.mode === 'playing'){
        jump();
      }
      return;
    }

    if(adx > ady){
      onLane(dx < 0 ? -1 : 1);
      return;
    }

    if(dy < 0){
      jump();
    }
  }

  window.addEventListener('keydown', (event) => {
    const key = event.key.toLowerCase();
    const typingInName = document.activeElement === scoreNameInput;
    const isRunnerControl = event.key === 'ArrowLeft' || event.key === 'ArrowRight' || event.key === 'ArrowUp' || key === 'a' || key === 'd' || key === 'w' || event.code === 'Space';

    if(event.key === 'Enter'){
      event.preventDefault();
      if(state.mode === 'gameover' && state.gameOverHold > 0) return;
      if(scoreEntryState.visible){
        if(scoreEntryState.qualifies && !scoreEntryState.saved) saveScoreEntry();
        else {
          hideScoreModal();
          startRun();
        }
        return;
      }
      startRun();
      return;
    }

    if(typingInName) return;
    if(event.repeat && isRunnerControl) return;

    if(event.key === 'ArrowLeft' || key === 'a'){ event.preventDefault(); onLane(-1); }
    if(event.key === 'ArrowRight' || key === 'd'){ event.preventDefault(); onLane(1); }
    if(event.key === 'ArrowUp' || key === 'w'){ event.preventDefault(); jump(); }
    if(event.code === 'Space' || event.key === 'Escape'){
      event.preventDefault();
      if(state.mode === 'playing' || state.mode === 'paused') togglePause();
    }
  });

  canvas.addEventListener('touchstart', (event) => {
    primeAudio();
    const touch = event.changedTouches[0];
    if(!touch) return;
    touchGesture = {
      id: touch.identifier,
      x: touch.clientX,
      y: touch.clientY,
      time: performance.now()
    };
  }, { passive: true });

  window.addEventListener('touchmove', (event) => {
    if(!touchGesture) return;
    const touch = getTrackedTouch(event.changedTouches) || getTrackedTouch(event.touches);
    if(!touch) return;
    if(state.mode === 'playing') event.preventDefault();
  }, { passive: false });

  window.addEventListener('touchend', (event) => {
    const touch = getTrackedTouch(event.changedTouches);
    if(!touch) return;
    finishTouchGesture(touch);
  }, { passive: true });

  window.addEventListener('touchcancel', (event) => {
    const touch = getTrackedTouch(event.changedTouches);
    if(!touch) return;
    clearTouchGesture();
  }, { passive: true });

  window.addEventListener('resize', fitCanvas);
  if(window.visualViewport){
    window.visualViewport.addEventListener('resize', fitCanvas);
    window.visualViewport.addEventListener('scroll', fitCanvas);
  }

  document.querySelectorAll('.touch-btn').forEach((button) => {
    const triggerButtonAction = () => {
      primeAudio();
      const action = button.getAttribute('data-action');
      if(action === 'left') onLane(-1);
      if(action === 'right') onLane(1);
      if(action === 'jump') jump();
    };
    button.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      triggerButtonAction();
    });
    if(!window.PointerEvent){
      button.addEventListener('click', (event) => {
        event.preventDefault();
        triggerButtonAction();
      });
    }
  });

  if(startBtn) startBtn.addEventListener('click', startRun);
  if(pauseBtn) pauseBtn.addEventListener('click', () => { if(state.mode === 'playing' || state.mode === 'paused') togglePause(); });
  if(tutorialBtn) tutorialBtn.addEventListener('click', startTutorialRun);
  if(soundBtn){
    soundBtn.addEventListener('click', () => {
      settings.muted = !settings.muted;
      saveSettings();
      syncUi(true);
      if(!settings.muted){
        primeAudio();
        playSound('coin');
      }
      toast(settings.muted ? 'Sound off' : 'Sound on');
    });
  }
  if(touchBtn){
    touchBtn.addEventListener('click', () => {
      settings.touchButtons = !settings.touchButtons;
      saveSettings();
      applyTouchButtons();
      syncUi(true);
      toast(settings.touchButtons ? 'Touch controls on' : 'Touch controls off');
    });
  }
  if(difficultyBtn){
    difficultyBtn.addEventListener('click', () => {
      settings.superDifficulty = !settings.superDifficulty;
      saveSettings();
      syncUi(true);
      if(state.mode === 'playing' || state.mode === 'paused'){
        toast(settings.superDifficulty ? 'Super difficulty set for the next run' : 'Normal difficulty set for the next run');
      } else {
        toast(settings.superDifficulty ? 'Super difficulty on' : 'Normal difficulty on');
      }
    });
  }

  if(scoreNameInput){
    scoreNameInput.addEventListener('input', () => {
      const cleanName = sanitizeArcadeName(scoreNameInput.value);
      scoreNameInput.value = cleanName;
      state.scorecard.name = cleanName;
      updateScoreEntryUi();
    });
  }

  if(saveScoreBtn) saveScoreBtn.addEventListener('click', saveScoreEntry);
  if(retryBtn) retryBtn.addEventListener('click', () => { hideScoreModal(); startRun(); });

  if(scoresApi){
    window.addEventListener('storage', (event) => {
      if(event.key === scoresApi.STORAGE_KEY) refreshScoreModalIfVisible();
    });
    window.setInterval(refreshScoreModalIfVisible, 5000);
  }

  startAttractMode();
  fitCanvas();
  applyTouchButtons();
  syncUi(true);
  requestAnimationFrame(tick);
})();


