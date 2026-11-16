/* =========================================================
   保卫宿舍 · 沙河 6 号楼
   驾驶小飞机，在早八/早十/作业/签到砸中宿舍楼之前拦下它们
   ========================================================= */
'use strict';

GameRegistry.dorm = function (stage, api) {
  const W = 960, H = 600;
  const canvas = makeCanvas(stage, W, H);
  const ctx = canvas.getContext('2d');
  const BUILD_Y = 500;
  const rnd = seeded(20261116);

  const stars = Array.from({ length: 70 }, () => ({
    x: rnd() * W, y: rnd() * 380, r: 0.7 + rnd() * 1.7, a: 0.25 + rnd() * 0.6, sp: 0.4 + rnd() * 1.2
  }));
  const cloudSeeds = Array.from({ length: 4 }, () => ({ x: rnd() * W, y: 60 + rnd() * 130, s: 60 + rnd() * 60, v: 6 + rnd() * 10 }));

  let paused = false, over = false, destroyed = false;
  let raf = 0, last = 0;
  let score = 0, lives = 3, wave = 1, time = 0, spawnTimer = 1.2, shield = 0, shake = 0, flash = 0;
  let maxPower = 1, maxLives = 3;
  let combo = 0, comboTimer = 0, bestCombo = 0;

  const plane = { x: W / 2, y: 424, tx: W / 2, vy: 0, w: 76, h: 60, power: 1, inv: 0 };
  const bullets = [], items = [], parts = [], floats = [];
  const keys = { left: false, right: false };
  let gunCd = 0;

  const ITEM_TYPES = {
    early8: { label: '早八', color: '#EE8A5D', dark: '#B8562F', size: 46, score: 12, hp: 1, good: false },
    early10: { label: '早十', color: '#6E8FB8', dark: '#3F5D82', size: 44, score: 12, hp: 1, good: false },
    hw: { label: '作业', color: '#C7A0D6', dark: '#8E5FA6', size: 48, score: 18, hp: 2, good: false },
    sign: { label: '签到', color: '#7BC96F', dark: '#3E8257', size: 42, score: 15, hp: 1, good: false },
    bonus: { label: '不调休', color: '#F5C451', dark: '#C98F1C', size: 42, score: 60, hp: 1, good: true, effect: 'power' },
    milk: { label: '奶茶', color: '#F2A6A6', dark: '#C97676', size: 40, score: 40, hp: 1, good: true, effect: 'life' },
    holiday: { label: '放假', color: '#A8D5A2', dark: '#5A9A5F', size: 42, score: 60, hp: 1, good: true, effect: 'shield' }
  };

  /* ---------------- 输入 ---------------- */
  const onKeyDown = e => {
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') { keys.left = true; e.preventDefault(); }
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') { keys.right = true; e.preventDefault(); }
  };
  const onKeyUp = e => {
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') keys.left = false;
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') keys.right = false;
  };
  const onPointer = e => {
    const p = canvasPos(canvas, e);
    plane.tx = clamp(p.x, 56, W - 56);
    if (e.pointerType === 'touch') e.preventDefault();
  };
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('pointermove', onPointer);
  canvas.addEventListener('pointerdown', onPointer);

  /* ---------------- 逻辑 ---------------- */
  function spawn() {
    const pool = [];
    pool.push(['early8', 30]);
    pool.push(['early10', 20]);
    pool.push(['hw', 18 + wave]);
    pool.push(['sign', 14]);
    if (rnd() < 0.16) pool.push(['bonus', 9]);
    if (rnd() < 0.1) pool.push(['milk', 5]);
    if (rnd() < 0.07) pool.push(['holiday', 4]);
    let total = pool.reduce((s, p) => s + p[1], 0);
    let pick = rnd() * total;
    let type = 'early8';
    for (const [t, wgt] of pool) {
      pick -= wgt;
      if (pick <= 0) { type = t; break; }
    }
    const cfg = ITEM_TYPES[type];
    const x = rand(50, W - 50);
    items.push({
      x, y: -40,
      vy: 88 + wave * 17 + rand(-12, 26),
      sway: rand(0, Math.PI * 2),
      swayAmp: rand(6, 26),
      rot: rand(-0.3, 0.3),
      type, cfg, hp: cfg.hp, size: cfg.size
    });
  }

  function addParts(x, y, color, n = 10, speed = 200) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2);
      const sp = rand(speed * 0.3, speed);
      parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: rand(0.3, 0.7), max: 0.7, color, r: rand(2, 5) });
    }
  }

  function addFloat(x, y, text, color = '#FFF3C4') {
    floats.push({ x, y, text, color, life: 1, max: 1 });
  }

  function damage() {
    lives--;
    flash = 1;
    shake = 16;
    Sfx.play('damage');
    addParts(rand(120, W - 120), BUILD_Y + 8, '#F08A5D', 26, 320);
    if (lives <= 0) {
      lives = 0;
      endGame();
    }
  }

  function endGame() {
    over = true;
    cancelAnimationFrame(raf);
    setTimeout(() => {
      if (destroyed) return;
      api.finish({
        score,
        win: false,
        subtitle: '早八还是攻破了防线，室友翻了个身继续睡',
        stats: [
          ['坚持时间', Math.floor(time) + ' 秒'],
          ['抵达波次', '第 ' + wave + ' 波'],
          ['最高火力', 'Lv.' + maxPower],
          ['最高连击', bestCombo]
        ],
        detail: `第${wave}波 · ${Math.floor(time)}秒 · Lv.${maxPower}`,
        tip: '提示：优先打掉体积大、血量高的「作业」；金色「不调休」要主动接住升级火力，「放假」能开 5 秒护盾。'
      });
    }, 500);
  }

  function update(dt) {
    time += dt;
    wave = 1 + Math.floor(time / 22);
    if (time > 0 && Math.floor(time / 22) > Math.floor((time - dt) / 22)) {
      addFloat(W / 2, 150, '第 ' + wave + ' 波 · 早八来袭', '#FFD97D');
      Sfx.play('up');
    }

    // 移动
    const sp = 560;
    if (keys.left) plane.tx -= sp * dt;
    if (keys.right) plane.tx += sp * dt;
    plane.tx = clamp(plane.tx, 56, W - 56);
    const prevX = plane.x;
    plane.x += (plane.tx - plane.x) * Math.min(1, dt * 16);
    plane.vy = (plane.x - prevX) / Math.max(dt, 0.001);

    // 开火
    gunCd -= dt;
    if (gunCd <= 0) {
      gunCd = 0.19;
      const p = plane.power;
      const mk = (ox, angle, dmg) => bullets.push({ x: plane.x + ox, y: plane.y - 34, vx: Math.sin(angle) * 760, vy: -Math.cos(angle) * 820, dmg, r: 5 });
      if (p === 1) mk(0, 0, 1);
      else if (p === 2) { mk(-11, 0, 1); mk(11, 0, 1); }
      else if (p === 3) { mk(0, 0, 2); mk(-15, -0.1, 1); mk(15, 0.1, 1); }
      else if (p === 4) { mk(-13, -0.07, 2); mk(13, 0.07, 2); mk(-26, -0.17, 1); mk(26, 0.17, 1); }
      else { mk(0, 0, 2); mk(-15, -0.08, 2); mk(15, 0.08, 2); mk(-28, -0.19, 1); mk(28, 0.19, 1); }
      if (Sfx.on) Sfx.play('shoot');
    }

    // 生成
    spawnTimer -= dt;
    if (spawnTimer <= 0) {
      spawnTimer = Math.max(0.32, 1.05 - wave * 0.075) * rand(0.8, 1.25);
      spawn();
      if (wave >= 3 && rnd() < 0.32) spawn();
    }

    // 子弹
    for (let i = bullets.length - 1; i >= 0; i--) {
      const b = bullets[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (b.y < -20 || b.x < -20 || b.x > W + 20) bullets.splice(i, 1);
    }

    // 掉落物
    for (let i = items.length - 1; i >= 0; i--) {
      const it = items[i];
      it.y += it.vy * dt;
      it.sway += dt * 2.2;
      const px = it.x + Math.sin(it.sway) * it.swayAmp * (it.y / 220);
      it.px = px;

      // 被子弹击中
      for (let j = bullets.length - 1; j >= 0; j--) {
        const b = bullets[j];
        if (dist(b.x, b.y, px, it.y) < it.size * 0.44 + b.r) {
          bullets.splice(j, 1);
          it.hp -= b.dmg;
          addParts(px, it.y, it.cfg.color, 5, 140);
          Sfx.play('hit');
          if (it.hp <= 0) {
            score += it.cfg.score;
            combo++;
            comboTimer = 2.2;
            bestCombo = Math.max(bestCombo, combo);
            addFloat(px, it.y - 20, '+' + it.cfg.score);
            addParts(px, it.y, it.cfg.color, 12, 230);
            items.splice(i, 1);
            if (combo > 0 && combo % 10 === 0) { addFloat(W / 2, 200, combo + ' 连击！', '#FFD97D'); Sfx.play('up'); }
          }
          break;
        }
      }
      if (it.hp <= 0) continue;

      // 接住好东西
      const caught = Math.abs(px - plane.x) < 42 && Math.abs(it.y - plane.y) < 34;
      if (caught && it.cfg.good) {
        if (it.cfg.effect === 'power') {
          if (plane.power < 5) {
            plane.power++;
            maxPower = Math.max(maxPower, plane.power);
            addFloat(plane.x, plane.y - 60, '火力 Lv.' + plane.power, '#FFD97D');
            Sfx.play('up');
          } else {
            score += 80;
            addFloat(plane.x, plane.y - 60, '+80', '#FFD97D');
            Sfx.play('coin');
          }
        } else if (it.cfg.effect === 'life') {
          if (lives < 3) { lives++; addFloat(plane.x, plane.y - 60, '回血 +1', '#F2A6A6'); Sfx.play('up'); }
          else { score += 60; addFloat(plane.x, plane.y - 60, '+60', '#F2A6A6'); Sfx.play('coin'); }
        } else if (it.cfg.effect === 'shield') {
          shield = 5;
          addFloat(plane.x, plane.y - 60, '放假护盾 5s', '#A8D5A2');
          Sfx.play('up');
        }
        score += it.cfg.score;
        addParts(px, it.y, it.cfg.color, 16, 260);
        items.splice(i, 1);
        continue;
      }

      // 撞到宿舍
      if (it.y > BUILD_Y - 6) {
        if (it.cfg.good) {
          // 好东西漏接，不扣血
          items.splice(i, 1);
        } else if (shield > 0) {
          addParts(px, BUILD_Y, '#A8D5A2', 18, 300);
          addFloat(px, BUILD_Y - 30, '护盾挡住！', '#A8D5A2');
          Sfx.play('hit');
          items.splice(i, 1);
        } else {
          damage();
          items.splice(i, 1);
        }
      }
    }

    // 连击衰减
    if (comboTimer > 0) {
      comboTimer -= dt;
      if (comboTimer <= 0) combo = 0;
    }
    if (shield > 0) shield = Math.max(0, shield - dt);
    if (flash > 0) flash = Math.max(0, flash - dt * 2.2);
    if (shake > 0) shake = Math.max(0, shake - dt * 60);
    if (plane.inv > 0) plane.inv -= dt;

    // 粒子
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 380 * dt;
      p.vx *= 0.99;
      if (p.life <= 0) parts.splice(i, 1);
    }
    for (let i = floats.length - 1; i >= 0; i--) {
      const f = floats[i];
      f.life -= dt;
      f.y -= 38 * dt;
      if (f.life <= 0) floats.splice(i, 1);
    }
    // 云飘动
    cloudSeeds.forEach(c => { c.x += c.v * dt; if (c.x > W + 80) c.x = -80; });
  }

  /* ---------------- 画面 ---------------- */
  function drawSky() {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#0E1730');
    g.addColorStop(0.55, '#28405F');
    g.addColorStop(1, '#4A6178');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    stars.forEach(s => {
      ctx.globalAlpha = s.a * (0.65 + 0.35 * Math.sin(time * s.sp + s.x));
      ctx.fillStyle = '#FFF6D0';
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;

    // 月亮
    ctx.save();
    ctx.shadowColor = 'rgba(255,238,170,.7)';
    ctx.shadowBlur = 34;
    ctx.fillStyle = '#FFEAA0';
    ctx.beginPath();
    ctx.arc(830, 78, 34, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = 'rgba(210,190,140,.35)';
    ctx.beginPath();
    ctx.arc(818, 70, 7, 0, Math.PI * 2);
    ctx.arc(842, 92, 5, 0, Math.PI * 2);
    ctx.fill();

    cloudSeeds.forEach(c => Draw.cloud(ctx, c.x, c.y, c.s, '#C9D9EC', 0.13));

    // 远处楼群
    ctx.fillStyle = 'rgba(9, 18, 33, .55)';
    const sil = [[40, 320, 90, 180], [150, 350, 70, 150], [700, 330, 110, 170], [830, 360, 80, 140], [250, 368, 60, 132]];
    sil.forEach(([x, y, w, h]) => {
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = 'rgba(255, 226, 130, .32)';
      for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
          if ((i + j + x) % 3 === 0) ctx.fillRect(x + 12 + i * 22, y + 18 + j * 30, 10, 12);
        }
      }
      ctx.fillStyle = 'rgba(9, 18, 33, .55)';
    });
  }

  function drawBuilding() {
    // 楼体
    const g = ctx.createLinearGradient(0, BUILD_Y, 0, H);
    g.addColorStop(0, '#D9BE97');
    g.addColorStop(1, '#B4926D');
    ctx.fillStyle = g;
    ctx.fillRect(0, BUILD_Y, W, H - BUILD_Y);
    // 屋檐
    ctx.fillStyle = '#7B4B34';
    ctx.fillRect(0, BUILD_Y - 16, W, 18);
    ctx.strokeStyle = 'rgba(59,47,42,.75)';
    ctx.lineWidth = 3;
    ctx.strokeRect(0, BUILD_Y - 16, W, 18);
    // 砖纹
    ctx.strokeStyle = 'rgba(120, 84, 58, .18)';
    ctx.lineWidth = 1.5;
    for (let y = BUILD_Y + 8; y < H; y += 18) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
      for (let x = (y % 36 === 0 ? 0 : 22); x < W; x += 44) {
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 18); ctx.stroke();
      }
    }
    // 窗户
    for (let i = 0; i < 8; i++) {
      const x = 52 + i * 112;
      const y = BUILD_Y + 26;
      Draw.fillRR(ctx, x, y, 62, 44, 5, i % 3 === 0 ? '#FFD97D' : '#5B6B7C', '#3B2F2A', 2.5);
      if (i % 3 === 0) {
        ctx.fillStyle = 'rgba(255, 236, 170, .25)';
        ctx.beginPath(); ctx.arc(x + 31, y + 22, 40, 0, Math.PI * 2); ctx.fill();
        Draw.text(ctx, 'Z', x + 22, y + 18, 12, 'rgba(255,255,255,.85)');
        Draw.text(ctx, 'z', x + 33, y + 11, 15, 'rgba(255,255,255,.85)');
        Draw.text(ctx, 'Z', x + 45, y + 4, 19, 'rgba(255,255,255,.85)');
      }
    }
    // 楼牌
    Draw.fillRR(ctx, 400, BUILD_Y + 78, 160, 30, 6, '#6E4A32', '#3B2F2A', 2.5);
    Draw.text(ctx, '沙河 6 号楼 · 请勿打扰', 480, BUILD_Y + 93, 13, '#FFE9A8');
    // 草地
    ctx.fillStyle = '#3F6B45';
    ctx.fillRect(0, H - 18, W, 18);
    ctx.fillStyle = 'rgba(255,255,255,.06)';
    for (let x = 0; x < W; x += 24) ctx.fillRect(x + (x % 48 ? 8 : 0), H - 14, 8, 3);
  }

  function drawPlane() {
    const x = plane.x, y = plane.y;
    const tilt = clamp(plane.vy / 900, -0.32, 0.32);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(tilt);
    // 引擎火焰
    const fl = 12 + Math.sin(time * 40) * 5;
    ctx.fillStyle = 'rgba(255, 190, 90, .75)';
    ctx.beginPath();
    ctx.moveTo(-7, 24);
    ctx.quadraticCurveTo(0, 24 + fl, 7, 24);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 245, 200, .9)';
    ctx.beginPath();
    ctx.moveTo(-3.5, 24);
    ctx.quadraticCurveTo(0, 24 + fl * 0.55, 3.5, 24);
    ctx.closePath();
    ctx.fill();
    // 机翼
    ctx.fillStyle = '#FFF7E0';
    ctx.strokeStyle = '#3B2F2A';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(0, -34);
    ctx.lineTo(25, 14);
    ctx.lineTo(9, 26);
    ctx.lineTo(0, 16);
    ctx.lineTo(-9, 26);
    ctx.lineTo(-25, 14);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // 机翼红纹
    ctx.fillStyle = '#E8745B';
    ctx.fillRect(-24, 12, 12, 4);
    ctx.fillRect(12, 12, 12, 4);
    // 机身
    ctx.fillStyle = '#57A773';
    ctx.beginPath();
    ctx.ellipse(0, -2, 9, 24, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // 座舱
    ctx.fillStyle = '#BFE6F6';
    ctx.beginPath();
    ctx.arc(0, -14, 6.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // 小苗驾驶员
    ctx.fillStyle = '#7BC96F';
    ctx.beginPath();
    ctx.ellipse(4, -25, 7, 4, -0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#2E6B45';
    ctx.lineWidth = 2;
    ctx.stroke();
    // 尾翼
    ctx.fillStyle = '#F5C451';
    ctx.beginPath();
    ctx.moveTo(-8, 18);
    ctx.lineTo(0, 30);
    ctx.lineTo(8, 18);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // 护盾
    if (shield > 0) {
      ctx.save();
      ctx.globalAlpha = 0.28 + 0.15 * Math.sin(time * 8);
      ctx.fillStyle = '#A8D5A2';
      ctx.beginPath();
      ctx.arc(x, y - 4, 52, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#7BC96F';
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawItem(it) {
    const px = it.px || it.x;
    ctx.save();
    ctx.translate(px, it.y);
    ctx.rotate(it.rot + Math.sin(it.sway) * 0.12);
    const s = it.size;
    if (it.cfg.good) {
      ctx.save();
      ctx.globalAlpha = 0.35 + 0.2 * Math.sin(time * 6);
      ctx.fillStyle = it.cfg.color;
      ctx.beginPath();
      ctx.arc(0, 0, s * 0.85, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    // 阴影
    ctx.fillStyle = 'rgba(0,0,0,.25)';
    Draw.rr(ctx, -s / 2 + 3, -s / 2 + 4, s, s, 10);
    ctx.fill();
    Draw.fillRR(ctx, -s / 2, -s / 2, s, s, 10, it.cfg.color, '#3B2F2A', 3);
    // 内框
    ctx.strokeStyle = 'rgba(255,255,255,.5)';
    ctx.lineWidth = 2;
    Draw.rr(ctx, -s / 2 + 5, -s / 2 + 5, s - 10, s - 10, 6);
    ctx.stroke();
    // 图标
    if (it.type === 'early8' || it.type === 'early10') {
      ctx.strokeStyle = 'rgba(59,47,42,.5)';
      ctx.lineWidth = 2;
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath();
        ctx.moveTo(-6, i * 6 - 2);
        ctx.lineTo(6, i * 6 - 2);
        ctx.stroke();
      }
    } else if (it.type === 'hw') {
      ctx.strokeStyle = 'rgba(59,47,42,.4)';
      ctx.lineWidth = 2;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(-10, -8 + i * 7);
        ctx.lineTo(10, -8 + i * 7);
        ctx.stroke();
      }
    }
    Draw.text(ctx, it.cfg.label, 0, s * 0.22, it.cfg.label.length > 2 ? 12 : 15, '#FFFDF5', 'center', 'bold', 'rgba(59,47,42,.45)', 3);
    ctx.restore();
  }

  function drawBullets() {
    bullets.forEach(b => {
      ctx.save();
      ctx.shadowColor = 'rgba(255, 226, 120, .9)';
      ctx.shadowBlur = 12;
      ctx.fillStyle = '#FFE27A';
      ctx.beginPath();
      ctx.ellipse(b.x, b.y, b.r, b.r * 2.2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#FFFDF5';
      ctx.beginPath();
      ctx.ellipse(b.x, b.y, b.r * 0.42, b.r * 1.2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
  }

  function drawHUD() {
    // 心
    for (let i = 0; i < 3; i++) {
      ctx.save();
      ctx.translate(34 + i * 36, 36);
      if (i < lives) {
        Draw.heart(ctx, 0, 0, 11);
        ctx.fillStyle = '#F06D5E';
        ctx.fill();
        ctx.strokeStyle = '#7A2C24';
        ctx.lineWidth = 2.4;
        ctx.stroke();
      } else {
        Draw.heart(ctx, 0, 0, 11);
        ctx.strokeStyle = 'rgba(255,255,255,.35)';
        ctx.lineWidth = 2.4;
        ctx.stroke();
      }
      ctx.restore();
    }
    // 分数
    Draw.text(ctx, '得分', W - 26, 26, 12, 'rgba(255,255,255,.6)', 'right');
    Draw.text(ctx, fmtScore(score), W - 26, 52, 28, '#FFF3C4', 'right', 'bold', 'rgba(0,0,0,.45)', 5);
    // 波次
    Draw.fillRR(ctx, 122, 24, 92, 26, 13, 'rgba(255,255,255,.12)', 'rgba(255,255,255,.28)', 1.5);
    Draw.text(ctx, '第 ' + wave + ' 波', 168, 37, 13, '#FFE9A8');
    // 火力
    Draw.fillRR(ctx, 224, 24, 118, 26, 13, 'rgba(255,255,255,.12)', 'rgba(255,255,255,.28)', 1.5);
    Draw.text(ctx, '火力 Lv.' + plane.power, 283, 37, 13, plane.power >= 4 ? '#FFD97D' : '#EAF4E4');
    // 护盾
    if (shield > 0) {
      Draw.fillRR(ctx, 352, 24, 118, 26, 13, 'rgba(168,213,162,.22)', 'rgba(168,213,162,.6)', 1.5);
      Draw.text(ctx, '护盾 ' + shield.toFixed(1) + 's', 411, 37, 12, '#C9EFC4');
    }
    // 连击
    if (combo >= 3) {
      ctx.save();
      ctx.globalAlpha = clamp(comboTimer, 0, 1);
      Draw.text(ctx, combo + ' combo', W / 2, 90, 22, '#FFD97D', 'center', 'bold', 'rgba(0,0,0,.45)', 4);
      ctx.restore();
    }
    // 底部提示
    Draw.text(ctx, '← → / A D 移动 · 自动开火 · 鼠标也能操控', W / 2, H - 32, 11, 'rgba(255,255,255,.28)');
  }

  function draw() {
    ctx.save();
    if (shake > 0) ctx.translate(rand(-shake, shake), rand(-shake, shake));
    drawSky();
    drawBuilding();

    items.forEach(drawItem);
    drawBullets();
    drawPlane();

    parts.forEach(p => {
      ctx.globalAlpha = clamp(p.life / p.max, 0, 1);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;

    floats.forEach(f => {
      ctx.globalAlpha = clamp(f.life / f.max, 0, 1);
      Draw.text(ctx, f.text, f.x, f.y, 18, f.color, 'center', 'bold', 'rgba(0,0,0,.45)', 4);
    });
    ctx.globalAlpha = 1;

    drawHUD();
    ctx.restore();

    if (flash > 0) {
      ctx.fillStyle = `rgba(255, 80, 60, ${flash * 0.32})`;
      ctx.fillRect(0, 0, W, H);
    }
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

  // 首帧
  draw();
  raf = requestAnimationFrame(loop);

  return {
    pause() { paused = true; cancelAnimationFrame(raf); },
    resume() { if (over) return; paused = false; last = 0; raf = requestAnimationFrame(loop); },
    destroy() {
      destroyed = true;
      over = true;
      cancelAnimationFrame(raf);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      canvas.removeEventListener('pointermove', onPointer);
      canvas.removeEventListener('pointerdown', onPointer);
    }
  };
};
