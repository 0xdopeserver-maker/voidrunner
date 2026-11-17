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
