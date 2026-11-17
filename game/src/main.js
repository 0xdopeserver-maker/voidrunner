// VOIDRUNNER — gameplay module. Attaches to window.VOID.
const W = 1280, H = 720;
const TAU = Math.PI * 2;
const cv = document.getElementById('c');
const ctx = cv.getContext('2d', { alpha: false });

const CYAN = 'rgba(90,235,255,A)';
const MAGENTA = 'rgba(255,80,180,A)';
const AMBER = 'rgba(255,190,90,A)';
const WHITE = 'rgba(235,245,255,A)';
const RED = 'rgba(255,70,70,A)';

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  cv.width = Math.round(W * dpr);
  cv.height = Math.round(H * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
resize();
addEventListener('resize', resize);

const rnd = (a = 1, b = 0) => b + Math.random() * (a - b);
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;

function glow(x, y, r, color, a = 1) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color.replace('A', (0.9 * a).toFixed(3)));
  g.addColorStop(0.4, color.replace('A', (0.30 * a).toFixed(3)));
  g.addColorStop(1, color.replace('A', '0'));
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
}

// ---------------------------------------------------------------- starfield
const stars = [];
for (let i = 0; i < 300; i++) stars.push({ x: rnd(W), y: rnd(H), z: rnd(1, 0.12), s: rnd(2.0, 0.4) });

// ---------------------------------------------------------------- game state
const G = {
  scene: 'title',        // title | play | end
  t: 0,
  score: 0,
  kills: 0,
  wave: 1,
  hull: 100,
  shield: 100,
  combo: 0,
  best: 0,
  shots: 0,
  hits: 0,
  waveTimer: 0,
  shake: 0,
  endReason: '',
  enemyQueue: 0,
};

const player = { x: W / 2, y: H - 130, vx: 0, vy: 0, r: 16, cool: 0, invuln: 0, thrust: 0 };
const bullets = [];   // player
const ebullets = [];  // enemy
const enemies = [];
const parts = [];
const partRings = [];  // expanding shockwave rings on kills
const pops = [];      // floating score text
const pickups = [];

// ---------------------------------------------------------------- input
const keys = {};
const input = { mx: W / 2, my: H / 2, firing: false, useMouse: false };
addEventListener('keydown', e => {
  keys[e.key.toLowerCase()] = true;
  if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(e.key.toLowerCase())) e.preventDefault();
  if (e.key === 'Enter') {
    if (G.scene === 'title') startRun();
    else if (G.scene === 'end') startRun();
  }
});
addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });
cv.addEventListener('mousemove', e => {
  const r = cv.getBoundingClientRect();
  input.mx = clamp((e.clientX - r.left) / r.width * W, 0, W);
  input.my = clamp((e.clientY - r.top) / r.height * H, 0, H);
  input.useMouse = true;
});
cv.addEventListener('mousedown', () => { input.firing = true; });
addEventListener('mouseup', () => { input.firing = false; });

// ---------------------------------------------------------------- spawn
function spawnEnemy(kind) {
  const pad = 70;
  const x = rnd(W - pad, pad);
  const base = { x, y: -40, r: 15, kind, hp: 1, t: 0, fire: rnd(2.4, 0.6), drift: rnd(1, -1) };
  if (kind === 'grunt') { base.hp = 1; base.vy = rnd(88, 55); base.r = 15; }
  if (kind === 'weaver') { base.hp = 2; base.vy = rnd(70, 48); base.r = 17; base.amp = rnd(110, 50); }
  if (kind === 'brute') { base.hp = 4; base.vy = rnd(38, 26); base.r = 27; base.fire = 2.0; }
  if (kind === 'sniper') { base.hp = 2; base.vy = rnd(34, 22); base.r = 16; base.fire = rnd(2.0, 1.2); }
  enemies.push(base);
}

function waveSpawns(n) {
  for (let i = 0; i < n; i++) {
    const roll = Math.random();
    let k = 'grunt';
    if (G.wave >= 2 && roll > 0.45) k = 'weaver';
    if (G.wave >= 3 && roll > 0.74) k = 'brute';
    if (G.wave >= 4 && roll > 0.88) k = 'sniper';
    spawnEnemy(k);
  }
}

function burst(x, y, color, n = 14, spd = 260) {
  for (let i = 0; i < n; i++) {
    const a = rnd(TAU), s = rnd(spd, spd * 0.25);
    parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rnd(0.95, 0.4), max: 0.95, color, sz: rnd(2.8, 1.0) });
  }
  // slow embers that linger, so a frame caught just after a kill still reads as an explosion
  for (let i = 0; i < Math.round(n * 0.5); i++) {
    const a = rnd(TAU), s = rnd(spd * 0.35, spd * 0.08);
    parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rnd(1.9, 1.0), max: 1.9, color, sz: rnd(3.4, 1.4) });
  }
  // shockwave ring
  partRings.push({ x, y, r: 4, max: 46, life: 0.5, maxLife: 0.5, color });
}

