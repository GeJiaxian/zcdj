/* =========================================================
   包裹雨 · 沙河快递驿站
   双十一的包裹漫天飞，接住快递和蜜雪，躲开易碎品与错件
   ========================================================= */
'use strict';

GameRegistry.express = function (stage, api) {
  const W = 960, H = 600;
  const canvas = makeCanvas(stage, W, H);
  const ctx = canvas.getContext('2d');
  const GROUND = 520;
  const TOTAL_TIME = 60;
  const rnd = seeded(20261117);

  const basket = { x: W / 2, tx: W / 2, w: 132, h: 58 };
  const items = [], parts = [], floats = [];
  const keys = { left: false, right: false };

  let score = 0, lives = 3, timeLeft = TOTAL_TIME, combo = 0, bestCombo = 0, comboTimer = 0;
  let caught = 0, missed = 0, spawnTimer = 0.7, flash = 0, shake = 0, paused = false, over = false, destroyed = false;
  let raf = 0, last = 0;

  const TYPES = {
    box: { label: '快递', color: '#C98A5B', dark: '#8B5E3C', size: 44, value: 10, good: true },
    milk: { label: '奶茶', color: '#F2A6C6', dark: '#C97696', size: 40, value: 25, good: true },
    fragile: { label: '易碎', color: '#E8745B', dark: '#A2482F', size: 46, value: 0, good: false },
    wrong: { label: '错件', color: '#9C7BB8', dark: '#6E4F8A', size: 42, value: 0, good: false }
  };

  const bgParcels = Array.from({ length: 10 }, () => ({
    x: rand(20, W - 20), y: rand(60, 200), s: rand(16, 30), rot: rand(-0.5, 0.5), sp: rand(8, 22)
  }));

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
    basket.tx = clamp(p.x, basket.w / 2 + 8, W - basket.w / 2 - 8);
    if (e.pointerType === 'touch') e.preventDefault();
  };
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('pointermove', onPointer);
  canvas.addEventListener('pointerdown', onPointer);

  /* ---------------- 逻辑 ---------------- */
  function spawn() {
    const roll = rnd();
    let type;
    if (roll < 0.52) type = 'box';
    else if (roll < 0.72) type = 'milk';
    else if (roll < 0.88) type = 'fragile';
    else type = 'wrong';
    const cfg = TYPES[type];
    items.push({
      type, cfg,
      x: rand(40, W - 40),
      y: -40,
      vy: 140 + (TOTAL_TIME - timeLeft) * 2.4 + rand(0, 40),
      sway: rand(0, Math.PI * 2),
      swayAmp: rand(8, 28),
      rot: rand(-0.4, 0.4),
      size: cfg.size
    });
  }

  function addParts(x, y, color, n, speed) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2);
      const sp = rand(speed * 0.3, speed);
      parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: rand(0.25, 0.6), max: 0.6, color, r: rand(2, 4.5) });
    }
  }
  function addFloat(x, y, text, color) {
    floats.push({ x, y, text, color: color || '#FFF3C4', life: 1, max: 1 });
  }

  function hurt(text) {
    lives--;
    flash = 1;
    shake = 14;
    combo = 0;
    comboTimer = 0;
    missed++;
    addFloat(basket.x, GROUND - 90, text, '#FF9A86');
    Sfx.play('damage');
    if (lives <= 0) {
      lives = 0;
      endGame(false);
    }
  }

  function endGame(survived) {
    if (over) return;
    over = true;
    cancelAnimationFrame(raf);
    const bonus = survived ? lives * 50 : 0;
    const finalScore = score + bonus;
    setTimeout(() => {
      if (destroyed) return;
      api.finish({
        score: finalScore,
        win: survived,
        title: survived ? '驿站守住了！' : '爆仓了……',
        subtitle: survived ? '双十一的包裹全部稳稳接住，蜜雪还热着' : '易碎品碎了一地，明天再去取件吧',
        stats: [
          ['接到包裹', caught + ' 件'],
          ['最高连击', bestCombo],
          ['剩余时间', Math.ceil(timeLeft) + ' 秒'],
          ['生存奖励', '+' + bonus]
        ],
        detail: `接到${caught}件 · 连击${bestCombo} · ${survived ? '守住' : '爆仓'}`,
        tip: '提示：连续接住包裹会提升倍率，奶茶比普通快递更值钱；红色「易碎」和紫色「错件」千万别碰，会扣命并清空连击。'
      });
    }, 450);
  }

  function update(dt) {
    timeLeft = Math.max(0, timeLeft - dt);

    // 移动
    const sp = 620;
    if (keys.left) basket.tx -= sp * dt;
    if (keys.right) basket.tx += sp * dt;
    basket.tx = clamp(basket.tx, basket.w / 2 + 8, W - basket.w / 2 - 8);
    basket.x += (basket.tx - basket.x) * Math.min(1, dt * 15);

    // 生成
    spawnTimer -= dt;
    if (spawnTimer <= 0) {
      const progress = 1 - timeLeft / TOTAL_TIME;
      spawnTimer = Math.max(0.24, 0.72 - progress * 0.4) * rand(0.8, 1.3);
      spawn();
      if (progress > 0.55 && rnd() < 0.35) spawn();
    }

    // 掉落
    for (let i = items.length - 1; i >= 0; i--) {
      const it = items[i];
      it.y += it.vy * dt;
      it.sway += dt * 2.4;
      it.px = it.x + Math.sin(it.sway) * it.swayAmp * clamp(it.y / 260, 0, 1);

      // 接住判定
      const top = GROUND - 8;
      if (it.y > top - 44 && it.y < top + 32 && Math.abs(it.px - basket.x) < basket.w / 2 - 6) {
        if (it.cfg.good) {
          combo++;
          comboTimer = 2.6;
          bestCombo = Math.max(bestCombo, combo);
          const mult = Math.min(3, 1 + Math.floor(combo / 5) * 0.5);
          const gain = Math.round(it.cfg.value * mult);
          score += gain;
          caught++;
          addFloat(it.px, top - 60, '+' + gain + (mult > 1 ? ' x' + mult : ''), it.type === 'milk' ? '#FFC6DD' : '#FFF3C4');
          addParts(it.px, top - 10, it.cfg.color, 10, 220);
          Sfx.play(it.type === 'milk' ? 'coin' : 'pop');
          if (combo > 0 && combo % 10 === 0) {
            addFloat(W / 2, 190, combo + ' 连击！', '#FFD97D');
            Sfx.play('up');
          }
        } else {
          hurt(it.type === 'fragile' ? '易碎品碎了！' : '取错件了！');
          addParts(it.px, top - 10, it.cfg.color, 18, 280);
        }
        items.splice(i, 1);
        continue;
      }

      // 落地
      if (it.y > H + 40) {
        if (it.cfg.good) {
          // 好包裹漏接只清连击
          if (combo > 0) { combo = 0; comboTimer = 0; }
        }
        items.splice(i, 1);
      }
    }

    if (comboTimer > 0) {
      comboTimer -= dt;
      if (comboTimer <= 0) combo = 0;
    }
    if (flash > 0) flash = Math.max(0, flash - dt * 2.2);
    if (shake > 0) shake = Math.max(0, shake - dt * 60);

    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 420 * dt;
      if (p.life <= 0) parts.splice(i, 1);
    }
    for (let i = floats.length - 1; i >= 0; i--) {
      const f = floats[i];
      f.life -= dt;
      f.y -= 42 * dt;
      if (f.life <= 0) floats.splice(i, 1);
    }
    bgParcels.forEach(p => {
      p.y += p.sp * dt;
      p.x += Math.sin(p.y / 60) * 8 * dt;
      if (p.y > 240) { p.y = -30; p.x = rand(20, W - 20); }
    });

    if (timeLeft <= 0) endGame(true);
  }

  /* ---------------- 画面 ---------------- */
  function drawBackground() {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#FFD9A0');
    g.addColorStop(0.45, '#F7B58A');
    g.addColorStop(1, '#E8896F');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // 云
    Draw.cloud(ctx, 120, 70, 70, '#FFF1DC', 0.65);
    Draw.cloud(ctx, 760, 50, 54, '#FFF1DC', 0.5);

    // 远处楼群
    ctx.fillStyle = 'rgba(120, 80, 70, .18)';
    [[20, 250, 130, 180], [800, 230, 140, 200], [170, 300, 90, 130], [650, 290, 100, 140]].forEach(([x, y, w, h]) => {
      ctx.fillRect(x, y, w, h);
    });

    // 驿站小屋
    const hx = 62, hy = 176, hw = 250, hh = 140;
    Draw.fillRR(ctx, hx, hy, hw, hh, 8, '#F6E6C6', '#3B2F2A', 4);
    for (let i = 0; i < 7; i++) {
      ctx.fillStyle = i % 2 ? '#FFFDF5' : '#E8745B';
      ctx.fillRect(hx + 4 + i * 35, hy - 18, 35, 22);
    }
    ctx.strokeStyle = '#3B2F2A';
    ctx.lineWidth = 3;
    ctx.strokeRect(hx + 4, hy - 18, 244, 22);
    Draw.text(ctx, '快递驿站', hx + hw / 2, hy + 34, 22, '#5A3B2A');
    Draw.text(ctx, '沙河店 · 双十一', hx + hw / 2, hy + 58, 10, '#8B6B52');
    Draw.fillRR(ctx, hx + 84, hy + 76, 82, 56, 4, '#6E4A32', '#3B2F2A', 3);
    Draw.text(ctx, '取件', hx + 125, hy + 104, 13, '#FFE9A8');

    // 货架
    const sx = hx + 34;
    Draw.fillRR(ctx, sx, hy + 78, 34, 54, 3, '#B77A4E', '#3B2F2A', 2.5);
    Draw.fillRR(ctx, sx, hy + 104, 34, 8, 2, '#8B5E3C', null);
    [[sx + 8, hy + 88], [sx + 20, hy + 88], [sx + 8, hy + 116], [sx + 20, hy + 116]].forEach(([x, y]) => {
      Draw.fillRR(ctx, x, y, 10, 9, 2, '#D9A15E', '#3B2F2A', 1.6);
    });

    // 蜜雪冰城小窗口
    ctx.save();
    ctx.translate(860, 250);
    Draw.fillRR(ctx, -46, -70, 92, 96, 8, '#FF6F91', '#3B2F2A', 3.5);
    ctx.fillStyle = '#FFFDF5';
    ctx.beginPath();
    ctx.arc(0, -34, 20, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#3B2F2A';
    ctx.lineWidth = 2.6;
    ctx.stroke();
    ctx.fillStyle = '#F5C451';
    ctx.beginPath();
    ctx.moveTo(-16, -56); ctx.lineTo(-7, -70); ctx.lineTo(0, -58); ctx.lineTo(7, -70); ctx.lineTo(16, -56);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#FFFDF5';
    ctx.beginPath();
    ctx.arc(-7, -20, 5, 0, Math.PI * 2);
    ctx.arc(7, -20, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#3B2F2A';
    ctx.beginPath();
    ctx.arc(-7, -20, 2, 0, Math.PI * 2);
    ctx.arc(7, -20, 2, 0, Math.PI * 2);
    ctx.fill();
    Draw.text(ctx, '蜜雪冰城', 0, 6, 13, '#FFFDF5');
    Draw.text(ctx, '幸运咖 · 柠檬水', 0, 24, 8, 'rgba(255,255,255,.8)');
    ctx.restore();

    // 地面
    ctx.fillStyle = '#C97C5A';
    ctx.fillRect(0, GROUND + 10, W, H - GROUND);
    ctx.fillStyle = 'rgba(255,255,255,.1)';
    for (let x = 0; x < W; x += 60) ctx.fillRect(x, GROUND + 26, 30, 4);

    // 天上飘的包裹影子
    bgParcels.forEach(p => {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.globalAlpha = 0.22;
      Draw.fillRR(ctx, -p.s / 2, -p.s / 2, p.s, p.s, 3, '#FFF3D8', null);
      ctx.restore();
    });
    ctx.globalAlpha = 1;
  }

  function drawBasket() {
    const x = basket.x, y = GROUND;
    ctx.save();
    ctx.translate(x, y);
    // 阴影
    ctx.fillStyle = 'rgba(90, 45, 30, .28)';
    ctx.beginPath();
    ctx.ellipse(0, 12, basket.w * 0.52, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    // 筐体
    ctx.beginPath();
    ctx.moveTo(-basket.w / 2, -basket.h);
    ctx.lineTo(basket.w / 2, -basket.h);
    ctx.lineTo(basket.w / 2 - 14, 0);
    ctx.lineTo(-basket.w / 2 + 14, 0);
    ctx.closePath();
    ctx.fillStyle = '#E8B87E';
    ctx.fill();
    ctx.strokeStyle = '#3B2F2A';
    ctx.lineWidth = 3.5;
    ctx.stroke();
    // 网格
    ctx.save();
    ctx.clip();
    ctx.strokeStyle = 'rgba(139, 94, 60, .55)';
    ctx.lineWidth = 2;
    for (let i = -basket.w; i < basket.w; i += 18) {
      ctx.beginPath(); ctx.moveTo(i, -basket.h); ctx.lineTo(i + 24, 0); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + 24, -basket.h); ctx.stroke();
    }
    ctx.restore();
    // 筐口
    Draw.fillRR(ctx, -basket.w / 2 - 6, -basket.h - 10, basket.w + 12, 14, 7, '#F5D7A8', '#3B2F2A', 3);
    // 小苗
    ctx.save();
    ctx.translate(-basket.w / 2 - 2, -basket.h - 22);
    ctx.fillStyle = '#FFEBD2';
    ctx.beginPath();
    ctx.arc(0, 0, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#3B2F2A';
    ctx.lineWidth = 2.4;
    ctx.stroke();
    ctx.fillStyle = '#3B2F2A';
    ctx.beginPath();
    ctx.arc(-4, -1, 1.8, 0, Math.PI * 2);
    ctx.arc(4, -1, 1.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#3B2F2A';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.arc(0, 3, 4, 0.2, Math.PI - 0.2);
    ctx.stroke();
    ctx.fillStyle = '#7BC96F';
    ctx.beginPath();
    ctx.ellipse(3, -16, 7, 4, -0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.restore();
  }

  function drawItem(it) {
    const px = it.px || it.x;
    ctx.save();
    ctx.translate(px, it.y);
    ctx.rotate(it.rot + Math.sin(it.sway) * 0.16);
    const s = it.size;
    // 警告光晕
    if (!it.cfg.good) {
      ctx.save();
      ctx.globalAlpha = 0.3 + 0.16 * Math.sin(nowSec() * 7);
      ctx.fillStyle = it.cfg.color;
      ctx.beginPath();
      ctx.arc(0, 0, s * 0.82, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    ctx.fillStyle = 'rgba(0,0,0,.22)';
    Draw.rr(ctx, -s / 2 + 3, -s / 2 + 4, s, s, 9);
    ctx.fill();
    Draw.fillRR(ctx, -s / 2, -s / 2, s, s, 9, it.cfg.color, '#3B2F2A', 3);

    if (it.type === 'box') {
      ctx.strokeStyle = 'rgba(59,47,42,.4)';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(-s / 2 + 4, 0); ctx.lineTo(s / 2 - 4, 0);
      ctx.stroke();
      Draw.fillRR(ctx, -s * 0.17, -s * 0.16, s * 0.34, s * 0.24, 2, '#FFF3D8', null);
    } else if (it.type === 'milk') {
      // 奶茶杯
      Draw.fillRR(ctx, -s * 0.26, -s * 0.3, s * 0.52, s * 0.62, 4, '#FFFDF5', '#3B2F2A', 2);
      ctx.fillStyle = '#C98A5B';
      ctx.beginPath();
      ctx.arc(0, s * 0.2, 3.4, 0, Math.PI * 2);
      ctx.arc(-6, s * 0.14, 3.4, 0, Math.PI * 2);
      ctx.arc(6, s * 0.14, 3.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#3B2F2A';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(5, -s * 0.3); ctx.lineTo(11, -s * 0.56);
      ctx.stroke();
      Draw.fillRR(ctx, -s * 0.3, -s * 0.34, s * 0.6, s * 0.1, 2, '#FF6F91', '#3B2F2A', 2);
    } else if (it.type === 'fragile') {
      ctx.strokeStyle = '#FFF3D8';
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.moveTo(0, -s * 0.3);
      ctx.lineTo(s * 0.16, -s * 0.02);
      ctx.lineTo(0, -s * 0.02);
      ctx.lineTo(s * 0.16, s * 0.3);
      ctx.stroke();
      Draw.text(ctx, '易碎', 0, s * 0.33, 9, '#FFF3D8');
    } else {
      ctx.strokeStyle = '#FFF3D8';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-s * 0.2, -s * 0.2);
      ctx.lineTo(s * 0.2, s * 0.2);
      ctx.moveTo(s * 0.2, -s * 0.2);
      ctx.lineTo(-s * 0.2, s * 0.2);
      ctx.stroke();
      Draw.text(ctx, '错件', 0, s * 0.36, 9, '#FFF3D8');
    }
    ctx.restore();
  }

  function drawHUD() {
    for (let i = 0; i < 3; i++) {
      ctx.save();
      ctx.translate(34 + i * 36, 36);
      Draw.heart(ctx, 0, 0, 11);
      if (i < lives) {
        ctx.fillStyle = '#F06D5E';
        ctx.fill();
        ctx.strokeStyle = '#7A2C24';
        ctx.lineWidth = 2.4;
        ctx.stroke();
      } else {
        ctx.strokeStyle = 'rgba(255,255,255,.4)';
        ctx.lineWidth = 2.4;
        ctx.stroke();
      }
      ctx.restore();
    }

    Draw.text(ctx, '得分', W - 26, 26, 12, 'rgba(255,255,255,.7)', 'right');
    Draw.text(ctx, fmtScore(score), W - 26, 54, 28, '#FFF3C4', 'right', 'bold', 'rgba(0,0,0,.35)', 5);

    // 倒计时
    Draw.fillRR(ctx, 130, 24, 112, 26, 13, 'rgba(255,255,255,.18)', 'rgba(255,255,255,.35)', 1.5);
    Draw.text(ctx, Math.ceil(timeLeft) + ' 秒', 186, 37, 13, timeLeft < 10 ? '#FFD2C8' : '#FFFDF5');

    // 连击
    if (combo >= 3) {
      const mult = Math.min(3, 1 + Math.floor(combo / 5) * 0.5);
      ctx.save();
      ctx.globalAlpha = clamp(comboTimer, 0, 1);
      Draw.fillRR(ctx, 256, 24, 128, 26, 13, 'rgba(255,217,125,.2)', 'rgba(255,217,125,.6)', 1.5);
      Draw.text(ctx, combo + ' 连击 x' + mult, 320, 37, 12, '#FFD97D');
      ctx.restore();
    }

    Draw.text(ctx, '← → / A D 或鼠标移动快递筐 · 接快递与奶茶 · 躲易碎品', W / 2, H - 22, 11, 'rgba(255,255,255,.55)');
  }

  function draw() {
    ctx.save();
    if (shake > 0) ctx.translate(rand(-shake, shake), rand(-shake, shake));
    drawBackground();
    items.forEach(drawItem);
    drawBasket();

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
      Draw.text(ctx, f.text, f.x, f.y, 18, f.color, 'center', 'bold', 'rgba(0,0,0,.4)', 4);
    });
    ctx.globalAlpha = 1;

    drawHUD();
    ctx.restore();

    if (flash > 0) {
      ctx.fillStyle = `rgba(255, 80, 60, ${flash * 0.3})`;
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
