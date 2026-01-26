(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');

  const W = 480, H = 800;
  const LANES = [120, 240, 360];

  const storedTouchButtons = localStorage.getItem('beacon_runner_touch_buttons');
  const settings = {
    muted: localStorage.getItem('beacon_runner_mute') === '1',
    haptics: localStorage.getItem('beacon_runner_haptics') !== '0',
    fpsLimit: Number(localStorage.getItem('beacon_runner_fps') || '60'),
    reducedMotion: window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    touchButtons: storedTouchButtons === null ? false : storedTouchButtons !== '0'
  };

  if(window.matchMedia){
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    if(media && typeof media.addEventListener === 'function'){
      media.addEventListener('change', (e)=>{ settings.reducedMotion = e.matches; });
    } else if(media && typeof media.addListener === 'function'){
      media.addListener((e)=>{ settings.reducedMotion = e.matches; });
    }
  }

  const totals = {
    coins: Number(localStorage.getItem('beacon_runner_total_coins') || '0'),
    beacons: Number(localStorage.getItem('beacon_runner_total_beacons') || '0'),
    jumps: Number(localStorage.getItem('beacon_runner_total_jumps') || '0'),
    runs: Number(localStorage.getItem('beacon_runner_total_runs') || '0')
  };

  const unlocked = new Set(JSON.parse(localStorage.getItem('beacon_runner_achievements') || '[]'));

  // HiDPI
  function fitDPI() {
    const parent = canvas.parentElement;
    const maxW = parent ? parent.clientWidth : window.innerWidth;
    const maxH = parent ? parent.clientHeight : window.innerHeight;
    const aspect = W / H;
    let cssW = Math.min(maxW, maxH * aspect);
    let cssH = cssW / aspect;
    if(!cssW || !cssH){
      cssW = W;
      cssH = H;
    }
    canvas.style.width = cssW + 'px';
    canvas.style.height = cssH + 'px';
    const dpr = window.devicePixelRatio || 1;
    const baseScale = Math.min(cssW / W, cssH / H);
    const scale = Math.min(1.5, dpr) * baseScale;
    canvas.width = Math.max(1, Math.floor(W * scale));
    canvas.height = Math.max(1, Math.floor(H * scale));
    ctx.setTransform(scale,0,0,scale,0,0);
  }
  window.addEventListener('resize', fitDPI);
  fitDPI();

  const state = {
    mode: 'loading', // loading | menu | playing | paused | gameover
    t: 0,
    score: 0,
    best: Number(localStorage.getItem('beacon_runner_best')||0),
    speed: 520,            // px/sec scrolling
    spawnTimer: 0,
    spawnInterval: 0.95,
    powerTimer: 0,
    beaconTimer: 0,
    coinTrailTimer: 0,
    difficultyTimer: 0,
    shield: 0,
    magnet: 0,
    boost: 0,
    loadingProgress: 0,
    toast: { text: '', t: 0 },
    tutorial: {
      active: localStorage.getItem('beacon_runner_tutorial_done') !== '1',
      step: 0,
      jump: false,
      slide: false,
      power: false
    },
    run: {
      coins: 0,
      beacons: 0,
      jumps: 0,
      slides: 0,
      passed: 0,
      powerups: 0
    },
    quests: []
  };

  const loading = { total: 0, loaded: 0, failed: 0 };

  const ASSETS = {
    bg: loadImg('assets/background.png'),
    logo: loadImg('assets/beaconrun.png'),
    logoHud: loadImg('assets/beaconrun_hud.png'),
    gameOver: loadImg('assets/gameover.png'),
    sheet: loadImg('assets/character_sheet.png'),
    high: loadImg('assets/obstacle_high.png'),
    high1: loadImg('assets/obstacle_high_1.png'),
    high2: loadImg('assets/obstacle_high_2.png'),
    high3: loadImg('assets/obstacle_high_3.png'),
    low: loadImg('assets/obstacle_low.png'),
    low1: loadImg('assets/obstacle_low_1.png'),
    low2: loadImg('assets/obstacle_low_2.png'),
    low3: loadImg('assets/obstacle_low_3.png'),
    // Power-ups (preferred: one image per power-up)
    shield: loadImg('assets/shield.png'),
    magnet: loadImg('assets/magnet.png'),
    boost: loadImg('assets/boost.png'),
    coin: loadImg('assets/coin.png'),
    beacon: loadImg('assets/beacon.png'),
    // Back-compat fallback (optional)
    power: loadImg('assets/powerup.png'),
    drone: loadImg('assets/drone.png')
  };

  function loadImg(src){
    loading.total++;
    const i = new Image();
    i.onload = () => {
      loading.loaded++;
      state.loadingProgress = loading.total ? (loading.loaded / loading.total) : 1;
    };
    i.onerror = () => {
      loading.loaded++;
      loading.failed++;
      state.loadingProgress = loading.total ? (loading.loaded / loading.total) : 1;
    };
    i.src = src;
    return i;
  }

  const rng = (a,b)=> a + Math.random()*(b-a);
  const clamp=(v,a,b)=> Math.max(a, Math.min(b,v));

  // Grain disabled for smoother motion

  function saveSettings(){
    localStorage.setItem('beacon_runner_mute', settings.muted ? '1' : '0');
    localStorage.setItem('beacon_runner_haptics', settings.haptics ? '1' : '0');
    localStorage.setItem('beacon_runner_fps', String(settings.fpsLimit));
    localStorage.setItem('beacon_runner_touch_buttons', settings.touchButtons ? '1' : '0');
  }

  function saveTotals(){
    localStorage.setItem('beacon_runner_total_coins', String(totals.coins));
    localStorage.setItem('beacon_runner_total_beacons', String(totals.beacons));
    localStorage.setItem('beacon_runner_total_jumps', String(totals.jumps));
    localStorage.setItem('beacon_runner_total_runs', String(totals.runs));
  }

  function saveAchievements(){
    localStorage.setItem('beacon_runner_achievements', JSON.stringify([...unlocked]));
  }

  function toast(text){
    state.toast.text = text;
    state.toast.t = 2.6;
  }

  function unlockAchievement(id, label){
    if(unlocked.has(id)) return;
    unlocked.add(id);
    saveAchievements();
    toast('Achievement: ' + label);
  }

  const audio = { ctx: null };

  function ensureAudio(){
    if(audio.ctx) return audio.ctx;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if(!Ctx) return null;
    audio.ctx = new Ctx();
    return audio.ctx;
  }

  function playSound(type){
    if(settings.muted) return;
    const ctx = ensureAudio();
    if(!ctx) return;
    if(ctx.state === 'suspended') ctx.resume();

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    let freq = 520, dur = 0.12, wave = 'triangle', peak = 0.12;

    if(type==='jump'){ freq = 700; dur = 0.1; wave = 'sine'; peak = 0.08; }
    if(type==='pickup'){ freq = 880; dur = 0.14; wave = 'triangle'; peak = 0.1; }
    if(type==='hit'){ freq = 220; dur = 0.2; wave = 'square'; peak = 0.14; }
    if(type==='gameover'){ freq = 140; dur = 0.3; wave = 'sawtooth'; peak = 0.16; }

    osc.type = wave;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(peak, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + dur + 0.05);
  }

  function vibrate(pattern){
    if(!settings.haptics) return;
    if(navigator.vibrate) navigator.vibrate(pattern);
  }

  // Background scroll
  const bg = { y: 0 };

  // Player
  const player = {
    lane: 1,
    x: LANES[1],
    y: 640,
    w: 72,
    h: 110,
    vy: 0,
    grounded: true,
    slide: 0,
    invuln: 0,
    anim: 0,
    frame: 0
  };

  // Entities
  const obstacles = [];
  const powerups = [];
  const particles = [];

  // Input
  const input = { left:false, right:false, up:false, down:false, pause:false };

  document.addEventListener('keydown', e => {
    ensureAudio();
    if(e.key==='ArrowLeft') onLane(-1);
    if(e.key==='ArrowRight') onLane(+1);
    if(e.key==='ArrowUp') jump();
    if(e.key==='ArrowDown') startSlide();
    if(e.code==='Space') togglePause();
    if(e.key==='Enter') onEnter();
  });

  // Touch (swipes)
  let touchStart=null;
  canvas.addEventListener('touchstart', (e)=>{
    ensureAudio();
    const t=e.changedTouches[0];
    touchStart={x:t.clientX,y:t.clientY,time:performance.now()};
  }, {passive:true});
  canvas.addEventListener('touchmove', (e)=>{
    if(state.mode==='playing') e.preventDefault();
  }, {passive:false});
  canvas.addEventListener('touchend', (e)=>{
    if(!touchStart) return;
    const t=e.changedTouches[0];
    const dx=t.clientX-touchStart.x;
    const dy=t.clientY-touchStart.y;
    const adx=Math.abs(dx), ady=Math.abs(dy);
    if(Math.max(adx,ady) < 30) { // tap
      if(state.mode==='menu' || state.mode==='gameover') startGame();
      else if(state.mode==='playing') jump();
      return;
    }
    if(adx>ady){ onLane(dx<0?-1:+1); }
    else { if(dy<0) jump(); else startSlide(); }
  }, {passive:true});

  const touchButtons = document.querySelectorAll('.touch-btn');
  touchButtons.forEach(btn => {
    btn.addEventListener('pointerdown', (e)=>{
      e.preventDefault();
      ensureAudio();
      const action = btn.dataset.action;
      if(action==='left') onLane(-1);
      if(action==='right') onLane(+1);
      if(action==='jump') jump();
      if(action==='slide') startSlide();
    });
  });

  const muteBtn = document.getElementById('muteBtn');
  const hapticsBtn = document.getElementById('hapticsBtn');
  const fpsBtn = document.getElementById('fpsBtn');
  const touchBtn = document.getElementById('touchBtn');

  function applyTouchButtons(){
    document.body.classList.toggle('show-touch', settings.touchButtons);
    document.body.classList.toggle('hide-touch', !settings.touchButtons);
  }

  function updateToggleLabels(){
    if(muteBtn) muteBtn.textContent = settings.muted ? 'Sound: Off' : 'Sound: On';
    if(hapticsBtn) hapticsBtn.textContent = settings.haptics ? 'Haptics: On' : 'Haptics: Off';
    if(fpsBtn) fpsBtn.textContent = settings.fpsLimit ? ('FPS: ' + settings.fpsLimit) : 'FPS: Unlimited';
    if(touchBtn) touchBtn.textContent = settings.touchButtons ? 'Buttons: On' : 'Buttons: Off';
  }

  if(muteBtn){
    muteBtn.addEventListener('click', ()=>{
      settings.muted = !settings.muted;
      saveSettings();
      updateToggleLabels();
      if(!settings.muted) ensureAudio();
    });
  }

  if(hapticsBtn){
    hapticsBtn.addEventListener('click', ()=>{
      settings.haptics = !settings.haptics;
      saveSettings();
      updateToggleLabels();
      if(settings.haptics) vibrate(10);
    });
  }

  if(fpsBtn){
    fpsBtn.addEventListener('click', ()=>{
      if(settings.fpsLimit === 60) settings.fpsLimit = 30;
      else if(settings.fpsLimit === 30) settings.fpsLimit = 0;
      else settings.fpsLimit = 60;
      saveSettings();
      updateToggleLabels();
    });
  }

  if(touchBtn){
    touchBtn.addEventListener('click', ()=>{
      settings.touchButtons = !settings.touchButtons;
      saveSettings();
      applyTouchButtons();
      updateToggleLabels();
    });
  }

  applyTouchButtons();
  updateToggleLabels();

  function onEnter(){
    if(state.mode==='menu' || state.mode==='gameover') startGame();
  }

  function togglePause(){
    if(state.mode==='playing') state.mode='paused';
    else if(state.mode==='paused') state.mode='playing';
  }

  function onLane(dir){
    if(state.mode!=='playing') return;
    player.lane = clamp(player.lane + dir, 0, 2);
  }

  function jump(){
    if(state.mode!=='playing') return;
    if(player.grounded){
      player.vy = -760;
      player.grounded = false;
      state.run.jumps++;
      totals.jumps++;
      saveTotals();
      playSound('jump');
      vibrate(12);
      if(state.tutorial.active) state.tutorial.jump = true;
      burst(player.x, player.y+40, '#00ffd8');
    }
  }

  function startSlide(){
    if(state.mode!=='playing') return;
    if(player.grounded){
      player.slide = 0.55; // seconds
      state.run.slides++;
      playSound('jump');
      vibrate(10);
      if(state.tutorial.active) state.tutorial.slide = true;
      burst(player.x, player.y+52, '#ffb84d');
    }
  }

  function startGame(){
    state.mode='playing';
    state.t=0;
    state.score=0;
    state.speed=520;
    state.spawnInterval=0.95;
    state.spawnTimer=0;
    state.powerTimer=0;
    state.beaconTimer=0;
    state.coinTrailTimer=0;
    state.difficultyTimer=0;
    state.shield=0;
    state.magnet=0;
    state.boost=0;

    totals.runs++;
    saveTotals();
    unlockAchievement('first_run', 'First Run');

    state.run = { coins:0, beacons:0, jumps:0, slides:0, passed:0, powerups:0 };
    state.quests = pickQuests();
    if(state.tutorial.active){
      state.tutorial.step = 0;
      state.tutorial.jump = false;
      state.tutorial.slide = false;
      state.tutorial.power = false;
    }

    obstacles.length=0;
    powerups.length=0;
    particles.length=0;

    player.lane=1;
    player.x=LANES[1];
    player.y=640;
    player.vy=0;
    player.grounded=true;
    player.slide=0;
    player.invuln=0;
    player.anim=0;
    player.frame=0;
  }

  function gameOver(){
    state.mode='gameover';
    state.best = Math.max(state.best, Math.floor(state.score));
    localStorage.setItem('beacon_runner_best', String(state.best));
    playSound('gameover');
    vibrate([40,30,40]);
    if(state.score >= 2000) unlockAchievement('score_2000', 'Score 2000');
  }

  const questTemplates = [
    { id: 'q_score', label: 'Score {target}', target: 800, get: () => Math.floor(state.score) },
    { id: 'q_coins', label: 'Collect {target} coins', target: 6, get: () => state.run.coins },
    { id: 'q_jumps', label: 'Jump {target} times', target: 6, get: () => state.run.jumps },
    { id: 'q_beacons', label: 'Grab {target} beacon', target: 1, get: () => state.run.beacons },
    { id: 'q_pass', label: 'Pass {target} obstacles', target: 8, get: () => state.run.passed }
  ];

  function pickQuests(){
    const pool = questTemplates.slice();
    const selected = [];
    while(selected.length < 3 && pool.length){
      const idx = (Math.random()*pool.length)|0;
      const base = pool.splice(idx,1)[0];
      const target = base.target + ((Math.random()*3)|0) * (base.id==='q_score' ? 200 : 2);
      selected.push({ id: base.id, label: base.label.replace('{target}', target), target, get: base.get, done: false });
    }
    return selected;
  }

  // Particles
  function burst(x,y,color){
    for(let i=0;i<14;i++){
      particles.push({x,y, vx:rng(-180,180), vy:rng(-240,40), life:rng(0.25,0.5), color});
    }
  }

  // Spawning
  function laneClearForObstacle(lane, minGap){
    // Find the most recently spawned obstacle in this lane
    for(let i=obstacles.length-1;i>=0;i--){
      const o = obstacles[i];
      if(o.lane===lane){
        return (o.y < -minGap);
      }
    }
    return true;
  }

  function spawnObstacle(){
    const type = 'high';
    const w = 84;
    const h = 108;
    const drawW = w;
    const drawH = h;
    const variant = ((Math.random()*3)|0);
    const minGap = 220;

    // Try to find a lane that isn't already occupied too close
    let lane = (Math.random()*3)|0;
    let tries = 0;
    while(tries < 3 && !laneClearForObstacle(lane, minGap)){
      lane = (Math.random()*3)|0;
      tries++;
    }
    if(!laneClearForObstacle(lane, minGap)) return;
    obstacles.push({
      lane,
      x: LANES[lane],
      y: -140,
      type,
      w,
      h,
      drawW,
      drawH,
      variant,
      passed:false
    });
  }

  function spawnPower(){
    const lane = (Math.random()*3)|0;
    const roll = Math.random();
    let kind = 'shield';
    let value = 0;
    if(roll < 0.30) kind = 'shield';
    else if(roll < 0.60) kind = 'magnet';
    else if(roll < 0.80) kind = 'boost';
    else kind = 'shield';
    powerups.push({ lane, x:LANES[lane], y:-120, kind, value, w:70, h:70, spin:rng(0,Math.PI*2)});
  }

  function spawnBeacon(){
    const lane = (Math.random()*3)|0;
    powerups.push({ lane, x:LANES[lane], y:-120, kind:'beacon', value: 500, w:70, h:70, spin:rng(0,Math.PI*2)});
  }

  function spawnCoinTrail(){
    const length = (Math.random()*3|0) + 5; // 5-7 coins
    const spacing = 90;
    let lane = (Math.random()*3)|0;
    const zigzag = Math.random() < 0.55;
    for(let i=0;i<length;i++){
      powerups.push({
        lane,
        x: LANES[lane],
        y: -140 - i*spacing,
        kind: 'coin',
        value: 100,
        w: 70,
        h: 70,
        spin: rng(0,Math.PI*2)
      });
      if(zigzag && Math.random()<0.8){
        lane = clamp(lane + (Math.random()<0.5?-1:1), 0, 2);
      }
    }
  }

  // Collision helpers
  function aabb(ax,ay,aw,ah, bx,by,bw,bh){
    return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
  }

  function playerBox(){
    const w = player.w;
    const h = player.h;
    const x = player.x - w/2;
    const y = player.y - h/2;
    return {x,y,w,h};
  }

  // Main loop timing
  let last = performance.now();
  let lastFrame = last;

  // Start screen once images are ready enough
  Promise.all(Object.values(ASSETS).map(img => new Promise(res => {
    if(img.complete) return res();
    img.onload = () => res();
    img.onerror = () => res();
  }))).then(()=> state.mode='menu');

  function tick(now){
    if(settings.fpsLimit > 0){
      const minFrame = 1000 / settings.fpsLimit;
      if(now - lastFrame < minFrame){
        requestAnimationFrame(tick);
        return;
      }
      lastFrame = now;
    }

    const dt = Math.min(0.05, (now-last)/1000);
    last = now;

    if(state.mode==='playing') update(dt);
    render(dt);

    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  function update(dt){
    state.t += dt;
    const ramp = clamp(state.t / 85, 0, 1);
    state.speed = 520 + 460 * ramp;
    state.spawnInterval = 0.95 - 0.40 * ramp;
    const effSpeed = state.speed * (state.boost>0 ? 1.35 : 1);
    state.score += dt * (10 + effSpeed/110);

    // Timed toast
    if(state.toast.t > 0) state.toast.t -= dt;

    // Background scroll (match world speed for consistent motion)
    const dy = (effSpeed * dt);
    const bgImg = ASSETS.bg;
    const bgHeight = (bgImg && bgImg.complete && bgImg.height) ? bgImg.height : H;
    bg.y -= dy;
    if(bg.y >= bgHeight) bg.y -= bgHeight;

    // Player lane easing
    const targetX = LANES[player.lane];
    player.x += (targetX - player.x) * (1 - Math.pow(0.001, dt));

    // Jump physics
    if(!player.grounded){
      player.vy += 1550 * dt;
      player.y += player.vy * dt;
      if(player.y >= 640){
        player.y = 640;
        player.vy = 0;
        player.grounded = true;
      }
    }

    // Slide
    if(player.slide>0){
      player.slide -= dt;
      if(player.slide<0) player.slide=0;
    }

    // Timers
    if(player.invuln>0) player.invuln -= dt;
    if(state.shield>0) state.shield -= dt;
    if(state.magnet>0) state.magnet -= dt;
    if(state.boost>0) state.boost -= dt;

    // Spawn obstacles
    state.spawnTimer += dt;
    if(state.spawnTimer >= state.spawnInterval){
      state.spawnTimer = 0;
      // slightly reduce unfair spawns: avoid 3 in a row same lane sometimes
      spawnObstacle();
      const extraChance = 0.15 + 0.20 * ramp;
      if(Math.random()<extraChance) spawnObstacle();
    }

    // Spawn power-ups
    state.powerTimer += dt;
    if(state.powerTimer >= 4.8){
      state.powerTimer = 0;
      if(Math.random()<0.92) spawnPower();
    }

    // Spawn beacon occasionally (like prior single-coin spawns)
    state.beaconTimer += dt;
    if(state.beaconTimer >= 7.5){
      state.beaconTimer = 0;
      if(Math.random() < 0.35) spawnBeacon();
    }

    // Spawn coin trails occasionally
    state.coinTrailTimer += dt;
    if(state.coinTrailTimer >= 7.5){
      state.coinTrailTimer = 0;
      if(Math.random() < 0.65) spawnCoinTrail();
    }

    // Move obstacles
    for(const o of obstacles){
      o.y += dy;
      // score for passing
      if(!o.passed && o.y > player.y){
        o.passed=true;
        state.score += 12;
        state.run.passed++;
      }
    }

    // Move powerups
    for(const p of powerups){
      p.y += dy;
      p.spin += dt*3;
      if(state.magnet>0){
        // gentle pull toward player when nearby
        const dx = player.x - p.x;
        const dy2 = player.y - p.y;
        const dist = Math.hypot(dx,dy2);
        if(dist < 220){
          p.x += dx * dt * 2.2;
          p.y += dy2 * dt * 2.2;
        }
      }
    }

    // Particles
    for(const pt of particles){
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.vy += 900 * dt;
      pt.life -= dt;
    }

    // Collisions
    const pb = playerBox();

    // Obstacles collision with avoidance rules
    for(const o of obstacles){
      // State-based avoidance: slide clears LOW, jump clears HIGH
      if(o.type==='low' && player.slide>0) continue;
      if(o.type==='high' && !player.grounded) continue;

      // Use smaller per-type hitboxes for fair avoidance:
      // - HIGH: collide near the bottom (jump over)
      // - LOW: collide near the top (slide under)
      const ow = o.w * 0.86;
      const ox = o.x - ow/2;
      const top = o.y - o.h/2;
      const bottom = o.y + o.h/2;

      const oh = o.type==='high' ? 62 : 52;
      const oy = o.type==='high' ? (bottom - oh) : top;

      if(aabb(pb.x,pb.y,pb.w,pb.h, ox,oy,ow,oh)){
        // If shield active, consume and destroy obstacle
        if(state.shield>0){
          state.shield = Math.max(0, state.shield - 1.2);
          burst(o.x,o.y,'#00ffd8');
          playSound('hit');
          vibrate(18);
          o.y = H+300;
          continue;
        }
        // extra grace window
        if(player.invuln<=0){
          burst(player.x, player.y, '#ff3b6b');
          playSound('hit');
          gameOver();
          return;
        }
      }

      // Type rule: LOW is avoidable by sliding; HIGH is avoidable by jumping.
      // The AABB already accounts for slide; for jump, player box moves up.
    }

    // Power-up collisions
    for(const p of powerups){
      const px=p.x-p.w/2, py=p.y-p.h/2;
      if(aabb(pb.x,pb.y,pb.w,pb.h, px,py,p.w,p.h)){
        if(p.kind==='shield'){
          state.shield = 6.0;
          state.score += 35;
        }
        if(p.kind==='magnet'){
          state.magnet = 6.0;
          state.score += 35;
        }
        if(p.kind==='boost'){
          state.boost = 4.5;
          state.score += 35;
        }
        if(p.kind==='coin'){
          state.score += (p.value || 100);
          state.run.coins++;
          totals.coins++;
          saveTotals();
          if(totals.coins >= 50) unlockAchievement('coins_50', 'Coin Collector');
        }
        if(p.kind==='beacon'){
          state.score += (p.value || 200);
          state.run.beacons++;
          totals.beacons++;
          saveTotals();
          if(totals.beacons >= 10) unlockAchievement('beacon_10', 'Beacon Hunter');
        }
        state.run.powerups++;
        playSound('pickup');
        vibrate(12);
        if(state.tutorial.active) state.tutorial.power = true;
        burst(
          p.x,
          p.y,
          p.kind==='shield' ? '#00ffd8' :
          p.kind==='magnet' ? '#ffb84d' :
          p.kind==='boost' ? '#7b5cff' :
          p.kind==='beacon' ? '#7afcff' :
          '#ffd84d'
        );
        p.y = H+300;
      }
    }

    if(totals.jumps >= 50) unlockAchievement('jumps_50', 'Air Time');

    // Tutorial progression
    if(state.tutorial.active){
      if(state.tutorial.step===0 && state.tutorial.jump) state.tutorial.step=1;
      if(state.tutorial.step===1 && state.tutorial.slide) state.tutorial.step=2;
      if(state.tutorial.step===2 && state.tutorial.power){
        state.tutorial.active = false;
        localStorage.setItem('beacon_runner_tutorial_done', '1');
      }
    }

    // Quests progress
    for(const q of state.quests){
      if(!q.done && q.get() >= q.target){
        q.done = true;
        toast('Quest complete: ' + q.label);
      }
    }

    // Cleanup
    while(obstacles.length && obstacles[0].y > H+260) obstacles.shift();
    for(let i=powerups.length-1;i>=0;i--) if(powerups[i].y > H+260) powerups.splice(i,1);
    for(let i=particles.length-1;i>=0;i--) if(particles[i].life<=0) particles.splice(i,1);
  }

  function render(dt){
    // Background
    drawBG();

    // Entities
    drawObstacles();
    drawPowerups();
    drawPlayer(dt);
    if(state.mode!=='gameover') drawParticles();

    // HUD + states
    drawHUD();
  }

  function drawBG(){
    const img = ASSETS.bg;
    if(img && img.complete){
      const srcW = img.width || W;
      const srcH = img.height || H;
      let sy = bg.y % srcH;
      if(sy < 0) sy += srcH;

      const firstH = Math.min(srcH - sy, H);
      ctx.drawImage(img, 0, sy, srcW, firstH, 0, 0, W, firstH);

      const remaining = H - firstH;
      if(remaining > 0){
        ctx.drawImage(img, 0, 0, srcW, remaining, 0, firstH, W, remaining);
      }
    } else {
      ctx.fillStyle='#0b1014';
      ctx.fillRect(0,0,W,H);
    }
  }

  function drawPlayer(dt){
    // Animation frames
    player.anim += dt * (state.mode==='playing' ? 11 : 3);
    player.frame = (player.anim|0) % 4;

    const sheet = ASSETS.sheet;
    const sliding = player.slide>0;
    const sx = sliding ? 4*96 : player.frame*96; // 5th column is slide pose
    const sy = 0;
    const sw = 96, sh = 128;

    const drawW = 96;
    const drawH = 128;

    ctx.save();
    // invulnerability flicker when shield hits (reserved)
    if(player.invuln>0) ctx.globalAlpha = 0.7 + 0.3*Math.sin(state.t*40);

    // glow aura if shield
    if(state.shield>0){
      ctx.globalAlpha=0.45;
      ctx.beginPath();
      ctx.arc(player.x, player.y-10, 64, 0, Math.PI*2);
      ctx.fillStyle='rgba(0,255,216,0.25)';
      ctx.fill();
      ctx.globalAlpha=1;
    }

    if(sheet && sheet.complete){
      ctx.drawImage(sheet, sx, sy, sw, sh, player.x-drawW/2, player.y-drawH/2, drawW, drawH);
    } else {
      ctx.fillStyle='#14a0a6';
      ctx.fillRect(player.x-36, player.y-55, 72, 110);
    }

    // small drones orbit effect when magnet active
    if(state.magnet>0){
      const drone = ASSETS.drone;
      const r = 62;
      for(let i=0;i<2;i++){
        const ang = state.t*3 + i*Math.PI;
        const dx = Math.cos(ang)*r;
        const dy = Math.sin(ang)*22;
        ctx.globalAlpha=0.85;
        if(drone && drone.complete){
          ctx.drawImage(drone, player.x+dx-18, player.y-50+dy-18, 36, 36);
        } else {
          ctx.fillStyle='#fff';
          ctx.beginPath(); ctx.arc(player.x+dx, player.y-50+dy, 8,0,Math.PI*2); ctx.fill();
        }
      }
      ctx.globalAlpha=1;
    }

    ctx.restore();
  }

  function drawObstacles(){
    for(const o of obstacles){
      const img = o.type==='high'
        ? (o.variant===0 ? ASSETS.high1 : o.variant===1 ? ASSETS.high2 : ASSETS.high3) || ASSETS.high
        : (o.variant===0 ? ASSETS.low1 : o.variant===1 ? ASSETS.low2 : ASSETS.low3) || ASSETS.low;
      let w=o.drawW || o.w, h=o.drawH || o.h;
      if(o.type==='high' && img && img.complete){
        w = img.width;
        h = img.height;
      }

      const x = o.x - w/2;
      const y = o.y - h/2;

      // neon shadow
      ctx.save();
      ctx.globalAlpha=0.25;
      ctx.fillStyle='rgba(0,255,216,0.35)';
      ctx.beginPath();
      ctx.ellipse(o.x, o.y+h/2+10, w*0.55, 10, 0, 0, Math.PI*2);
      ctx.fill();
      ctx.restore();

      if(img && img.complete){
        ctx.drawImage(img, x, y, w, h);
      } else {
        ctx.fillStyle='#634d36';
        ctx.fillRect(x, y, w, h);
      }
    }
  }

  function drawPowerups(){
    for(const p of powerups){
      const img =
        p.kind==='shield' ? ASSETS.shield :
        p.kind==='magnet' ? ASSETS.magnet :
        p.kind==='boost' ? ASSETS.boost :
        p.kind==='coin' ? ASSETS.coin :
        p.kind==='beacon' ? ASSETS.beacon :
        ASSETS.power;
      const w=p.w,h=p.h;
      ctx.save();
      // glow
      ctx.globalAlpha=0.35;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 42, 0, Math.PI*2);
      ctx.fillStyle =
        p.kind==='shield' ? 'rgba(0,255,216,0.28)' :
        p.kind==='magnet' ? 'rgba(255,184,77,0.25)' :
        p.kind==='boost' ? 'rgba(123,92,255,0.24)' :
        p.kind==='beacon' ? 'rgba(122,252,255,0.24)' :
        'rgba(255,215,64,0.25)';
      ctx.fill();
      ctx.globalAlpha=1;

      // spin
      ctx.translate(p.x,p.y);
      ctx.rotate(Math.sin(p.spin)*0.25);
      if(img && img.complete){
        ctx.drawImage(img, -w/2, -h/2, w, h);
      } else if(p.kind==='coin'){
        // fallback coin look if image missing
        const g = ctx.createRadialGradient(-8,-10,6, 0,0,34);
        g.addColorStop(0, 'rgba(255,245,190,0.95)');
        g.addColorStop(0.45, 'rgba(255,215,64,0.95)');
        g.addColorStop(1, 'rgba(160,110,20,0.95)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(0,0,30,0,Math.PI*2); ctx.fill();
        ctx.lineWidth = 4;
        ctx.strokeStyle = 'rgba(255,255,255,0.25)';
        ctx.beginPath(); ctx.arc(0,0,24,0,Math.PI*2); ctx.stroke();
      } else {
        ctx.strokeStyle='#00ffd8'; ctx.lineWidth=3;
        ctx.beginPath(); ctx.arc(0,0,28,0,Math.PI*2); ctx.stroke();
      }

      // icon label
      ctx.font = p.kind==='coin' ? '800 14px system-ui' : '12px system-ui';
      ctx.textAlign='center';
      ctx.fillStyle='rgba(232,247,255,.85)';
      if(p.kind==='coin') ctx.fillText('+' + (p.value || 100), 0, 44);
      else if(p.kind==='beacon') ctx.fillText('BEACON', 0, 44);
      else if(p.kind==='boost') ctx.fillText('BOOST', 0, 44);
      else ctx.fillText(p.kind.toUpperCase(), 0, 44);
      ctx.restore();
    }
  }

  function drawParticles(){
    ctx.save();
    for(const pt of particles){
      ctx.globalAlpha = clamp(pt.life*2, 0, 1);
      ctx.fillStyle = pt.color;
      ctx.fillRect(pt.x-2, pt.y-2, 4, 4);
    }
    ctx.restore();
  }

  function drawHUD(){
    // top bar
    ctx.save();
    ctx.fillStyle='rgba(0,0,0,0.35)';
    ctx.fillRect(0,0,W,96);

    // Title
    const hudLogo = ASSETS.logoHud;
    if(hudLogo && hudLogo.complete){
      const logoW = 150;
      const logoH = Math.max(1, Math.round(logoW * (hudLogo.height / hudLogo.width)));
      ctx.drawImage(hudLogo, 16, 6, logoW, logoH);
    } else {
      ctx.fillStyle='rgba(0,255,216,0.9)';
      ctx.font='700 18px system-ui';
      ctx.fillText('BEACON RUNNER', 18, 28);
    }

    // Score
    ctx.fillStyle='rgba(232,247,255,0.92)';
    ctx.font='700 20px system-ui';
    ctx.fillText('Score: ' + Math.floor(state.score), 18, 55);

    // Best
    ctx.fillStyle='rgba(232,247,255,0.75)';
    ctx.font='600 14px system-ui';
    ctx.fillText('Best: ' + state.best, 200, 55);

    // Power indicators
    const bar = (x,y,label,t,maxT,clr)=>{
      ctx.fillStyle='rgba(232,247,255,0.55)';
      ctx.font='700 12px system-ui';
      ctx.fillText(label, x, y);
      ctx.fillStyle='rgba(255,255,255,0.15)';
      ctx.fillRect(x+54, y-10, 110, 10);
      ctx.fillStyle=clr;
      ctx.fillRect(x+54, y-10, 110*clamp(t/maxT,0,1), 10);
    };
    bar(290, 28, 'SHIELD', state.shield, 6, 'rgba(0,255,216,0.75)');
    bar(290, 52, 'MAGNET', state.magnet, 6, 'rgba(255,184,77,0.75)');
    bar(290, 76, 'BOOST', state.boost, 4.5, 'rgba(123,92,255,0.75)');

    ctx.restore();

    // Quests
    if(state.mode==='playing' && state.quests.length){
      ctx.save();
      ctx.fillStyle='rgba(232,247,255,0.75)';
      ctx.font='600 12px system-ui';
      ctx.textAlign='right';
      let qy = 116;
      ctx.fillText('Quests', W-16, qy);
      qy += 16;
      for(const q of state.quests){
        const value = Math.min(q.target, q.get());
        const line = (q.done ? '✓ ' : '') + q.label + ' (' + value + '/' + q.target + ')';
        ctx.fillStyle = q.done ? 'rgba(0,255,216,0.85)' : 'rgba(232,247,255,0.65)';
        ctx.fillText(line, W-16, qy);
        qy += 16;
      }
      ctx.restore();
    }

    // Tutorial overlay
    if(state.mode==='playing' && state.tutorial.active){
      ctx.save();
      ctx.fillStyle='rgba(0,0,0,0.45)';
      ctx.fillRect(20, H-140, W-40, 92);
      ctx.strokeStyle='rgba(0,255,216,0.35)';
      ctx.strokeRect(20, H-140, W-40, 92);
      ctx.fillStyle='rgba(232,247,255,0.92)';
      ctx.font='700 14px system-ui';
      let tip = 'Swipe up or press ↑ to jump.';
      if(state.tutorial.step===1) tip = 'Swipe down or press ↓ to slide.';
      if(state.tutorial.step===2) tip = 'Grab any power-up.';
      ctx.textAlign='center';
      ctx.fillText('Tutorial', W/2, H-110);
      ctx.font='500 13px system-ui';
      ctx.fillText(tip, W/2, H-88);
      ctx.restore();
    }

    // Toasts
    if(state.toast.t > 0){
      ctx.save();
      ctx.globalAlpha = clamp(state.toast.t / 2.6, 0, 1);
      ctx.fillStyle='rgba(0,0,0,0.6)';
      ctx.fillRect(W/2-160, 108, 320, 36);
      ctx.strokeStyle='rgba(0,255,216,0.4)';
      ctx.strokeRect(W/2-160, 108, 320, 36);
      ctx.fillStyle='rgba(232,247,255,0.95)';
      ctx.font='600 13px system-ui';
      ctx.textAlign='center';
      ctx.fillText(state.toast.text, W/2, 131);
      ctx.restore();
    }

    // overlays
    if(state.mode==='menu') {
      overlay('BEACON RUNNER', 'Press Enter or tap to start', 'Avoid high barriers by jumping and low barriers by sliding.');
    }
    if(state.mode==='paused') {
      overlay('PAUSED', 'Press Space to resume', '');
    }
    if(state.mode==='gameover') {
      overlay('GAME OVER', 'Press Enter or tap to retry', 'Final score: ' + Math.floor(state.score));
    }
    if(state.mode==='loading') {
      const pct = Math.round((state.loadingProgress || 0) * 100);
      overlay('LOADING', 'Preparing assets… ' + pct + '%', '');
    }
  }

  function overlay(title, subtitle, foot){
    ctx.save();
    ctx.fillStyle='rgba(0,0,0,0.55)';
    ctx.fillRect(0,0,W,H);

    // card
    const cw=380, ch=300;
    const cx=(W-cw)/2, cy=(H-ch)/2;
    roundRect(ctx, cx, cy, cw, ch, 18);
    ctx.fillStyle='rgba(10,18,22,0.9)';
    ctx.fill();
    ctx.strokeStyle='rgba(0,255,216,0.45)';
    ctx.lineWidth=2;
    ctx.stroke();

    ctx.textAlign='center';

    // Game over badge image above title (keeps text below)
    let titleY = cy + 84;
    if(state.mode==='gameover'){
      const go = ASSETS.gameOver;
      if(go && go.complete){
        const maxW = 220;
        const maxH = 80;
        const aspect = go.width / go.height;
        let goW = maxW;
        let goH = Math.max(1, Math.round(goW / aspect));
        if(goH > maxH){
          goH = maxH;
          goW = Math.max(1, Math.round(goH * aspect));
        }
        const goX = W/2 - goW/2;
        const goY = cy + 22;
        ctx.drawImage(go, goX, goY, goW, goH);
        titleY = goY + goH + 38;
      }
    }

    const logo = ASSETS.logo;
    if(state.mode==='menu' && logo && logo.complete){
      const maxW = 260;
      const maxH = 90;
      const aspect = logo.width / logo.height;
      let logoW = maxW;
      let logoH = Math.max(1, Math.round(logoW / aspect));
      if(logoH > maxH){
        logoH = maxH;
        logoW = Math.max(1, Math.round(logoH * aspect));
      }
      const logoX = W/2 - logoW/2;
      const logoY = cy + 64;
      ctx.drawImage(logo, logoX, logoY, logoW, logoH);
    } else {
      ctx.fillStyle='rgba(0,255,216,0.92)';
      ctx.font='800 34px system-ui';
      ctx.fillText(title, W/2, titleY);
    }

    const subY = Math.max(cy + 150, titleY + 44);
    ctx.fillStyle='rgba(232,247,255,0.88)';
    ctx.font='600 16px system-ui';
    ctx.fillText(subtitle, W/2, subY);

    if(foot){
      ctx.fillStyle='rgba(232,247,255,0.70)';
      ctx.font='500 14px system-ui';
      wrapText(ctx, foot, W/2, subY + 40, 320, 18);
    }

    const tipY = Math.max(cy + 238, subY + (foot ? 88 : 56));
    ctx.fillStyle='rgba(255,184,77,0.8)';
    ctx.font='700 12px system-ui';
    ctx.fillText('Tip: Grab a SHIELD to survive a hit', W/2, tipY);
    ctx.fillText('A MAGNET pulls power-ups toward you.', W/2, tipY + 18);

    ctx.restore();
  }

  function wrapText(c, text, x, y, maxW, lineH){
    const words=text.split(' ');
    let line='';
    for(let i=0;i<words.length;i++){
      const test=line + words[i] + ' ';
      if(c.measureText(test).width > maxW && i>0){
        c.fillText(line, x, y);
        line = words[i] + ' ';
        y += lineH;
      } else line = test;
    }
    c.fillText(line, x, y);
  }

  function roundRect(c, x, y, w, h, r){
    c.beginPath();
    c.moveTo(x+r, y);
    c.arcTo(x+w, y, x+w, y+h, r);
    c.arcTo(x+w, y+h, x, y+h, r);
    c.arcTo(x, y+h, x, y, r);
    c.arcTo(x, y, x+w, y, r);
    c.closePath();
  }

})();
