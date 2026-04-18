(() => {
  const canvas = document.getElementById('demoCanvas');
  const ctx = canvas.getContext('2d');

  const segmentLabel = document.getElementById('segmentLabel');
  const laneLabel = document.getElementById('laneLabel');
  const speedLabel = document.getElementById('speedLabel');
  const moodLabel = document.getElementById('moodLabel');
  const actionLabel = document.getElementById('actionLabel');
  const weatherLabel = document.getElementById('weatherLabel');
  const timeLabel = document.getElementById('timeLabel');
  const regenBtn = document.getElementById('regenBtn');

  const W = 1280;
  const H = 760;
  const SEGMENT_LENGTH = 160;
  const DRAW_DISTANCE = 170;
  const ROAD_WIDTH = 2000;
  const CAMERA_HEIGHT = 1100;
  const CAMERA_DEPTH = 0.88;
  const PLAYER_Y = H * 0.79;
  const LANE_NAMES = ['Left', 'Center', 'Right'];
  const LANE_POSITIONS = [-0.52, 0, 0.52];
  const ITEM_LANE_POSITIONS = [-0.3, 0, 0.3];
  const BASE_SPEED = 660;
  const PULSE_SPEED = 980;
  const JUMP_VELOCITY = 980;
  const GRAVITY = 2500;
  const SLIDE_DURATION = 0.62;
  const HAZARD_WINDOW = 36;
  const HIT_FLASH_DURATION = 0.72;
  const WEATHER_DURATION = 18;
  const TIME_OF_DAY_DURATION = 34;

  const WEATHER_STATES = [
    { name: 'Clear', dust: 0.24, cloud: 0.04, tint: '#e9ba72', overlay: 'rgba(0,0,0,0)' },
    { name: 'Dust', dust: 0.46, cloud: 0.08, tint: '#d08f53', overlay: 'rgba(158,104,54,0.14)' },
    { name: 'Storm', dust: 0.6, cloud: 0.18, tint: '#b9815a', overlay: 'rgba(86,58,36,0.22)' },
    { name: 'Clear', dust: 0.24, cloud: 0.04, tint: '#e9ba72', overlay: 'rgba(0,0,0,0)' }
  ];

  const DAY_STATES = [
    { name: 'Day', top: '#5d4028', mid: '#8f6748', low: '#4a3427', bottom: '#1b1510', glow: 'rgba(235,190,114,0.16)', line: 'rgba(243,230,207,0.05)' },
    { name: 'Dusk', top: '#5a342a', mid: '#8e5840', low: '#4c2b28', bottom: '#17110d', glow: 'rgba(235,146,92,0.14)', line: 'rgba(255,214,187,0.05)' },
    { name: 'Night', top: '#1b1d2a', mid: '#24263a', low: '#171824', bottom: '#09090e', glow: 'rgba(126,156,230,0.08)', line: 'rgba(194,208,255,0.04)' },
    { name: 'Dawn', top: '#45352b', mid: '#7d5d4c', low: '#544235', bottom: '#18120f', glow: 'rgba(247,202,137,0.12)', line: 'rgba(243,230,207,0.05)' }
  ];

  const images = loadImages({
    sheet: 'assets/character_sheet.png',
    coin: 'assets/coin.png',
    beacon: 'assets/beacon.png',
    obstacle: 'assets/obstacle_high_3.png',
    drone: 'assets/drone.png'
  });

  const state = {
    lane: 1,
    laneVisual: 1,
    speed: BASE_SPEED,
    speedTarget: BASE_SPEED,
    pulse: 0,
    position: 0,
    skyShift: 0,
    segments: [],
    totalLength: 0,
    currentTag: 'Straight',
    mood: 'Calm',
    runnerAnim: 0,
    jumpHeight: 0,
    jumpVelocity: 0,
    grounded: true,
    slide: 0,
    hitFlash: 0,
    recovery: 0,
    hits: 0,
    warning: '',
    weatherClock: 0,
    dayClock: 0
  };

  const skylineBands = buildSkylineBands();

  function loadImages(map){
    const result = {};
    Object.entries(map).forEach(([key, src]) => {
      const img = new Image();
      img.src = src;
      result[key] = img;
    });
    return result;
  }

  function fitCanvas(){
    const stage = canvas.parentElement;
    const width = stage.clientWidth;
    const height = stage.clientHeight;
    const dpr = window.devicePixelRatio || 1;
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    canvas.width = Math.max(1, Math.floor(width * dpr));
    canvas.height = Math.max(1, Math.floor(height * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function easeIn(a, b, percent){
    return a + (b - a) * Math.pow(percent, 2);
  }

  function easeOut(a, b, percent){
    return a + (b - a) * (1 - Math.pow(1 - percent, 2));
  }

  function easeInOut(a, b, percent){
    return a + (b - a) * ((-Math.cos(percent * Math.PI) / 2) + 0.5);
  }

  function lerp(a, b, t){
    return a + (b - a) * t;
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
    const mix = (v1, v2) => Math.round(v1 + (v2 - v1) * t);
    return 'rgb(' + mix(c1.r, c2.r) + ',' + mix(c1.g, c2.g) + ',' + mix(c1.b, c2.b) + ')';
  }

  function parseColor(color){
    if(color.startsWith('#')){
      const rgb = hexToRgb(color);
      return { r: rgb.r, g: rgb.g, b: rgb.b, a: 1 };
    }

    const match = color.match(/rgba?\(([^)]+)\)/i);
    if(!match) return { r: 0, g: 0, b: 0, a: 1 };

    const parts = match[1].split(',').map((part) => Number(part.trim()));
    return {
      r: parts[0] || 0,
      g: parts[1] || 0,
      b: parts[2] || 0,
      a: parts.length > 3 ? parts[3] : 1
    };
  }

  function mixRgba(a, b, t){
    const c1 = parseColor(a);
    const c2 = parseColor(b);
    const mix = (v1, v2) => Math.round(lerp(v1, v2, t));
    return 'rgba('
      + mix(c1.r, c2.r) + ','
      + mix(c1.g, c2.g) + ','
      + mix(c1.b, c2.b) + ','
      + lerp(c1.a, c2.a, t).toFixed(3)
      + ')';
  }

  function getCycleState(list, clock, duration){
    const wrapped = (clock / duration) % list.length;
    const index = Math.floor(wrapped);
    const nextIndex = (index + 1) % list.length;
    const t = wrapped - index;
    return {
      current: list[index],
      next: list[nextIndex],
      t
    };
  }

  function buildSkylineBands(){
    const near = [];
    const far = [];
    for(let i = 0; i < 18; i++){
      near.push({
        x: i * 118,
        width: 64 + (i % 5) * 18,
        height: 50 + (i % 4) * 24,
        type: i % 3 === 0 ? 'tower' : i % 4 === 0 ? 'dish' : 'ruin'
      });
    }
    for(let i = 0; i < 12; i++){
      far.push({
        x: i * 170,
        width: 110 + (i % 4) * 26,
        height: 42 + (i % 3) * 18,
        type: i % 2 === 0 ? 'ruin' : 'tower'
      });
    }
    return { near, far };
  }

  function addSegment(curve, yDelta, width, tag, mood){
    const index = state.segments.length;
    const previous = state.segments[index - 1];
    const y = previous ? previous.world.y2 : 0;
    const z = index * SEGMENT_LENGTH;
    const segment = {
      index,
      curve,
      width,
      tag,
      mood,
      world: {
        y1: y,
        y2: y + yDelta,
        z1: z,
        z2: z + SEGMENT_LENGTH
      },
      colors: {
        grass: index % 2 ? '#423225' : '#4f3b2d',
        shoulder: index % 2 ? '#5b4634' : '#6a523d',
        road: index % 2 ? '#352a22' : '#403127',
        roadWear: index % 2 ? 'rgba(255,234,200,0.035)' : 'rgba(0,0,0,0.08)',
        lane: 'rgba(243,230,207,0.11)',
        edge: 'rgba(225,164,90,0.22)',
        edgeBright: 'rgba(245,207,142,0.42)',
        crack: 'rgba(20,14,10,0.42)'
      },
      items: [],
      props: []
    };
    state.segments.push(segment);
    return segment;
  }

  function addRoad(enter, hold, leave, curve, slope, width, tag, mood){
    for(let n = 0; n < enter; n++){
      addSegment(easeIn(0, curve, n / Math.max(1, enter)), easeInOut(0, slope, n / Math.max(1, enter)), easeInOut(1, width, n / Math.max(1, enter)), tag, mood);
    }
    for(let n = 0; n < hold; n++){
      addSegment(curve, slope, width, tag, mood);
    }
    for(let n = 0; n < leave; n++){
      addSegment(easeOut(curve, 0, n / Math.max(1, leave)), easeInOut(slope, 0, n / Math.max(1, leave)), easeInOut(width, 1, n / Math.max(1, leave)), tag, mood);
    }
  }

  function addItem(segmentIndex, lane, type, offset){
    const segment = state.segments[segmentIndex];
    if(!segment) return;
    segment.items.push({ lane, type, offset });
  }

  function populateItems(){
    state.segments.forEach((segment, index) => {
      if(index % 17 === 0){
        addItem(index, (index / 17) % 3 | 0, 'obstacle', 0.55);
      }
      if(index % 23 === 9){
        addItem(index, (index / 23 + 2) % 3 | 0, 'pit', 0.58);
      }
      if(index % 31 === 14){
        addItem(index, (index / 31 + 1) % 3 | 0, 'bridge', 0.6);
      }
      if(index % 11 === 0){
        addItem(index, (index / 11 + 1) % 3 | 0, 'coin', 0.42);
      }
      if(index % 29 === 0){
        addItem(index, 1, 'beacon', 0.7);
      }
      if(index % 13 === 0){
        addItem(index, -1.18, 'drone', 0.5);
        addItem(index, 1.18, 'drone', 0.5);
      }
    });
  }

  function addProp(segmentIndex, side, type, offset, scale = 1){
    const segment = state.segments[segmentIndex];
    if(!segment) return;
    segment.props.push({ side, type, offset, scale });
  }

  function populateProps(){
    state.segments.forEach((segment, index) => {
      const leftSide = index % 2 === 0 ? -1.28 : 1.28;
      const rightSide = -leftSide;

      if(index % 4 === 0){
        addProp(index, leftSide, 'post', 0.45, 1);
      }
      if(index % 5 === 0){
        addProp(index, rightSide, 'post', 0.62, 1.08);
      }
      if(index % 7 === 0){
        addProp(index, leftSide * 1.06, 'scrub', 0.56, 1.1);
      }
      if(index % 9 === 0){
        addProp(index, rightSide * 1.06, 'scrub', 0.48, 1.16);
      }
      if(index % 14 === 0){
        addProp(index, leftSide * 1.1, 'ruin', 0.68, 1.22);
      }
      if(index % 16 === 0){
        addProp(index, rightSide * 1.16, 'sign', 0.58, 1.18);
      }
      if(index % 19 === 0){
        addProp(index, leftSide * 1.24, 'tower', 0.74, 1.4);
      }
      if(index % 20 === 0){
        addProp(index, leftSide * 1.48, 'ruin', 0.34, 1.18);
      }
      if(index % 21 === 0){
        addProp(index, rightSide * 1.26, 'tower', 0.66, 1.28);
      }
      if(index % 22 === 0){
        addProp(index, rightSide * 1.42, 'tower', 0.4, 1.18);
      }
      if(index % 25 === 0){
        addProp(index, leftSide * 1.34, 'ruin', 0.52, 1.42);
      }
      if(index % 27 === 0){
        addProp(index, rightSide * 1.36, 'ruin', 0.72, 1.34);
      }
    });
  }

  function rebuildTrack(){
    state.segments.length = 0;

    addRoad(20, 28, 16, 0.0, 0, 1.0, 'Dust Run', 'Quiet');
    addRoad(18, 24, 18, 0.52, 0.0, 1.0, 'Vault Bend', 'Tense');
    addRoad(12, 18, 12, -0.26, 4, 1.0, 'Broken Rise', 'Lift');
    addRoad(12, 26, 14, -0.58, 0, 0.92, 'Collapsed Left', 'Pressure');
    addRoad(10, 18, 14, 0.0, -5, 1.0, 'Ravine Drop', 'Fast');
    addRoad(18, 30, 18, 0.34, 0, 1.05, 'Ash Sweep', 'Flow');
    addRoad(14, 16, 12, 0.0, 3, 0.84, 'Narrow Ruin', 'Focus');
    addRoad(16, 22, 16, -0.44, -3, 1.0, 'Scrap Dive', 'Fast');
    addRoad(20, 20, 18, 0.0, 0, 1.0, 'Recovery Flats', 'Quiet');

    state.totalLength = state.segments.length * SEGMENT_LENGTH;
    populateItems();
    populateProps();
    state.hitFlash = 0;
    state.recovery = 0;
    state.warning = '';
    state.hits = 0;
    state.jumpHeight = 0;
    state.jumpVelocity = 0;
    state.grounded = true;
    state.slide = 0;
  }

  function findSegment(z){
    return state.segments[Math.floor(z / SEGMENT_LENGTH) % state.segments.length];
  }

  function percentRemaining(z){
    return (z % SEGMENT_LENGTH) / SEGMENT_LENGTH;
  }

  function project(point, cameraX, cameraY, cameraZ, roadWidth){
    const dz = point.world.z - cameraZ;
    const dx = point.world.x - cameraX;
    const dy = point.world.y - cameraY;
    point.camera.x = dx;
    point.camera.y = dy;
    point.camera.z = dz;
    point.screen.scale = CAMERA_DEPTH / dz;
    point.screen.x = Math.round((1 + point.screen.scale * dx) * W * 0.5);
    point.screen.y = Math.round((1 - point.screen.scale * dy) * H * 0.5);
    point.screen.w = Math.round(point.screen.scale * roadWidth * W * 0.5);
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

  function drawRoadStripe(x1, y1, w1, x2, y2, w2, color){
    drawQuad(x1, y1, w1, x2, y2, w2, color);
  }

  function drawRoadCrack(x1, y1, x2, y2, width, color){
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo((x1 + x2) / 2 + width * 0.8, (y1 + y2) / 2);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  function drawRoadSegment(segment){
    const p1 = segment.p1.screen;
    const p2 = segment.p2.screen;
    if(p2.y >= p1.y) return;

    ctx.fillStyle = segment.colors.grass;
    ctx.fillRect(0, p2.y, W, p1.y - p2.y);

    drawQuad(p1.x, p1.y, p1.w * 1.14, p2.x, p2.y, p2.w * 1.12, segment.colors.shoulder);
    drawQuad(p1.x, p1.y, p1.w, p2.x, p2.y, p2.w, segment.colors.road);
    drawRoadStripe(p1.x, p1.y, p1.w * 0.56, p2.x, p2.y, p2.w * 0.52, segment.colors.roadWear);

    drawRoadStripe(p1.x - p1.w * 0.9, p1.y, p1.w * 0.05, p2.x - p2.w * 0.9, p2.y, p2.w * 0.05, 'rgba(245,207,142,0.08)');
    drawRoadStripe(p1.x + p1.w * 0.9, p1.y, p1.w * 0.05, p2.x + p2.w * 0.9, p2.y, p2.w * 0.05, 'rgba(245,207,142,0.08)');

    ctx.strokeStyle = segment.colors.edge;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(p1.x - p1.w * 0.98, p1.y);
    ctx.lineTo(p2.x - p2.w * 0.98, p2.y);
    ctx.moveTo(p1.x + p1.w * 0.98, p1.y);
    ctx.lineTo(p2.x + p2.w * 0.98, p2.y);
    ctx.stroke();

    ctx.strokeStyle = segment.colors.edgeBright;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(p1.x - p1.w * 0.94, p1.y);
    ctx.lineTo(p2.x - p2.w * 0.94, p2.y);
    ctx.moveTo(p1.x + p1.w * 0.94, p1.y);
    ctx.lineTo(p2.x + p2.w * 0.94, p2.y);
    ctx.stroke();

    ctx.strokeStyle = segment.colors.lane;
    ctx.lineWidth = 2;
    for(let i = 1; i < 3; i++){
      const laneA = p1.x - p1.w + (p1.w * 2 * i / 3);
      const laneB = p2.x - p2.w + (p2.w * 2 * i / 3);
      ctx.beginPath();
      ctx.moveTo(laneA, p1.y);
      ctx.lineTo(laneB, p2.y);
      ctx.stroke();
    }

    drawRoadCrack(p1.x - p1.w * 0.2, p1.y, p2.x - p2.w * 0.06, p2.y, Math.max(1, p2.w * 0.012), segment.colors.crack);
    drawRoadCrack(p1.x + p1.w * 0.16, p1.y, p2.x + p2.w * 0.26, p2.y, Math.max(1, p2.w * 0.009), 'rgba(56,42,31,0.34)');
  }

  function drawRoadsideProp(segment, prop){
    const p1 = segment.p1.screen;
    const p2 = segment.p2.screen;
    const t = prop.offset;
    const centerX = easeInOut(p1.x, p2.x, t);
    const centerY = easeInOut(p1.y, p2.y, t);
    const roadW = easeInOut(p1.w, p2.w, t);
    const scale = easeInOut(segment.p1.screen.scale, segment.p2.screen.scale, t) * prop.scale;
    const x = centerX + roadW * prop.side;
    const baseY = centerY + 6;

    ctx.save();
    ctx.globalAlpha = Math.min(1, 0.16 + scale * 10);

    if(prop.type === 'post'){
      const h = Math.max(18, 78 * scale);
      const w = Math.max(4, 10 * scale);
      ctx.fillStyle = '#503c2d';
      ctx.fillRect(x - w / 2, baseY - h, w, h);
      ctx.fillStyle = '#c69b66';
      ctx.fillRect(x - w * 1.8, baseY - h * 0.86, w * 3.6, h * 0.18);
    } else if(prop.type === 'scrub'){
      const r = Math.max(10, 34 * scale);
      ctx.fillStyle = 'rgba(119,112,73,0.95)';
      ctx.beginPath();
      ctx.ellipse(x, baseY - r * 0.2, r, r * 0.7, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(75,64,39,0.9)';
      ctx.fillRect(x - r * 0.16, baseY - r * 1.1, r * 0.32, r * 0.9);
    } else if(prop.type === 'ruin'){
      const w = Math.max(18, 72 * scale);
      const h = Math.max(26, 138 * scale);
      ctx.fillStyle = '#4f3b2d';
      ctx.fillRect(x - w * 0.52, baseY - h, w, h);
      ctx.fillStyle = 'rgba(18,12,9,0.55)';
      ctx.fillRect(x - w * 0.2, baseY - h * 0.78, w * 0.22, h * 0.2);
      ctx.fillStyle = '#36291f';
      ctx.fillRect(x - w * 0.58, baseY - h * 0.46, w * 1.16, h * 0.12);
    } else if(prop.type === 'sign'){
      const poleH = Math.max(24, 94 * scale);
      const signW = Math.max(18, 62 * scale);
      const signH = Math.max(14, 34 * scale);
      ctx.fillStyle = '#584430';
      ctx.fillRect(x - 3 * scale, baseY - poleH, Math.max(4, 8 * scale), poleH);
      ctx.fillStyle = '#c86a48';
      ctx.fillRect(x - signW * 0.5, baseY - poleH, signW, signH);
      ctx.strokeStyle = 'rgba(34,22,16,0.55)';
      ctx.lineWidth = Math.max(1, 2 * scale);
      ctx.strokeRect(x - signW * 0.5, baseY - poleH, signW, signH);
    } else if(prop.type === 'tower'){
      const w = Math.max(20, 66 * scale);
      const h = Math.max(54, 180 * scale);
      ctx.strokeStyle = 'rgba(111,88,63,0.88)';
      ctx.lineWidth = Math.max(1, 3 * scale);
      ctx.beginPath();
      ctx.moveTo(x - w * 0.4, baseY);
      ctx.lineTo(x - w * 0.14, baseY - h);
      ctx.lineTo(x + w * 0.14, baseY - h);
      ctx.lineTo(x + w * 0.4, baseY);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x - w * 0.3, baseY - h * 0.55);
      ctx.lineTo(x + w * 0.3, baseY - h * 0.55);
      ctx.moveTo(x - w * 0.24, baseY - h * 0.28);
      ctx.lineTo(x + w * 0.24, baseY - h * 0.28);
      ctx.stroke();
    }

    ctx.restore();
  }

  function drawGlowSprite(image, x, y, width, height, glowColor, fallback){
    ctx.save();
    ctx.globalAlpha = 0.24;
    ctx.fillStyle = glowColor;
    ctx.beginPath();
    ctx.ellipse(x, y + height * 0.34, width * 0.45, height * 0.22, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    if(image && image.complete){
      ctx.drawImage(image, x - width / 2, y - height, width, height);
    } else {
      fallback(x, y, width, height);
    }
    ctx.restore();
  }

  function drawItem(segment, item){
    const p1 = segment.p1.screen;
    const p2 = segment.p2.screen;
    const t = item.offset;
    const centerX = easeInOut(p1.x, p2.x, t);
    const centerY = easeInOut(p1.y, p2.y, t);
    const roadW = easeInOut(p1.w, p2.w, t);
    const scale = easeInOut(segment.p1.screen.scale, segment.p2.screen.scale, t);
    const proximityBoost = 1 + Math.max(0, (centerY / H) - 0.28) * 2.6;
    const boostedScale = scale * proximityBoost;
    const isOffroad = typeof item.lane === 'number' && Math.abs(item.lane) > 1;
    const laneOffset = isOffroad ? item.lane : ITEM_LANE_POSITIONS[item.lane];
    let x = centerX + roadW * laneOffset;

    if(item.type === 'coin'){
      const size = Math.max(18, 132 * boostedScale);
      const margin = size * 0.42;
      x = Math.max(centerX - roadW * 0.78 + margin, Math.min(centerX + roadW * 0.78 - margin, x));
      drawGlowSprite(images.coin, x, centerY - size * 0.16, size, size, 'rgba(225,164,90,0.34)', (fx, fy, fw) => {
        ctx.fillStyle = '#e1a45a';
        ctx.beginPath();
        ctx.arc(fx, fy - fw * 0.42, fw * 0.28, 0, Math.PI * 2);
        ctx.fill();
      });
    } else if(item.type === 'beacon'){
      const width = Math.max(26, 126 * boostedScale);
      const height = width * 1.08;
      const margin = width * 0.46;
      x = Math.max(centerX - roadW * 0.76 + margin, Math.min(centerX + roadW * 0.76 - margin, x));
      drawGlowSprite(images.beacon, x, centerY - height * 0.14, width, height, 'rgba(157,219,183,0.28)', (fx, fy, fw, fh) => {
        ctx.fillStyle = '#9ddbb7';
        ctx.fillRect(fx - fw * 0.22, fy - fh, fw * 0.44, fh);
      });
    } else if(item.type === 'obstacle'){
      const width = Math.max(54, 224 * boostedScale);
      const height = width * 1.12;
      const margin = width * 0.4;
      x = Math.max(centerX - roadW * 0.74 + margin, Math.min(centerX + roadW * 0.74 - margin, x));
      drawGlowSprite(images.obstacle, x, centerY - height * 0.04, width, height, 'rgba(200,106,72,0.2)', (fx, fy, fw, fh) => {
        ctx.fillStyle = '#8c6452';
        ctx.fillRect(fx - fw * 0.36, fy - fh, fw * 0.72, fh);
      });
    } else if(item.type === 'pit'){
      const width = Math.max(48, 190 * boostedScale);
      const depth = Math.max(16, 54 * boostedScale);
      const margin = width * 0.42;
      x = Math.max(centerX - roadW * 0.74 + margin, Math.min(centerX + roadW * 0.74 - margin, x));
      ctx.save();
      ctx.globalAlpha = 0.92;
      ctx.fillStyle = 'rgba(15,10,8,0.94)';
      ctx.beginPath();
      ctx.ellipse(x, centerY - depth * 0.15, width * 0.48, depth * 0.55, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(245,207,142,0.28)';
      ctx.lineWidth = Math.max(1, boostedScale * 16);
      ctx.beginPath();
      ctx.ellipse(x, centerY - depth * 0.15, width * 0.48, depth * 0.55, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    } else if(item.type === 'bridge'){
      const width = Math.max(78, 250 * boostedScale);
      const height = Math.max(52, 154 * boostedScale);
      const margin = width * 0.34;
      x = Math.max(centerX - roadW * 0.7 + margin, Math.min(centerX + roadW * 0.7 - margin, x));
      ctx.save();
      ctx.fillStyle = 'rgba(91,70,52,0.92)';
      ctx.fillRect(x - width * 0.52, centerY - height * 0.25, Math.max(8, 18 * boostedScale), height);
      ctx.fillRect(x + width * 0.34, centerY - height * 0.25, Math.max(8, 18 * boostedScale), height);
      ctx.fillStyle = 'rgba(124,94,66,0.96)';
      ctx.fillRect(x - width * 0.52, centerY - height * 0.3, width * 1.02, Math.max(10, 24 * boostedScale));
      ctx.fillStyle = 'rgba(245,207,142,0.12)';
      ctx.fillRect(x - width * 0.5, centerY - height * 0.27, width * 0.96, Math.max(3, 8 * boostedScale));
      ctx.restore();
    } else if(item.type === 'drone'){
      const size = Math.max(14, 68 * boostedScale);
      drawGlowSprite(images.drone, x, centerY - size * 0.45, size, size, 'rgba(157,219,183,0.12)', (fx, fy, fw) => {
        ctx.fillStyle = '#d7faff';
        ctx.beginPath();
        ctx.arc(fx, fy - fw * 0.3, fw * 0.16, 0, Math.PI * 2);
        ctx.fill();
      });
    }
  }

  function getProjectedDepth(segment, offset){
    const p1 = segment.p1.screen;
    const p2 = segment.p2.screen;
    return easeInOut(p1.y, p2.y, offset);
  }

  function drawPlayer(){
    const playerX = W * (0.34 + (state.laneVisual / 2) * 0.32);
    const slideActive = state.slide > 0;
    const bodyY = PLAYER_Y - state.jumpHeight;
    const bob = Math.sin(performance.now() * 0.008) * (slideActive ? 1.6 : 4);
    const sheet = images.sheet;

    ctx.save();
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = 'rgba(32,24,17,0.78)';
    ctx.beginPath();
    ctx.ellipse(playerX, bodyY + 18, 62, 18, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.14;
    ctx.fillStyle = 'rgba(225,164,90,0.6)';
    ctx.beginPath();
    ctx.arc(playerX, bodyY - 46 + bob, 66, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    if(sheet && sheet.complete){
      state.runnerAnim += slideActive ? 0.1 : 0.18;
      const frame = Math.floor(state.runnerAnim) % 4;
      const sx = slideActive ? 4 * 96 : frame * 96;
      const sy = 0;
      const sw = 96;
      const sh = 128;
      const drawW = slideActive ? 154 : 126;
      const drawH = slideActive ? 118 : 168;
      ctx.drawImage(sheet, sx, sy, sw, sh, playerX - drawW / 2, bodyY - drawH + bob, drawW, drawH);
    } else {
      ctx.fillStyle = '#9ddbb7';
      ctx.fillRect(playerX - (slideActive ? 42 : 28), bodyY - (slideActive ? 54 : 92) + bob, slideActive ? 84 : 56, slideActive ? 54 : 92);
    }

    ctx.fillStyle = 'rgba(243,230,207,0.92)';
    ctx.font = '700 12px "Trebuchet MS", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('RUNNER', playerX, bodyY + 46);
    ctx.restore();
  }

  function drawWarningOverlay(){
    if(state.hitFlash <= 0) return;
    const alpha = Math.min(1, state.hitFlash / HIT_FLASH_DURATION);
    ctx.save();
    ctx.globalAlpha = alpha * 0.28;
    ctx.fillStyle = '#c86a48';
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = 'rgba(243,230,207,0.95)';
    ctx.font = '800 30px "Trebuchet MS", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(state.warning || 'MISSED TIMING', W / 2, 92);
    ctx.font = '600 14px "Trebuchet MS", sans-serif';
    ctx.fillText('Use Up to jump and Down to slide', W / 2, 118);
    ctx.restore();
  }

  function drawSkylineBand(items, baseY, color, drift, scale, lineColor, isNight){
    ctx.save();
    ctx.fillStyle = color;
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 1;

    items.forEach((item, index) => {
      const x = ((item.x + drift) % (W + 260)) - 130;
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
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(left + width * 0.3, top + height * 0.32);
        ctx.lineTo(left + width * 0.7, top + height * 0.32);
        ctx.moveTo(left + width * 0.24, top + height * 0.58);
        ctx.lineTo(left + width * 0.76, top + height * 0.58);
        ctx.stroke();

        if(isNight){
          ctx.fillStyle = 'rgba(255,120,88,0.8)';
          ctx.beginPath();
          ctx.arc(left + width * 0.5, top + height * 0.08, Math.max(1.5, width * 0.035), 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = color;
        }
      } else if(item.type === 'dish'){
        ctx.fillRect(left + width * 0.42, top + height * 0.2, width * 0.14, height * 0.8);
        ctx.beginPath();
        ctx.ellipse(left + width * 0.5, top + height * 0.2, width * 0.26, height * 0.18, -0.28, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.moveTo(left, baseY);
        ctx.lineTo(left + width * 0.18, top + height * 0.26);
        ctx.lineTo(left + width * 0.36, top);
        ctx.lineTo(left + width * 0.58, top + height * 0.32);
        ctx.lineTo(left + width * 0.76, top + height * 0.12);
        ctx.lineTo(left + width, baseY);
        ctx.closePath();
        ctx.fill();
      }

      if(index % 5 === 0){
        ctx.fillStyle = 'rgba(31,24,19,0.16)';
        ctx.fillRect(left + width * 0.18, baseY, width * 0.08, height * 0.26);
        ctx.fillStyle = color;
      }
    });

    ctx.restore();
  }

  function drawSky(dt){
    state.skyShift += dt * 0.018;
    const day = getCycleState(DAY_STATES, state.dayClock, TIME_OF_DAY_DURATION);
    const weather = getCycleState(WEATHER_STATES, state.weatherClock, WEATHER_DURATION);
    const weatherDust = lerp(weather.current.dust, weather.next.dust, weather.t);
    const weatherCloud = lerp(weather.current.cloud, weather.next.cloud, weather.t);
    const weatherOverlay = mixRgba(weather.current.overlay, weather.next.overlay, weather.t);
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    const topColor = mixColor(day.current.top, day.next.top, day.t);
    const midColor = mixColor(day.current.mid, day.next.mid, day.t);
    const lowColor = mixColor(day.current.low, day.next.low, day.t);
    const bottomColor = mixColor(day.current.bottom, day.next.bottom, day.t);
    const glowColor = mixRgba(day.current.glow, day.next.glow, day.t);
    const horizonLine = mixRgba(day.current.line, day.next.line, day.t);
    const isNight = day.current.name === 'Night' || day.next.name === 'Night';

    sky.addColorStop(0, topColor);
    sky.addColorStop(0.24, midColor);
    sky.addColorStop(0.56, lowColor);
    sky.addColorStop(1, bottomColor);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = glowColor;
    ctx.beginPath();
    ctx.arc(W * 0.5, H * 0.18, 160, 0, Math.PI * 2);
    ctx.fill();

    if(isNight){
      ctx.fillStyle = 'rgba(214,226,255,0.72)';
      ctx.beginPath();
      ctx.arc(W * 0.72, H * 0.16, 26, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = 'rgba(245,246,255,0.82)';
      for(let i = 0; i < 26; i++){
        const twinkle = 0.45 + Math.sin(state.dayClock * 0.9 + i * 1.7) * 0.22;
        const x = (i * 137 + 80) % W;
        const y = 36 + (i % 7) * 24;
        ctx.globalAlpha = twinkle;
        ctx.fillRect(x, y, 2, 2);
      }
      ctx.globalAlpha = 1;
    }

    ctx.strokeStyle = horizonLine;
    ctx.lineWidth = 1;
    for(let i = 0; i < 7; i++){
      const y = H * 0.18 + i * 24;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }

    for(let i = 0; i < 6; i++){
      const drift = ((state.skyShift * 110) + i * 180) % (W + 240);
      const x = drift - 120;
      ctx.fillStyle = 'rgba(255,233,203,' + (weatherCloud * 0.18).toFixed(3) + ')';
      ctx.beginPath();
      ctx.ellipse(x, 110 + i * 38, 84, 20, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    const dust = ctx.createLinearGradient(0, H * 0.48, 0, H);
    dust.addColorStop(0, 'rgba(0,0,0,0)');
    dust.addColorStop(1, weatherOverlay);
    ctx.fillStyle = dust;
    ctx.fillRect(0, H * 0.42, W, H * 0.58);

    drawSkylineBand(
      skylineBands.far,
      H * 0.45,
      isNight ? 'rgba(23,22,35,0.62)' : 'rgba(56,43,33,0.46)',
      state.skyShift * 44,
      1,
      isNight ? 'rgba(111,130,174,0.16)' : 'rgba(124,94,66,0.14)',
      isNight
    );
    drawSkylineBand(
      skylineBands.near,
      H * 0.5,
      isNight ? 'rgba(28,27,43,0.82)' : 'rgba(42,31,23,0.7)',
      state.skyShift * 72,
      1.18,
      isNight ? 'rgba(111,130,174,0.2)' : 'rgba(124,94,66,0.18)',
      isNight
    );

    if(weatherDust > 0.28){
      ctx.fillStyle = 'rgba(193,142,94,' + (0.04 + weatherDust * 0.22).toFixed(3) + ')';
      for(let i = 0; i < 18; i++){
        const drift = ((state.skyShift * 190) + i * 92) % (W + 320);
        const x = drift - 160;
        const y = H * (0.28 + (i % 6) * 0.055);
        ctx.beginPath();
        ctx.ellipse(x, y, 82 + (i % 3) * 24, 18 + (i % 4) * 6, 0.06, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function drawHud(){
    ctx.save();
    ctx.fillStyle = 'rgba(26,18,13,0.68)';
    ctx.fillRect(20, 18, 214, 82);
    ctx.strokeStyle = 'rgba(225,164,90,0.22)';
    ctx.strokeRect(20, 18, 214, 82);
    ctx.fillStyle = 'rgba(243,230,207,0.92)';
    ctx.font = '700 13px "Trebuchet MS", sans-serif';
    ctx.fillText('Wasteland Camera Test', 34, 42);
    ctx.fillStyle = 'rgba(243,230,207,0.62)';
    ctx.font = '500 12px "Trebuchet MS", sans-serif';
    ctx.fillText('Curves, hills, larger threats, bigger loot', 34, 64);
    ctx.fillText('This is a feel test, not production gameplay.', 34, 84);
    ctx.restore();
  }

  function render(dt){
    drawSky(dt);

    const baseSegment = findSegment(state.position);
    const baseIndex = baseSegment.index;
    const basePercent = percentRemaining(state.position);
    const playerOffset = (state.laneVisual - 1) * 0.52;
    const cameraX = playerOffset * ROAD_WIDTH * 0.18;
    const cameraY = CAMERA_HEIGHT;
    const cameraZ = state.position;

    let x = 0;
    let dx = -(baseSegment.curve * basePercent);
    let maxY = H;
    const visible = [];
    const sprites = [];

    for(let n = 0; n < DRAW_DISTANCE; n++){
      const segment = state.segments[(baseIndex + n) % state.segments.length];
      segment.looped = segment.index < baseIndex;

      segment.p1 = {
        world: {
          x,
          y: segment.world.y1,
          z: segment.world.z1 - cameraZ + (segment.looped ? state.totalLength : 0)
        },
        camera: {},
        screen: {}
      };

      segment.p2 = {
        world: {
          x: x + dx,
          y: segment.world.y2,
          z: segment.world.z2 - cameraZ + (segment.looped ? state.totalLength : 0)
        },
        camera: {},
        screen: {}
      };

      x += dx;
      dx += segment.curve;

      project(segment.p1, cameraX, cameraY, 0, ROAD_WIDTH * segment.width);
      project(segment.p2, cameraX, cameraY, 0, ROAD_WIDTH * segment.width);

      if(segment.p1.camera.z <= CAMERA_DEPTH || segment.p2.screen.y >= maxY){
        continue;
      }

      drawRoadSegment(segment);
      visible.push(segment);
      maxY = segment.p2.screen.y;
    }

    for(let i = visible.length - 1; i >= 0; i--){
      const segment = visible[i];
      segment.props.forEach((prop) => {
        sprites.push({
          depth: getProjectedDepth(segment, prop.offset),
          draw: () => drawRoadsideProp(segment, prop)
        });
      });
      segment.items.forEach((item) => {
        sprites.push({
          depth: getProjectedDepth(segment, item.offset),
          draw: () => drawItem(segment, item)
        });
      });
    }

    sprites.sort((a, b) => a.depth - b.depth);
    sprites.forEach((sprite) => sprite.draw());

    drawPlayer();
    drawHud();
    drawWarningOverlay();
  }

  function wrappedDistance(itemZ){
    let diff = itemZ - state.position;
    if(diff < -state.totalLength * 0.5) diff += state.totalLength;
    if(diff > state.totalLength * 0.5) diff -= state.totalLength;
    return diff;
  }

  function triggerHit(message){
    if(state.recovery > 0) return;
    state.hits++;
    state.hitFlash = HIT_FLASH_DURATION;
    state.recovery = 0.6;
    state.warning = message;
  }

  function evaluateHazards(){
    if(state.recovery > 0) return;

    for(const segment of state.segments){
      for(const item of segment.items){
        if(typeof item.lane !== 'number' || Math.abs(item.lane) > 1) continue;
        if(item.lane !== state.lane) continue;

        const itemZ = segment.world.z1 + item.offset * SEGMENT_LENGTH;
        const distance = wrappedDistance(itemZ);
        if(Math.abs(distance) > HAZARD_WINDOW) continue;

        if(item.type === 'pit' && state.jumpHeight < 68){
          triggerHit('JUMP THE FLOOR BREAK');
          return;
        }
        if(item.type === 'bridge' && state.slide <= 0){
          triggerHit('SLIDE UNDER THE BRIDGE');
          return;
        }
        if(item.type === 'obstacle' && state.jumpHeight < 54){
          triggerHit('CHANGE LANE OR JUMP');
          return;
        }
      }
    }
  }

  function jump(){
    if(!state.grounded || state.slide > 0) return;
    state.jumpVelocity = JUMP_VELOCITY;
    state.grounded = false;
  }

  function slide(){
    if(!state.grounded) return;
    state.slide = SLIDE_DURATION;
  }

  function update(dt){
    state.weatherClock += dt;
    state.dayClock += dt;

    if(state.pulse > 0){
      state.pulse -= dt;
      if(state.pulse <= 0){
        state.speedTarget = BASE_SPEED;
      }
    }

    if(state.hitFlash > 0){
      state.hitFlash = Math.max(0, state.hitFlash - dt);
    }
    if(state.recovery > 0){
      state.recovery = Math.max(0, state.recovery - dt);
    }
    if(state.slide > 0){
      state.slide = Math.max(0, state.slide - dt);
    }
    if(!state.grounded || state.jumpHeight > 0){
      state.jumpHeight += state.jumpVelocity * dt;
      state.jumpVelocity -= GRAVITY * dt;
      if(state.jumpHeight <= 0){
        state.jumpHeight = 0;
        state.jumpVelocity = 0;
        state.grounded = true;
      }
    }

    state.speed += (state.speedTarget - state.speed) * Math.min(1, dt * 4.4);
    state.position = (state.position + state.speed * dt) % state.totalLength;
    state.laneVisual += (state.lane - state.laneVisual) * Math.min(1, dt * 7);
    evaluateHazards();

    const current = findSegment(state.position + SEGMENT_LENGTH * 3);
    state.currentTag = current.tag;
    state.mood = current.mood;

    if(segmentLabel) segmentLabel.textContent = current.tag;
    if(laneLabel) laneLabel.textContent = LANE_NAMES[state.lane];
    if(speedLabel) speedLabel.textContent = Math.round(state.speed).toString();
    if(moodLabel) moodLabel.textContent = current.mood;
    if(actionLabel){
      actionLabel.textContent = state.hitFlash > 0 ? 'Hit' : state.slide > 0 ? 'Slide' : !state.grounded ? 'Jump' : 'Run';
    }
    if(weatherLabel){
      weatherLabel.textContent = getCycleState(WEATHER_STATES, state.weatherClock, WEATHER_DURATION).current.name;
    }
    if(timeLabel){
      timeLabel.textContent = getCycleState(DAY_STATES, state.dayClock, TIME_OF_DAY_DURATION).current.name;
    }
  }

  let last = performance.now();
  function tick(now){
    const dt = Math.min(0.033, (now - last) / 1000);
    last = now;
    update(dt);
    render(dt);
    requestAnimationFrame(tick);
  }

  function onLane(dir){
    state.lane = Math.max(0, Math.min(2, state.lane + dir));
  }

  window.addEventListener('keydown', (event) => {
    if(event.key === 'ArrowLeft' || event.key.toLowerCase() === 'a'){
      event.preventDefault();
      onLane(-1);
    }
    if(event.key === 'ArrowRight' || event.key.toLowerCase() === 'd'){
      event.preventDefault();
      onLane(1);
    }
    if(event.key === 'ArrowUp' || event.key.toLowerCase() === 'w'){
      event.preventDefault();
      jump();
    }
    if(event.key === 'ArrowDown' || event.key.toLowerCase() === 's'){
      event.preventDefault();
      slide();
    }
    if(event.code === 'Space'){
      event.preventDefault();
      state.pulse = 1.4;
      state.speedTarget = PULSE_SPEED;
    }
  });

  window.addEventListener('resize', fitCanvas);
  if(regenBtn){
    regenBtn.addEventListener('click', () => {
      rebuildTrack();
      state.position = 0;
      state.speedTarget = BASE_SPEED;
      state.speed = BASE_SPEED;
    });
  }

  rebuildTrack();
  fitCanvas();
  requestAnimationFrame(tick);
})();