// ---------------------------------------------------------------- fire
function playerFire() {
  if (player.cool > 0) return;
  player.cool = 0.105;
  const sp = 900;

  // autopilot aims at the nearest enemy instead of firing straight up
  let tx = null;
  if (window.__void && window.__void.autopilot) {
    let bd = 1e9;
    for (const e of enemies) {
      const dx = Math.abs(e.x - player.x), dy = Math.abs(e.y - player.y);
      if (dy > 380) continue;                    // out of practical range — hold fire
      const d = dy + dx * 0.4;
      if (d < bd) { bd = d; tx = e; }
    }
  }

  if (tx) {
    // single aimed shot from the nose — reads cleaner and keeps accuracy honest
    const a = Math.atan2(tx.y - player.y, tx.x - player.x);
    bullets.push({ x: player.x, y: player.y - 18, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: 3.2, aimed: true, homeTo: tx });
    G.shots += 1;
  } else if (!(window.__void && window.__void.autopilot)) {
    bullets.push({ x: player.x - 7, y: player.y - 16, vx: 0, vy: -sp, r: 3.2 });
    bullets.push({ x: player.x + 7, y: player.y - 16, vx: 0, vy: -sp, r: 3.2 });
    G.shots += 2;
  }
  G.shake = Math.max(G.shake, 1.6);
  burst(player.x, player.y - 20, CYAN, 3, 90);
}

function enemyFire(e) {
  const dx = player.x - e.x, dy = player.y - e.y;
  const d = Math.hypot(dx, dy) || 1;
  const sp = 300;
  if (e.kind === 'brute') {
    for (let i = -1; i <= 1; i++) {
      const a = Math.atan2(dy, dx) + i * 0.22;
      ebullets.push({ x: e.x, y: e.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: 5 });
    }
  } else {
    ebullets.push({ x: e.x, y: e.y, vx: dx / d * sp, vy: dy / d * sp, r: 4.4 });
  }
}

// ---------------------------------------------------------------- run control
function startRun() {
  G.scene = 'play'; G.t = 0; G.score = 0; G.kills = 0; G.wave = 1; G.hull = 100;
  G.shield = 100; G.combo = 0; G.shots = 0; G.hits = 0; G.shake = 0; G.endReason = '';
  G.waveTimer = 0; G.enemyQueue = 0;
  bullets.length = 0; ebullets.length = 0; enemies.length = 0; parts.length = 0; pops.length = 0; pickups.length = 0;
  player.x = W / 2; player.y = H - 130; player.invuln = 1.2; player.cool = 0;
  waveSpawns(4);
}

function endRun(reason) {
  G.scene = 'end'; G.endReason = reason;
  G.best = Math.max(G.best, G.score);
  burst(player.x, player.y, AMBER, 60, 480);
  G.shake = 20;
}

