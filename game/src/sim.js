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
