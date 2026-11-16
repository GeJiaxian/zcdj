/* =========================================================
   一笔连线 · 连连看
   相同图标用一条最多两次转弯的线连起来
   ========================================================= */
'use strict';

PuzzleSub.link = function (stage, api) {
  const W = 960, H = 600;
  const canvas = makeCanvas(stage, W, H);
  const ctx = canvas.getContext('2d');
  const COLS = 10, ROWS = 6, CELL = 62;
  const BX = (W - COLS * CELL) / 2, BY = 108;
  const PAD_R = ROWS + 2, PAD_C = COLS + 2;
  const TOTAL_TIME = 180;
  const TYPES = 8;

  let grid = [], tiles = [], selected = null, hintPair = null, hintTimer = 0;
  let score = 0, combo = 0, maxCombo = 0, cleared = 0, timeLeft = TOTAL_TIME;
  let hints = 3, shuffles = 2;
  let paused = false, over = false, destroyed = false;
  let raf = 0, last = 0;
  let pathAnim = null;
  let notice = '', noticeTimer = 0;
  let effects = [];
  let win = false;

  const DR = [-1, 1, 0, 0], DC = [0, 0, -1, 1];

  function build() {
    const pool = [];
    for (let t = 0; t < TYPES; t++) for (let k = 0; k < 6; k++) pool.push(t);
    const arr = shuffle(pool);
    grid = Array.from({ length: PAD_R }, () => Array(PAD_C).fill(null));
    tiles = [];
    let i = 0;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const t = arr[i++];
        grid[r + 1][c + 1] = t;
        tiles.push({ r: r + 1, c: c + 1, type: t, removed: false, pop: 0 });
      }
    }
    if (!findAnyPair()) build();
  }

  function tileAt(r, c) {
    return tiles.find(t => !t.removed && t.r === r && t.c === c) || null;
  }

  function findPath(r1, c1, r2, c2) {
    const start = { r: r1, c: c1, dir: -1, turns: 0, path: [[r1, c1]] };
    const queue = [start];
    const seen = new Map();
    let qi = 0;
    while (qi < queue.length) {
      const cur = queue[qi++];
      for (let d = 0; d < 4; d++) {
        const nr = cur.r + DR[d], nc = cur.c + DC[d];
        if (nr < 0 || nr > PAD_R - 1 || nc < 0 || nc > PAD_C - 1) continue;
        const isTarget = nr === r2 && nc === c2;
        if (!isTarget && grid[nr][nc] !== null) continue;
        const nt = cur.turns + (cur.dir === -1 || cur.dir === d ? 0 : 1);
        if (nt > 2) continue;
        const key = nr + ',' + nc + ',' + d;
        if (seen.has(key) && seen.get(key) <= nt) continue;
        seen.set(key, nt);
        const path = cur.path.concat([[nr, nc]]);
        if (isTarget) return path;
        queue.push({ r: nr, c: nc, dir: d, turns: nt, path });
      }
    }
    return null;
  }

  function findAnyPair() {
    const live = tiles.filter(t => !t.removed);
    for (let i = 0; i < live.length; i++) {
      for (let j = i + 1; j < live.length; j++) {
        if (live[i].type !== live[j].type) continue;
        const p = findPath(live[i].r, live[i].c, live[j].r, live[j].c);
        if (p) return [live[i], live[j], p];
      }
    }
    return null;
  }

  function compress(path) {
    if (path.length <= 2) return path;
    const out = [path[0]];
    for (let i = 1; i < path.length - 1; i++) {
      const a = path[i - 1], b = path[i], c = path[i + 1];
      const sameX = a[1] === b[1] && b[1] === c[1];
      const sameY = a[0] === b[0] && b[0] === c[0];
      if (!sameX && !sameY) out.push(b);
    }
    out.push(path[path.length - 1]);
    return out;
  }

  function cellCenter(p) {
    return { x: BX + (p.c - 1) * CELL + CELL / 2, y: BY + (p.r - 1) * CELL + CELL / 2 };
  }

  function tryPick(t) {
    if (paused || over || pathAnim) return;
    if (!selected) {
      selected = t;
      Sfx.play('click');
      return;
    }
    if (selected === t) {
      selected = null;
      return;
    }
    if (selected.type !== t.type) {
      selected = t;
      Sfx.play('click');
      return;
    }
    const path = findPath(selected.r, selected.c, t.r, t.c);
    if (!path) {
      selected = t;
      Sfx.play('wrong');
      notice = '这两个图标连不起来';
      noticeTimer = 1.2;
      return;
    }
    const a = selected;
    selected = null;
    hintPair = null;
    pathAnim = { path: compress(path), t: 0, a, b: t };
    Sfx.play('pop');
  }

  function finishAnim() {
    const { a, b } = pathAnim;
    a.removed = true;
    b.removed = true;
    grid[a.r][a.c] = null;
    grid[b.r][b.c] = null;
    combo++;
    maxCombo = Math.max(maxCombo, combo);
    cleared++;
    score += 100 + Math.min(combo, 10) * 15;
    effects.push({ x: cellCenter(a).x, y: cellCenter(a).y, life: 0.6, color: '#FFD97D' });
    pathAnim = null;
    if (tiles.every(t => t.removed)) {
      win = true;
      over = true;
      setTimeout(() => endGame(), 420);
      return;
    }
    if (!findAnyPair()) {
      if (shuffles > 0) {
        shuffles--;
        doShuffle(true);
        notice = '没有可连的啦，自动重排';
        noticeTimer = 1.6;
      } else {
        win = false;
        over = true;
        setTimeout(() => endGame(), 420);
      }
    }
  }

  function doShuffle(auto = false) {
    const live = tiles.filter(t => !t.removed);
    const types = shuffle(live.map(t => t.type));
    // 多次尝试，尽量保证有解
    for (let attempt = 0; attempt < 30; attempt++) {
      live.forEach((t, i) => {
        t.type = types[i];
        grid[t.r][t.c] = t.type;
      });
      if (findAnyPair()) break;
      shuffle(types);
      if (attempt % 2 === 1) types.push(types.shift());
    }
    selected = null;
    hintPair = null;
    Sfx.play('step');
  }

  function useHint() {
    if (over || paused || hints <= 0) return;
    const pair = findAnyPair();
    if (!pair) return;
    hints--;
    score = Math.max(0, score - 30);
    hintPair = pair;
    hintTimer = 1.6;
    Sfx.play('note');
  }

  /* ---------------- 点击 ---------------- */
  const buttons = [
    { id: 'hint', x: 690, y: 520, w: 110, h: 40 },
    { id: 'shuffle', x: 812, y: 520, w: 110, h: 40 }
  ];

  function onClick(e) {
    if (paused || over) return;
    const p = canvasPos(canvas, e);
    for (const b of buttons) {
      if (p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h) {
        if (b.id === 'hint') useHint();
        else if (shuffles > 0) { shuffles--; doShuffle(); }
        else { notice = '重排次数用完了'; noticeTimer = 1.2; Sfx.play('wrong'); }
        return;
      }
    }
    const c = Math.floor((p.x - BX) / CELL) + 1;
    const r = Math.floor((p.y - BY) / CELL) + 1;
    if (r < 1 || r > ROWS || c < 1 || c > COLS) return;
    const t = tileAt(r, c);
    if (t) tryPick(t);
  }
  canvas.addEventListener('pointerdown', onClick);

  /* ---------------- 图标 ---------------- */
  function drawIcon(type, x, y, s) {
    ctx.save();
    ctx.translate(x, y);
    if (type === 0) { // 番茄
      ctx.fillStyle = '#E8745B';
      ctx.beginPath(); ctx.arc(0, 2, s * 0.3, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#9E3F2C'; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = '#5A9A5F';
      for (let i = 0; i < 3; i++) {
        ctx.save(); ctx.rotate(i * 2.1 - 0.6);
        ctx.beginPath(); ctx.ellipse(0, -s * 0.3, s * 0.12, s * 0.05, 0, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }
    } else if (type === 1) { // 包子
      ctx.fillStyle = '#FFF6E0';
      ctx.beginPath();
      ctx.arc(0, 0, s * 0.3, Math.PI, 0);
      ctx.quadraticCurveTo(s * 0.3, s * 0.26, 0, s * 0.26);
      ctx.quadraticCurveTo(-s * 0.3, s * 0.26, -s * 0.3, 0);
      ctx.fill();
      ctx.strokeStyle = '#B98E63'; ctx.lineWidth = 2; ctx.stroke();
      ctx.strokeStyle = 'rgba(185,142,99,.9)';
      ctx.beginPath();
      ctx.moveTo(0, -s * 0.22); ctx.lineTo(0, s * 0.02);
      ctx.moveTo(-s * 0.12, -s * 0.14); ctx.lineTo(0, 0);
      ctx.moveTo(s * 0.12, -s * 0.14); ctx.lineTo(0, 0);
      ctx.stroke();
    } else if (type === 2) { // 鸡腿
      ctx.save(); ctx.rotate(0.55);
      ctx.fillStyle = '#C98A5B';
      ctx.beginPath(); ctx.ellipse(0, -s * 0.04, s * 0.22, s * 0.26, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#6E4A32'; ctx.lineWidth = 2; ctx.stroke();
      ctx.strokeStyle = '#FFF6E0'; ctx.lineWidth = s * 0.12; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(0, s * 0.2); ctx.lineTo(s * 0.16, s * 0.34); ctx.stroke();
      ctx.restore();
    } else if (type === 3) { // 奶茶
      Draw.fillRR(ctx, -s * 0.18, -s * 0.16, s * 0.36, s * 0.46, 4, '#F2C6A0', '#3B2F2A', 2);
      ctx.fillStyle = 'rgba(139,94,60,.55)';
      ctx.fillRect(-s * 0.16, 0, s * 0.32, s * 0.14);
      ctx.strokeStyle = '#3B2F2A'; ctx.lineWidth = 2.4;
      ctx.beginPath(); ctx.moveTo(s * 0.08, -s * 0.16); ctx.lineTo(s * 0.2, -s * 0.4); ctx.stroke();
    } else if (type === 4) { // 书
      Draw.fillRR(ctx, -s * 0.28, -s * 0.22, s * 0.56, s * 0.44, 3, '#6E8FB8', '#3B2F2A', 2);
      ctx.fillStyle = '#FFFDF5';
      ctx.fillRect(-s * 0.22, -s * 0.16, s * 0.44, s * 0.32);
      ctx.strokeStyle = 'rgba(59,47,42,.35)'; ctx.lineWidth = 1.4;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(-s * 0.16, -s * 0.08 + i * s * 0.1);
        ctx.lineTo(s * 0.16, -s * 0.08 + i * s * 0.1);
        ctx.stroke();
      }
    } else if (type === 5) { // 笔
      ctx.save(); ctx.rotate(-0.6);
      Draw.fillRR(ctx, -s * 0.06, -s * 0.3, s * 0.12, s * 0.46, 2, '#F5C451', '#3B2F2A', 2);
      ctx.fillStyle = '#3B2F2A';
      ctx.beginPath();
      ctx.moveTo(-s * 0.06, s * 0.16); ctx.lineTo(s * 0.06, s * 0.16); ctx.lineTo(0, s * 0.3);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#F2A6A6';
      ctx.fillRect(-s * 0.06, -s * 0.3, s * 0.12, s * 0.08);
      ctx.restore();
    } else if (type === 6) { // 小苗
      ctx.strokeStyle = '#3E8257'; ctx.lineWidth = 3; ctx.beginPath();
      ctx.moveTo(0, s * 0.3); ctx.lineTo(0, -s * 0.02); ctx.stroke();
      ctx.fillStyle = '#7BC96F';
      ctx.beginPath(); ctx.ellipse(-s * 0.12, -s * 0.1, s * 0.16, s * 0.09, -0.5, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#2E6B45'; ctx.lineWidth = 1.6; ctx.stroke();
      ctx.beginPath(); ctx.ellipse(s * 0.12, -s * 0.16, s * 0.14, s * 0.08, 0.5, 0, Math.PI * 2); ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#8B5E3C';
      ctx.beginPath(); ctx.ellipse(0, s * 0.3, s * 0.16, s * 0.06, 0, 0, Math.PI * 2); ctx.fill();
    } else { // 冰淇淋
      ctx.fillStyle = '#D9A15E';
      ctx.beginPath();
      ctx.moveTo(-s * 0.16, s * 0.06); ctx.lineTo(s * 0.16, s * 0.06); ctx.lineTo(0, s * 0.36);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#3B2F2A'; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = '#FF9FB8';
      ctx.beginPath(); ctx.arc(0, -s * 0.04, s * 0.2, 0, Math.PI * 2); ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#FFFDF5';
      ctx.beginPath(); ctx.arc(-s * 0.04, -s * 0.14, s * 0.12, 0, Math.PI * 2); ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }

  /* ---------------- 绘制 ---------------- */
  function drawBg() {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#20313A');
    g.addColorStop(1, '#16232A');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    // 书架
    ctx.fillStyle = 'rgba(255,255,255,.035)';
    for (let i = 0; i < 6; i++) ctx.fillRect(20 + i * 160, 40, 120, 6);
    // 棋盘
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,.35)';
    ctx.shadowBlur = 20;
    ctx.shadowOffsetY = 8;
    Draw.fillRR(ctx, BX - 14, BY - 14, COLS * CELL + 28, ROWS * CELL + 28, 18, '#EBD7AE', '#3B2F2A', 4);
    ctx.restore();
    Draw.fillRR(ctx, BX - 4, BY - 4, COLS * CELL + 8, ROWS * CELL + 8, 12, '#F7EACB', '#C9B48F', 2);
    ctx.strokeStyle = 'rgba(160, 130, 90, .2)';
    ctx.lineWidth = 1;
    for (let r = 0; r <= ROWS; r++) {
      ctx.beginPath();
      ctx.moveTo(BX, BY + r * CELL);
      ctx.lineTo(BX + COLS * CELL, BY + r * CELL);
      ctx.stroke();
    }
    for (let c = 0; c <= COLS; c++) {
      ctx.beginPath();
      ctx.moveTo(BX + c * CELL, BY);
      ctx.lineTo(BX + c * CELL, BY + ROWS * CELL);
      ctx.stroke();
    }
  }

  function drawTiles() {
    tiles.forEach(t => {
      if (t.removed) return;
      const p = cellCenter(t);
      const isSel = selected === t;
      const isHint = hintPair && (hintPair[0] === t || hintPair[1] === t);
      const pulse = isHint ? 1 + Math.sin(nowSec() * 10) * 0.04 : 1;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.scale(pulse, pulse);
      ctx.fillStyle = 'rgba(120, 84, 40, .18)';
      Draw.rr(ctx, -CELL / 2 + 4, -CELL / 2 + 5, CELL - 8, CELL - 8, 10);
      ctx.fill();
      Draw.fillRR(ctx, -CELL / 2 + 4, -CELL / 2 + 4, CELL - 8, CELL - 8, 10, '#FFFDF3',
        isSel ? '#57A773' : isHint ? '#E8A33D' : '#C9B48F', isSel || isHint ? 4 : 2);
      if (isSel) {
        ctx.strokeStyle = 'rgba(87,167,115,.35)';
        ctx.lineWidth = 8;
        Draw.rr(ctx, -CELL / 2 + 4, -CELL / 2 + 4, CELL - 8, CELL - 8, 10);
        ctx.stroke();
      }
      drawIcon(t.type, 0, 0, CELL);
      ctx.restore();
    });
  }

  function drawPathAnim() {
    if (!pathAnim) return;
    const { path, t: prog } = pathAnim;
    const pts = path.map(cellCenter);
    // 进度裁剪
    const total = pts.length - 1;
    const shown = total * clamp(prog / 0.3, 0, 1);
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(255, 217, 125, .35)';
    ctx.lineWidth = 14;
    ctx.beginPath();
    let acc = 0;
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) {
      const segLen = 1;
      if (acc + segLen <= shown) {
        ctx.lineTo(pts[i].x, pts[i].y);
        acc += segLen;
      } else {
        const f = shown - acc;
        ctx.lineTo(lerp(pts[i - 1].x, pts[i].x, f), lerp(pts[i - 1].y, pts[i].y, f));
        break;
      }
    }
    ctx.stroke();
    ctx.strokeStyle = '#FFF6D8';
    ctx.lineWidth = 5;
    ctx.stroke();
    ctx.restore();
  }

  function drawHUD() {
    Draw.text(ctx, '一 笔 连 线', 36, 34, 24, '#FFE9A8', 'left', 'bold', 'rgba(0,0,0,.4)', 4);
    Draw.text(ctx, '相同的两个图标，一笔相连，最多转两次弯', 38, 58, 11, 'rgba(255,255,255,.5)', 'left');
    Draw.text(ctx, '得分', 40, 88, 11, 'rgba(255,255,255,.45)', 'left');
    Draw.text(ctx, fmtScore(score), 76, 88, 18, '#FFFDF5', 'left');
    // 连击
    if (combo >= 2) {
      Draw.text(ctx, '连击 ×' + combo, 470, 44, 15, '#FFD97D', 'center', 'bold', 'rgba(0,0,0,.35)', 3);
    }
    // 时间
    const tw = 210, tx = 700, ty = 30;
    Draw.fillRR(ctx, tx, ty, tw, 12, 6, 'rgba(255,255,255,.15)', null);
    const ratio = clamp(timeLeft / TOTAL_TIME, 0, 1);
    Draw.fillRR(ctx, tx, ty, Math.max(4, tw * ratio), 12, 6, ratio < 0.2 ? '#E8745B' : '#7BC96F', null);
    Draw.text(ctx, Math.ceil(timeLeft) + 's', tx + tw + 26, ty + 6, 13, timeLeft < 30 ? '#FF9A86' : '#FFFDF5');
    Draw.text(ctx, '剩余 ' + tiles.filter(t => !t.removed).length / 2 + ' 对', 40, 520, 12, 'rgba(255,255,255,.55)', 'left');

    // 按钮
    buttons.forEach(b => {
      const disabled = (b.id === 'hint' && hints <= 0) || (b.id === 'shuffle' && shuffles <= 0);
      const label = b.id === 'hint' ? '提示 ×' + hints : '重排 ×' + shuffles;
      Draw.fillRR(ctx, b.x, b.y, b.w, b.h, 20,
        disabled ? 'rgba(255,255,255,.06)' : 'rgba(255,217,125,.14)',
        disabled ? 'rgba(255,255,255,.15)' : '#E8A33D', 2);
      Draw.text(ctx, label, b.x + b.w / 2, b.y + b.h / 2, 13, disabled ? 'rgba(255,255,255,.3)' : '#FFE9A8');
    });

    // 通知
    if (noticeTimer > 0) {
      ctx.globalAlpha = clamp(noticeTimer * 2, 0, 1);
      Draw.fillRR(ctx, 300, 470, 360, 30, 15, 'rgba(232,116,91,.9)', 'rgba(255,255,255,.4)', 1);
      Draw.text(ctx, notice, 480, 485, 12, '#FFFDF5');
      ctx.globalAlpha = 1;
    }
    // 底部提示
    Draw.fillRR(ctx, 40, 556, 880, 26, 13, 'rgba(255,255,255,.05)', null);
    Draw.text(ctx, '点击两个相同图标连线 · 连线可绕出棋盘外 · 连击有额外加分', 480, 569, 11, 'rgba(255,255,255,.5)');
  }

  function draw() {
    drawBg();
    drawTiles();
    drawPathAnim();
    effects.forEach(e => {
      ctx.globalAlpha = clamp(e.life / 0.6, 0, 1);
      ctx.strokeStyle = e.color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(e.x, e.y, (1 - e.life / 0.6) * 40 + 8, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    });
    drawHUD();
  }

  function update(dt) {
    if (paused || over) return;
    timeLeft -= dt;
    if (hintTimer > 0) hintTimer -= dt;
    if (noticeTimer > 0) noticeTimer -= dt;
    for (let i = effects.length - 1; i >= 0; i--) {
      effects[i].life -= dt;
      if (effects[i].life <= 0) effects.splice(i, 1);
    }
    if (pathAnim) {
      pathAnim.t += dt;
      if (pathAnim.t >= 0.3) finishAnim();
    }
    if (timeLeft <= 0) {
      timeLeft = 0;
      over = true;
      win = false;
      setTimeout(() => endGame(), 350);
    }
  }

  function endGame() {
    if (destroyed) return;
    if (endGame.done) return;
    endGame.done = true;
    const rest = Math.max(0, Math.ceil(timeLeft));
    api.finish({
      score: score + (win ? rest * 4 : 0),
      win,
      title: win ? '全部连完！' : '时间到',
      subtitle: win ? '骋望楼的图标都被你连成了线' : '还有 ' + tiles.filter(t => !t.removed).length / 2 + ' 对没连完',
      stats: [
        ['消除对数', cleared + ' 对'],
        ['最高连击', maxCombo],
        ['剩余时间', rest + ' 秒']
      ],
      detail: `消除${cleared}对 · 连击${maxCombo} · ${rest}秒`,
      tip: '提示：优先消掉棋盘中间被围住的图标；路径可以绕到棋盘外，别只盯着格子里面。'
    });
  }

  function loop(t) {
    if (paused || over || destroyed) return;
    if (!last) last = t;
    const dt = Math.min(0.05, (t - last) / 1000);
    last = t;
    update(dt);
    draw();
    if (!over) raf = requestAnimationFrame(loop);
  }

  build();
  draw();
  raf = requestAnimationFrame(loop);

  return {
    pause() { paused = true; cancelAnimationFrame(raf); },
    resume() { if (over) return; paused = false; last = 0; raf = requestAnimationFrame(loop); },
    destroy() {
      destroyed = true;
      cancelAnimationFrame(raf);
      canvas.removeEventListener('pointerdown', onClick);
    }
  };
};