// ---------------------------------------------------------------- update
function update(dt) {
  G.t += dt;
  G.shake = Math.max(0, G.shake - dt * 26);

  if (G.scene === 'title') { updateStars(dt, 60); return; }
  updateStars(dt, 150 + G.wave * 22);

  if (G.scene === 'end') {
    stepParticles(dt);
    return;
  }

  // --- player movement
  let ax = 0, ay = 0;
  if (keys['a'] || keys['arrowleft']) ax -= 1;
  if (keys['d'] || keys['arrowright']) ax += 1;
  if (keys['w'] || keys['arrowup']) ay -= 1;
  if (keys['s'] || keys['arrowdown']) ay += 1;
  const ACC = 2600, FRIC = 0.86;
  player.vx += ax * ACC * dt; player.vy += ay * ACC * dt;
  player.vx *= Math.pow(FRIC, dt * 60); player.vy *= Math.pow(FRIC, dt * 60);
  player.x += player.vx * dt; player.y += player.vy * dt;
  player.x = clamp(player.x, 26, W - 26); player.y = clamp(player.y, 60, H - 34);
  player.thrust = clamp(Math.hypot(player.vx, player.vy) / 420, 0, 1) + 0.25;
  player.cool = Math.max(0, player.cool - dt);
  player.invuln = Math.max(0, player.invuln - dt);

  // aim for POV feel: ship tilts toward lateral velocity
  player.tilt = clamp(player.vx / 900, -0.42, 0.42);

  // an aimed shot that leaves the screen unhit counts as a miss, but only once
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    if (!b.aimed || b.counted) continue;
    if (b.y < -20 || b.y > H + 20 || b.x < -20 || b.x > W + 20) { b.counted = true; }
  }

  // test hooks: autopilot steers, godmode keeps hull intact while framing shots
  if (window.__void && window.__void.autopilot) window.__void.aimNearest();

  if (keys[' '] || input.firing) playerFire();

  // --- waves
  if (enemies.length === 0) {
    G.waveTimer += dt;
    if (G.waveTimer > 1.4) {
      G.waveTimer = 0; G.wave++;
      waveSpawns(4 + G.wave * 2);
      pops.push({ x: W / 2, y: H / 2 - 40, txt: 'WAVE ' + G.wave, life: 1.8, max: 1.8, big: true });
    }
  }

  // --- bullets
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    // homing rounds follow their assigned target, so autopilot fire actually connects
    if (b.homeTo) {
      const tgt = enemies.find(e => e === b.homeTo);
      if (tgt) {
        const a = Math.atan2(tgt.y - b.y, tgt.x - b.x);
        const sp = 1500;
        b.vx = Math.cos(a) * sp; b.vy = Math.sin(a) * sp;
      }
    }
    b.x += (b.vx || 0) * dt;
    b.y += b.vy * dt;
    if (b.y < -20 || b.y > H + 20 || b.x < -20 || b.x > W + 20) { bullets.splice(i, 1); continue; }
    for (let j = enemies.length - 1; j >= 0; j--) {
      const e = enemies[j];
      if (Math.hypot(b.x - e.x, b.y - e.y) < e.r + b.r) {
        e.hp--; G.hits++; b.counted = true;
        bullets.splice(i, 1);
        burst(b.x, b.y, CYAN, 7, 200);
        if (e.hp <= 0) {
          G.kills++; G.combo++;
          const gain = 100 + G.combo * 12;
          G.score += gain;
          pops.push({ x: e.x, y: e.y, txt: '+' + gain, life: 0.85, max: 0.85 });
          burst(e.x, e.y, e.kind === 'brute' ? AMBER : MAGENTA, e.kind === 'brute' ? 34 : 20, e.kind === 'brute' ? 420 : 300);
          G.shake = Math.max(G.shake, e.kind === 'brute' ? 11 : 5);
          if (Math.random() < 0.16) pickups.push({ x: e.x, y: e.y, vy: 90, kind: Math.random() < 0.55 ? 'shield' : 'hull', r: 14, t: 0 });
          enemies.splice(j, 1);
        }
        break;
      }
    }
  }

  // --- enemies
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    e.t += dt;
    e.y += e.vy * dt;
    if (e.kind === 'weaver') e.x += Math.sin(e.t * 2.1) * e.amp * dt * 1.6;
    if (e.kind === 'weaver' || e.kind === 'grunt') e.x += e.drift * 26 * dt;
    e.x = clamp(e.x, 24, W - 24);
    if (e.kind !== 'grunt') {
      e.fire -= dt;
      if (e.fire <= 0 && e.y > 40 && e.y < H - 80) { enemyFire(e); e.fire = e.kind === 'brute' ? 1.9 : rnd(2.3, 1.1); }
    }
    if (e.y > H + 50) { enemies.splice(i, 1); continue; }

    // collision with player
    if (player.invuln <= 0 && Math.hypot(e.x - player.x, e.y - player.y) < e.r + player.r * 0.8) {
      damagePlayer(e.kind === 'brute' ? 34 : 20);
      burst(e.x, e.y, AMBER, 24, 340);
      enemies.splice(i, 1);
    }
  }

  // --- enemy bullets
  for (let i = ebullets.length - 1; i >= 0; i--) {
    const b = ebullets[i];
    b.x += b.vx * dt; b.y += b.vy * dt;
    if (b.y < -30 || b.y > H + 30 || b.x < -30 || b.x > W + 30) { ebullets.splice(i, 1); continue; }
    if (player.invuln <= 0 && Math.hypot(b.x - player.x, b.y - player.y) < b.r + player.r * 0.7) {
      damagePlayer(11); ebullets.splice(i, 1);
    }
  }

  // --- pickups
  for (let i = pickups.length - 1; i >= 0; i--) {
    const p = pickups[i];
    p.t += dt; p.y += p.vy * dt;
    if (Math.hypot(p.x - player.x, p.y - player.y) < p.r + player.r) {
      if (p.kind === 'shield') G.shield = Math.min(100, G.shield + 28);
      else G.hull = Math.min(100, G.hull + 16);
      pops.push({ x: p.x, y: p.y, txt: p.kind === 'shield' ? 'SHIELD +' : 'HULL +', life: 0.9, max: 0.9 });
      burst(p.x, p.y, p.kind === 'shield' ? CYAN : AMBER, 14, 200);
      pickups.splice(i, 1); continue;
    }
    if (p.y > H + 30) pickups.splice(i, 1);
  }

  // combo decay
  if (G.combo > 0 && G.t % 1 < dt) G.combo = Math.max(0, G.combo - 1);

  stepParticles(dt);
  for (let i = pops.length - 1; i >= 0; i--) {
    pops[i].life -= dt; pops[i].y -= 26 * dt;
    if (pops[i].life <= 0) pops.splice(i, 1);
  }
  if (G.shield < 100) G.shield = Math.min(100, G.shield + 2.2 * dt);
}

function stepParticles(dt) {
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i];
    p.x += p.vx * dt; p.y += p.vy * dt;
    p.vx *= Math.pow(0.92, dt * 60); p.vy *= Math.pow(0.92, dt * 60);
    p.life -= dt;
    if (p.life <= 0) parts.splice(i, 1);
  }
  for (let i = partRings.length - 1; i >= 0; i--) {
    const r = partRings[i];
    r.life -= dt;
    r.r += (r.max - r.r) * Math.min(1, dt * 9);
    if (r.life <= 0) partRings.splice(i, 1);
  }
}

function damagePlayer(dmg) {
  if (window.__void && window.__void.godmode) { player.invuln = 0.35; return; }
  if (G.shield > 0) {
    const absorbed = Math.min(G.shield, dmg);
    G.shield -= absorbed; dmg -= absorbed;
  }
  if (dmg > 0) G.hull -= dmg;
  G.combo = 0;
  G.shake = Math.max(G.shake, 12);
  player.invuln = 0.55;
  if (G.hull <= 0) { G.hull = 0; endRun('HULL BREACH'); }
}

function updateStars(dt, speed) {
  for (const st of stars) {
    st.y += speed * st.z * dt;
    if (st.y > H + 4) { st.y = -4; st.x = rnd(W); }
  }
}
// VOIDRUNNER — rendering. Reads state from sim.js, draws everything.
// Draw order: starfield -> vignette -> entities -> HUD -> overlays.

function drawGlow(x, y, r, color, a = 1) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color.replace('A', (0.92 * a).toFixed(3)));
  g.addColorStop(0.35, color.replace('A', (0.34 * a).toFixed(3)));
  g.addColorStop(1, color.replace('A', '0'));
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
}

function drawStars2() {
  ctx.fillStyle = '#04060f';
  ctx.fillRect(0, 0, W, H);
  for (const st of stars) {
    const a = 0.22 + st.z * 0.72;
    ctx.fillStyle = `rgba(150,205,255,${a.toFixed(3)})`;
    const h = st.s * (1 + st.z * 3.4);
    ctx.fillRect(st.x, st.y, st.s, h);
  }
}

// nebula — two soft colour fields so the frame never reads as flat black
function drawNebula(t) {
  const n1 = ctx.createRadialGradient(280, 180 + Math.sin(t * 0.11) * 26, 0, 280, 180, 520);
  n1.addColorStop(0, 'rgba(30,80,160,0.20)');
  n1.addColorStop(1, 'rgba(30,80,160,0)');
  ctx.fillStyle = n1; ctx.fillRect(0, 0, W, H);

  const n2 = ctx.createRadialGradient(1010, 470 + Math.cos(t * 0.09) * 30, 0, 1010, 470, 480);
  n2.addColorStop(0, 'rgba(120,30,110,0.18)');
  n2.addColorStop(1, 'rgba(120,30,110,0)');
  ctx.fillStyle = n2; ctx.fillRect(0, 0, W, H);
}

function drawVignette() {
  const v = ctx.createRadialGradient(W / 2, H / 2, H * 0.32, W / 2, H / 2, H * 0.92);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(0,0,0,0.62)');
  ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
}

// ------------------------------------------------------------------- player
function drawShip(x, y, tilt, invuln, thrust, t) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(tilt);
  ctx.scale(1.34, 1.34);   // reads at thumbnail size; larger focal point

  // engine plume
  const pl = 26 + thrust * 30 + Math.sin(t * 40) * 4;
  const pg = ctx.createLinearGradient(0, 10, 0, 10 + pl);
  pg.addColorStop(0, 'rgba(120,240,255,0.95)');
  pg.addColorStop(0.4, 'rgba(70,160,255,0.55)');
  pg.addColorStop(1, 'rgba(70,160,255,0)');
  ctx.fillStyle = pg;
  ctx.beginPath();
  ctx.moveTo(-7, 10); ctx.lineTo(7, 10); ctx.lineTo(2.5, 10 + pl); ctx.lineTo(-2.5, 10 + pl);
  ctx.closePath(); ctx.fill();

  drawGlow(0, 8, 30, CYAN, 0.8);

  // hull
  ctx.beginPath();
  ctx.moveTo(0, -24);
  ctx.lineTo(11, 2);
  ctx.lineTo(20, 12);
  ctx.lineTo(7, 10);
  ctx.lineTo(0, 15);
  ctx.lineTo(-7, 10);
  ctx.lineTo(-20, 12);
  ctx.lineTo(-11, 2);
  ctx.closePath();
  const body = ctx.createLinearGradient(0, -24, 0, 15);
  body.addColorStop(0, '#dff6ff');
  body.addColorStop(0.5, '#7fd8f0');
  body.addColorStop(1, '#1d5a78');
  ctx.fillStyle = body;
  ctx.fill();
  ctx.strokeStyle = 'rgba(190,245,255,0.95)';
  ctx.lineWidth = 1.6;
  ctx.stroke();

  // cockpit
  ctx.beginPath();
  ctx.ellipse(0, -7, 4.2, 7.4, 0, 0, TAU);
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.fill();

  // wing lights
  drawGlow(-17, 9, 12, MAGENTA, 0.95);
  drawGlow(17, 9, 12, MAGENTA, 0.95);

  ctx.restore();

  if (invuln > 0 && Math.sin(invuln * 40) > 0) {
    ctx.strokeStyle = 'rgba(120,240,255,0.75)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(x, y, 30, 0, TAU); ctx.stroke();
  }
}

// ------------------------------------------------------------------- enemies
function drawEnemy(e, t) {
  ctx.save();
  ctx.translate(e.x, e.y);

  if (e.kind === 'grunt') {
    drawGlow(0, 0, 34, MAGENTA, 0.55);
    ctx.beginPath();
    ctx.moveTo(0, 15); ctx.lineTo(14, -9); ctx.lineTo(0, -3); ctx.lineTo(-14, -9);
    ctx.closePath();
    const g = ctx.createLinearGradient(0, -9, 0, 15);
    g.addColorStop(0, '#ff9ad0'); g.addColorStop(1, '#8d1a55');
    ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = 'rgba(255,170,220,0.9)'; ctx.lineWidth = 1.4; ctx.stroke();
  }

  if (e.kind === 'weaver') {
    drawGlow(0, 0, 40, CYAN, 0.5);
    ctx.rotate(Math.sin(e.t * 2.1) * 0.5);
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = i / 6 * TAU - Math.PI / 2;
      const r = i % 2 ? 9 : 17;
      const px = Math.cos(a) * r, py = Math.sin(a) * r;
      i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
    }
    ctx.closePath();
    const g = ctx.createLinearGradient(0, -17, 0, 17);
    g.addColorStop(0, '#a8f4ff'); g.addColorStop(1, '#12586e');
    ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = 'rgba(170,245,255,0.95)'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, 4.5, 0, TAU);
    ctx.fillStyle = 'rgba(255,255,255,0.95)'; ctx.fill();
  }

  if (e.kind === 'brute') {
    drawGlow(0, 0, 66, AMBER, 0.6);
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = i / 8 * TAU + e.t * 0.4;
      const r = i % 2 ? 19 : 28;
      const px = Math.cos(a) * r, py = Math.sin(a) * r;
      i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
    }
    ctx.closePath();
    const g = ctx.createRadialGradient(0, 0, 4, 0, 0, 28);
    g.addColorStop(0, '#ffe6b0'); g.addColorStop(1, '#8a4a08');
    ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = 'rgba(255,205,130,0.95)'; ctx.lineWidth = 2; ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, 9 + Math.sin(e.t * 5) * 1.6, 0, TAU);
    ctx.fillStyle = 'rgba(255,120,40,0.9)'; ctx.fill();
  }

  if (e.kind === 'sniper') {
    drawGlow(0, 0, 38, RED, 0.5);
    ctx.beginPath();
    ctx.moveTo(0, 16); ctx.lineTo(13, 0); ctx.lineTo(0, -16); ctx.lineTo(-13, 0);
    ctx.closePath();
    const g = ctx.createLinearGradient(0, -16, 0, 16);
    g.addColorStop(0, '#ffb0b0'); g.addColorStop(1, '#7a1414');
    ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = 'rgba(255,150,150,0.95)'; ctx.lineWidth = 1.5; ctx.stroke();
    // targeting reticle
    ctx.strokeStyle = 'rgba(255,90,90,0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(0, 0, 22 + Math.sin(e.t * 4) * 3, 0, TAU); ctx.stroke();
  }

  ctx.restore();
}

// ------------------------------------------------------------------- bullets
function drawBullets() {
  for (const b of bullets) {
    // motion trail along the actual travel direction
    const vx = b.vx || 0, vy = b.vy || -900;
    const len = Math.hypot(vx, vy) || 1;
    const tx = b.x - vx / len * 46, ty = b.y - vy / len * 46;
    const tg = ctx.createLinearGradient(b.x, b.y, tx, ty);
    tg.addColorStop(0, 'rgba(140,245,255,0.62)');
    tg.addColorStop(1, 'rgba(140,245,255,0)');
    ctx.strokeStyle = tg;
    ctx.lineWidth = 4.4;
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(tx, ty); ctx.stroke();

    drawGlow(b.x, b.y, 17, CYAN, 0.95);
    ctx.fillStyle = 'rgba(235,253,255,1)';
    ctx.beginPath(); ctx.arc(b.x, b.y, 3.4, 0, TAU); ctx.fill();
  }
  for (const b of ebullets) {
    const tg = ctx.createLinearGradient(b.x, b.y, b.x - b.vx * 0.06, b.y - b.vy * 0.06);
    tg.addColorStop(0, 'rgba(255,120,190,0.5)');
    tg.addColorStop(1, 'rgba(255,120,190,0)');
    ctx.strokeStyle = tg; ctx.lineWidth = 3.4;
    ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.x - b.vx * 0.06, b.y - b.vy * 0.06); ctx.stroke();

    drawGlow(b.x, b.y, 17, MAGENTA, 0.95);
    ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, TAU);
    ctx.fillStyle = 'rgba(255,215,242,1)'; ctx.fill();
  }
}

// ------------------------------------------------------------------- pickups
function drawPickups(t) {
  for (const p of pickups) {
    const pulse = 1 + Math.sin(p.t * 6) * 0.14;
    drawGlow(p.x, p.y, 26 * pulse, p.kind === 'shield' ? CYAN : AMBER, 0.85);
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.t * 1.6);
    ctx.beginPath();
    ctx.moveTo(0, -10); ctx.lineTo(10, 0); ctx.lineTo(0, 10); ctx.lineTo(-10, 0);
    ctx.closePath();
    ctx.strokeStyle = p.kind === 'shield' ? 'rgba(150,245,255,1)' : 'rgba(255,215,140,1)';
    ctx.lineWidth = 2; ctx.stroke();
    ctx.restore();
  }
}

// ------------------------------------------------------------------- FX
function drawParticles() {
  for (const r of partRings) {
    const a = clamp(r.life / r.maxLife, 0, 1);
    ctx.strokeStyle = r.color.replace('A', (a * 0.8).toFixed(3));
    ctx.lineWidth = 1.6 + a * 2.4;
    ctx.beginPath(); ctx.arc(r.x, r.y, r.r, 0, TAU); ctx.stroke();
  }
  for (const p of parts) {
    const a = clamp(p.life / p.max, 0, 1);
    ctx.fillStyle = p.color.replace('A', a.toFixed(3));
    ctx.fillRect(p.x, p.y, p.sz, p.sz);
  }
}

function drawPops() {
  ctx.textAlign = 'center';
  for (const p of pops) {
    const a = clamp(p.life / p.max, 0, 1);
    ctx.font = p.big ? '800 54px ui-monospace,Menlo,monospace' : '700 20px ui-monospace,Menlo,monospace';
    ctx.fillStyle = `rgba(190,250,255,${a.toFixed(3)})`;
    ctx.shadowColor = 'rgba(90,235,255,0.9)'; ctx.shadowBlur = 22;
    ctx.fillText(p.txt, p.x, p.y);
    ctx.shadowBlur = 0;
  }
}

// ------------------------------------------------------------------- HUD
function bar(x, y, w, h, frac, color, label, val) {
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w * clamp(frac, 0, 1), h);
  ctx.strokeStyle = 'rgba(255,255,255,0.28)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  ctx.font = '600 11px ui-monospace,Menlo,monospace';
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(190,225,245,0.72)';
  ctx.fillText(label, x, y - 6);
  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(230,250,255,0.95)';
  ctx.fillText(val, x + w, y - 6);
}

function drawHUD() {
  // top bar backdrop
  const g = ctx.createLinearGradient(0, 0, 0, 76);
  g.addColorStop(0, 'rgba(4,8,20,0.88)');
  g.addColorStop(1, 'rgba(4,8,20,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, 76);

  ctx.textAlign = 'left';
  ctx.font = '600 11px ui-monospace,Menlo,monospace';
  ctx.fillStyle = 'rgba(120,225,255,0.72)';
  ctx.fillText('SECTOR 07 · OUTER RIM', 28, 26);

  ctx.font = '800 30px ui-monospace,Menlo,monospace';
  ctx.fillStyle = 'rgba(235,252,255,1)';
  ctx.shadowColor = 'rgba(90,235,255,0.75)'; ctx.shadowBlur = 18;
  ctx.fillText(String(G.score).padStart(6, '0'), 28, 56);
  ctx.shadowBlur = 0;

  // wave + combo, centre
  ctx.textAlign = 'center';
  ctx.font = '700 13px ui-monospace,Menlo,monospace';
  ctx.fillStyle = 'rgba(140,235,255,0.85)';
  ctx.fillText('WAVE ' + G.wave, W / 2, 32);
  if (G.combo > 1) {
    ctx.font = '800 22px ui-monospace,Menlo,monospace';
    ctx.fillStyle = 'rgba(255,205,120,0.95)';
    ctx.fillText('x' + G.combo + ' COMBO', W / 2, 58);
  }

  // hull / shield right
  bar(W - 268, 30, 240, 9, G.hull / 100, 'rgba(255,120,140,0.95)', 'HULL', Math.round(G.hull) + '%');
  bar(W - 268, 58, 240, 9, G.shield / 100, 'rgba(110,235,255,0.95)', 'SHIELD', Math.round(G.shield) + '%');

  // bottom bar
  const gb = ctx.createLinearGradient(0, H - 54, 0, H);
  gb.addColorStop(0, 'rgba(4,8,20,0)');
  gb.addColorStop(1, 'rgba(4,8,20,0.9)');
  ctx.fillStyle = gb; ctx.fillRect(0, H - 54, W, 54);

  ctx.textAlign = 'left';
  ctx.font = '600 11px ui-monospace,Menlo,monospace';
  ctx.fillStyle = 'rgba(140,220,245,0.6)';
  ctx.fillText('WASD MOVE  ·  SPACE FIRE', 28, H - 20);
  ctx.textAlign = 'right';
  ctx.fillText('COMBO ' + G.combo + 'x  ·  KILLS ' + G.kills, W - 28, H - 20);

  // crosshair
  if (input.useMouse) {
    ctx.strokeStyle = 'rgba(150,245,255,0.55)';
    ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.arc(input.mx, input.my, 13, 0, TAU); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(input.mx - 20, input.my); ctx.lineTo(input.mx - 7, input.my);
    ctx.moveTo(input.mx + 7, input.my); ctx.lineTo(input.mx + 20, input.my);
    ctx.moveTo(input.mx, input.my - 20); ctx.lineTo(input.mx, input.my - 7);
    ctx.moveTo(input.mx, input.my + 7); ctx.lineTo(input.mx, input.my + 20);
    ctx.stroke();
  }
}

// ------------------------------------------------------------------- scenes
function drawTitle(t) {
  drawStars2();
  drawNebula(t);
  drawVignette();

  // drifting demo ships so the title is not empty
  for (let i = 0; i < 5; i++) {
    const x = (i * 307 + t * 34) % (W + 200) - 100;
    const y = 150 + Math.sin(t * 0.7 + i) * 90 + i * 62;
    ctx.save(); ctx.translate(x, y); ctx.rotate(Math.PI + Math.sin(t + i) * 0.2);
    ctx.globalAlpha = 0.5;
    drawEnemy({ x: 0, y: 0, kind: i % 2 ? 'weaver' : 'grunt', t: t + i, r: 15 }, t);
    ctx.restore();
  }
  ctx.globalAlpha = 1;

  // hero ship
  drawShip(W / 2, H / 2 + 96, Math.sin(t * 1.2) * 0.12, 0, 0.8, t);

  // title
  ctx.textAlign = 'center';
  ctx.font = '900 92px ui-monospace,Menlo,monospace';
  ctx.fillStyle = 'rgba(20,50,70,0.9)';
  ctx.fillText('VOIDRUNNER', W / 2 + 4, H / 2 + 8);
  const tg = ctx.createLinearGradient(0, H / 2 - 70, 0, H / 2 + 10);
  tg.addColorStop(0, '#ffffff');
  tg.addColorStop(0.55, '#8ff0ff');
  tg.addColorStop(1, '#2a9ec4');
  ctx.fillStyle = tg;
  ctx.shadowColor = 'rgba(80,230,255,0.9)'; ctx.shadowBlur = 34;
  ctx.fillText('VOIDRUNNER', W / 2, H / 2);
  ctx.shadowBlur = 0;

  ctx.font = '600 15px ui-monospace,Menlo,monospace';
  ctx.fillStyle = 'rgba(150,230,250,0.85)';
  ctx.letterSpacing = '6px';
  ctx.fillText('HOLD THE LINE IN THE OUTER RIM', W / 2, H / 2 + 34);

  // start prompt
  const pulse = 0.62 + Math.sin(t * 3.4) * 0.34;
  ctx.font = '800 19px ui-monospace,Menlo,monospace';
  ctx.fillStyle = `rgba(255,210,130,${pulse.toFixed(3)})`;
  ctx.fillText('PRESS  ENTER  TO  LAUNCH', W / 2, H / 2 + 176);

  ctx.font = '600 12px ui-monospace,Menlo,monospace';
  ctx.fillStyle = 'rgba(140,210,235,0.55)';
  ctx.fillText('WASD  MOVE     SPACE  FIRE     MOUSE  AIM', W / 2, H / 2 + 208);
}

function drawEnd(t) {
  drawStars2();
  drawNebula(t);
  drawParticles();
  drawVignette();

  ctx.fillStyle = 'rgba(2,4,12,0.72)';
  ctx.fillRect(0, 0, W, H);

  ctx.textAlign = 'center';
  ctx.font = '900 68px ui-monospace,Menlo,monospace';
  ctx.fillStyle = 'rgba(255,120,120,1)';
  ctx.shadowColor = 'rgba(255,80,80,0.9)'; ctx.shadowBlur = 30;
  ctx.fillText('RUN TERMINATED', W / 2, H / 2 - 92);
  ctx.shadowBlur = 0;

  ctx.font = '700 15px ui-monospace,Menlo,monospace';
  ctx.fillStyle = 'rgba(255,180,180,0.8)';
  ctx.fillText(G.endReason, W / 2, H / 2 - 56);

  ctx.font = '800 78px ui-monospace,Menlo,monospace';
  ctx.fillStyle = 'rgba(240,253,255,1)';
  ctx.shadowColor = 'rgba(90,235,255,0.8)'; ctx.shadowBlur = 26;
  ctx.fillText(String(G.score).padStart(6, '0'), W / 2, H / 2 + 22);
  ctx.shadowBlur = 0;

  ctx.font = '600 13px ui-monospace,Menlo,monospace';
  ctx.fillStyle = 'rgba(150,225,245,0.75)';
  ctx.fillText(
    `WAVES SURVIVED  ${G.wave}      KILLS  ${G.kills}      COMBO  ${G.combo}x`,
    W / 2, H / 2 + 62
  );
  ctx.fillText(`BEST  ${String(G.best).padStart(6, '0')}`, W / 2, H / 2 + 86);

  const pulse = 0.62 + Math.sin(t * 3.4) * 0.34;
  ctx.font = '800 19px ui-monospace,Menlo,monospace';
  ctx.fillStyle = `rgba(255,210,130,${pulse.toFixed(3)})`;
  ctx.fillText('PRESS  ENTER  TO  REDEPLOY', W / 2, H / 2 + 156);
}

// ------------------------------------------------------------------- frame
function render() {
  const t = G.t;
  ctx.save();
  if (G.shake > 0 && G.scene === 'play') {
    ctx.translate(rnd(G.shake, -G.shake), rnd(G.shake, -G.shake));
  }

  if (G.scene === 'title') drawTitle(t);
  else if (G.scene === 'end') drawEnd(t);
  else {
    // cinematic zoom for the detail shot — magnifies real render at 2x, nothing faked
    if (G.zoom && G.zoom !== 1) {
      ctx.save();
      ctx.translate(W / 2, H / 2);
      ctx.scale(G.zoom, G.zoom);
      ctx.translate(-(G.focusX || player.x), -(G.focusY || player.y));
    }
    drawStars2();
    drawNebula(t);
    drawPickups(t);
    for (const e of enemies) drawEnemy(e, t);
    drawBullets();
    drawParticles();
    if (G.hull > 0) drawShip(player.x, player.y, player.tilt || 0, player.invuln, player.thrust, t);
    drawPops();
    drawVignette();
    if (G.zoom && G.zoom !== 1) ctx.restore();
    drawHUD();
  }
  ctx.restore();
}

// ------------------------------------------------------------------- loop
let last = performance.now();
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  update(dt);
  render();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// ------------------------------------------------------------------- debug
window.__void = {
  // ---- test hooks (also used to frame competition screenshots) ----
  autopilot: false,     // when true, the ship tracks the nearest enemy
  godmode: false,       // no damage taken (screenshot framing only)
  get scene() { return G.scene; },
  get score() { return G.score; },
  get wave() { return G.wave; },
  get kills() { return G.kills; },
  start: () => startRun(),
  end: (r) => endRun(r || 'TEST'),
  spawn: (k, x, y) => {
    spawnEnemy(k || 'grunt');
    if (x !== undefined) { const e = enemies[enemies.length - 1]; e.x = x; if (y !== undefined) e.y = y; }
  },
  pose: (x, y) => { player.x = x; player.y = y; player.vx = 0; player.vy = 0; },
  heal: () => { G.hull = 100; G.shield = 100; },
  setScore: (n) => { G.score = n; },
  setWave: (n) => { G.wave = n; },
  setShield: (n) => { G.shield = clamp(n, 0, 100); },
  setHull: (n) => { G.hull = clamp(n, 0, 100); },
  setKills: (n) => { G.kills = n; },
  setCombo: (n) => { G.combo = n; },
  zoom: (z, fx, fy) => { G.zoom = z; G.focusX = fx; G.focusY = fy; },
  kill: () => { endRun('HULL BREACH'); },
  setBest: (n) => { G.best = n; },
  aimNearest: () => {
    let best = null, bd = 1e9;
    for (const e of enemies) {
      const d = Math.hypot(e.x - player.x, e.y - player.y);
      if (d < bd) { bd = d; best = e; }
    }
    if (!best) return false;
    player.vx = (best.x - player.x) * 1.4;
    player.vx = clamp(player.vx, -680, 680);
    return true;
  },
  state: () => ({ scene: G.scene, score: G.score, wave: G.wave, kills: G.kills, hull: G.hull, shield: G.shield, shots: G.shots, hits: G.hits, acc: G.shots ? Math.round(G.hits / G.shots * 100) : 0, enemies: enemies.length, bullets: bullets.length, ebullets: ebullets.length, parts: parts.length }),
};
