/* =========================================================
   密码推理 · 宿舍门禁
   4 位不重复的密码，用 A/B 反馈推理出来（10 次机会）
   ========================================================= */
'use strict';

PuzzleSub.code = function (stage, api) {
  const W = 960, H = 600;
  const canvas = makeCanvas(stage, W, H);
  const ctx = canvas.getContext('2d');

  const DIGITS = [1, 2, 3, 4, 5, 6];
  let secret = [], guess = [], history = [], attempts = 0;
  let paused = false, over = false, destroyed = false;
  let raf = 0, last = 0;
  let notice = '', noticeTimer = 0, shake = 0, winGlow = 0;
  let confetti = [];

  const slot = (i) => ({ x: 566 + i * 78, y: 150, w: 66, h: 66 });
  const keyBtns = [];
  DIGITS.forEach((d, i) => {
    const col = i % 3, row = Math.floor(i / 3);
    keyBtns.push({ id: 'd' + d, digit: d, x: 574 + col * 96, y: 262 + row * 72, w: 80, h: 54 });
  });
  const actionBtns = [
    { id: 'del', x: 574, y: 412, w: 128, h: 46, label: '删除' },
    { id: 'submit', x: 722, y: 412, w: 128, h: 46, label: '提交' }
  ];

  function newSecret() {
    secret = shuffle(DIGITS).slice(0, 4);
    guess = [];
    history = [];
    attempts = 0;
    over = false;
    notice = '';
    confetti = [];
    winGlow = 0;
  }

  function feedback(g) {
    let a = 0, b = 0;
    g.forEach((d, i) => {
      if (d === secret[i]) a++;
      else if (secret.includes(d)) b++;
    });
    return { a, b };
  }

  function typeDigit(d) {
    if (paused || over) return;
    if (guess.length >= 4) return;
    if (guess.includes(d)) {
      notice = '同一位密码里数字不重复';
      noticeTimer = 1.4;
      Sfx.play('wrong');
      return;
    }
    guess.push(d);
    Sfx.play('click');
  }

  function submit() {
    if (paused || over) return;
    if (guess.length < 4) {
      notice = '先把 4 位密码填满';
      noticeTimer = 1.4;
      Sfx.play('wrong');
      return;
    }
    const fb = feedback(guess);
    attempts++;
    history.push({ digits: guess.slice(), ...fb });
    if (fb.a === 4) {
      over = true;
      Sfx.play('win');
      winGlow = 1;
      for (let i = 0; i < 60; i++) {
        confetti.push({
          x: rand(520, 940), y: rand(120, 300),
          vx: rand(-100, 100), vy: rand(-90, 60),
          life: rand(1.2, 2.4), max: 2.4,
          color: choice(['#F5C451', '#57A773', '#E8745B', '#6E8FB8', '#F2A6A6']),
          r: rand(2, 5)
        });
      }
      setTimeout(() => finish(true), 900);
      return;
    }
    if (attempts >= 10) {
      over = true;
      Sfx.play('lose');
      setTimeout(() => finish(false), 900);
      return;
    }
    Sfx.play(fb.a > 0 ? 'up' : 'pop');
    guess = [];
  }

  function finish(won) {
    if (destroyed) return;
    const score = won ? (10 - attempts + 1) * 120 + 200 : 0;
    api.finish({
      score,
      win: won,
      title: won ? '门禁破解！' : '今晚睡走廊吧',
      subtitle: won ? `第 ${attempts} 次尝试打开了宿舍门` : `正确答案是 ${secret.join('')}，下次一定`,
      stats: [
        ['尝试次数', attempts + ' / 10'],
        ['用时', Math.floor(elapsed) + ' 秒'],
        ['正确答案', secret.join(' ')]
      ],
      detail: won ? `${attempts} 次破解` : `未破解 · 答案${secret.join('')}`,
      tip: '提示：先用 1234、3456 这类组合试探数字分布，再根据 A/B 反馈逐步确定位置；A 是位置正确，B 是数字对但位置错。'
    });
  }

  function onClick(e) {
    if (paused || over) return;
    const p = canvasPos(canvas, e);
    for (const b of keyBtns) {
      if (p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h) {
        typeDigit(b.digit);
        return;
      }
    }
    for (const b of actionBtns) {
      if (p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h) {
        if (b.id === 'del') {
          if (guess.length) { guess.pop(); Sfx.play('click'); }
        } else submit();
        return;
      }
    }
  }
  canvas.addEventListener('pointerdown', onClick);

  const onKey = e => {
    if (paused || over) return;
    if (/^[1-6]$/.test(e.key)) typeDigit(Number(e.key));
    else if (e.key === 'Backspace') { if (guess.length) guess.pop(); }
    else if (e.key === 'Enter') submit();
  };
  window.addEventListener('keydown', onKey);

  let elapsed = 0;

  /* ---------------- 绘制 ---------------- */
  function drawBg() {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#233043');
    g.addColorStop(1, '#151E29');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    // 墙面书架
    ctx.fillStyle = 'rgba(255,255,255,.035)';
    for (let i = 0; i < 7; i++) ctx.fillRect(20 + i * 140, 66, 100, 5);
    // 台灯
    ctx.save();
    const lg = ctx.createRadialGradient(760, 60, 10, 760, 60, 260);
    lg.addColorStop(0, 'rgba(255, 226, 150, .22)');
    lg.addColorStop(1, 'rgba(255, 226, 150, 0)');
    ctx.fillStyle = lg;
    ctx.fillRect(480, 0, 480, 420);
    ctx.restore();
  }

  function drawHistory() {
    Draw.fillRR(ctx, 34, 74, 476, 470, 16, 'rgba(255,255,255,.045)', 'rgba(255,255,255,.1)', 1.5);
    Draw.text(ctx, '尝 试 记 录', 60, 96, 13, 'rgba(255,255,255,.6)', 'left');
    Draw.text(ctx, 'A 位置对   B 数字对但位置错', 486, 96, 9.5, 'rgba(255,255,255,.35)', 'right');
    for (let i = 0; i < 10; i++) {
      const y = 118 + i * 42;
      const rec = history[i];
      Draw.text(ctx, String(i + 1).padStart(2, '0'), 56, y + 17, 11, 'rgba(255,255,255,.3)', 'left');
      for (let s = 0; s < 4; s++) {
        const x = 84 + s * 52;
        Draw.fillRR(ctx, x, y, 44, 34, 8,
          rec ? 'rgba(255,253,245,.92)' : 'rgba(255,255,255,.055)',
          rec ? '#C9B48F' : 'rgba(255,255,255,.12)', 1.2);
        if (rec) Draw.text(ctx, rec.digits[s], x + 22, y + 17, 17, '#3B2F2A');
      }
      if (rec) {
        for (let k = 0; k < 4; k++) {
          const x = 330 + k * 22;
          if (k < rec.a) {
            ctx.fillStyle = '#7BC96F';
            ctx.beginPath(); ctx.arc(x, y + 17, 7, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#1E2B22';
            ctx.font = 'bold 9px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('A', x, y + 17);
          } else if (k < rec.a + rec.b) {
            ctx.strokeStyle = '#F5C451';
            ctx.lineWidth = 2.4;
            ctx.beginPath(); ctx.arc(x, y + 17, 6.4, 0, Math.PI * 2); ctx.stroke();
          } else {
            ctx.strokeStyle = 'rgba(255,255,255,.12)';
            ctx.lineWidth = 1.2;
            ctx.beginPath(); ctx.arc(x, y + 17, 6, 0, Math.PI * 2); ctx.stroke();
          }
        }
      }
    }
  }

  function drawInput() {
    Draw.text(ctx, '第 ' + (attempts + 1) + ' 次尝试', 636, 100, 15, '#FFE9A8', 'center');
    Draw.text(ctx, '剩余机会 ' + (10 - attempts), 636, 122, 10.5, 'rgba(255,255,255,.45)', 'center');

    for (let i = 0; i < 4; i++) {
      const s = slot(i);
      const active = guess.length === i;
      Draw.fillRR(ctx, s.x, s.y, s.w, s.h, 12,
        guess[i] ? '#FFFDF3' : 'rgba(255,255,255,.07)',
        active ? '#FFD97D' : 'rgba(255,255,255,.2)', active ? 3 : 1.5);
      if (guess[i]) Draw.text(ctx, guess[i], s.x + s.w / 2, s.y + s.h / 2 + 1, 32, '#3B2F2A');
      else if (active) Draw.text(ctx, '?', s.x + s.w / 2, s.y + s.h / 2, 24, 'rgba(255,255,255,.25)');
    }

    keyBtns.forEach(b => {
      Draw.fillRR(ctx, b.x, b.y, b.w, b.h, 12, 'rgba(255,253,245,.9)', '#C9B48F', 1.6);
      Draw.text(ctx, b.digit, b.x + b.w / 2, b.y + b.h / 2 + 1, 24, '#3B2F2A');
    });
    actionBtns.forEach(b => {
      const primary = b.id === 'submit';
      Draw.fillRR(ctx, b.x, b.y, b.w, b.h, 23,
        primary ? 'rgba(87,167,115,.92)' : 'rgba(255,255,255,.1)',
        primary ? '#A8D5A2' : 'rgba(255,255,255,.28)', 1.8);
      Draw.text(ctx, b.label, b.x + b.w / 2, b.y + b.h / 2, 14, primary ? '#FFFDF5' : 'rgba(255,255,255,.7)');
    });

    Draw.fillRR(ctx, 566, 478, 360, 62, 12, 'rgba(255,255,255,.05)', 'rgba(255,255,255,.1)', 1);
    Draw.text(ctx, '规则：4 位密码，数字 1-6 不重复', 582, 497, 10.5, 'rgba(255,255,255,.6)', 'left');
    Draw.text(ctx, 'A = 数字与位置都对   B = 数字对但位置错', 582, 516, 10.5, 'rgba(255,255,255,.6)', 'left');
    Draw.text(ctx, '键盘 1-6 输入 · 回车提交', 582, 533, 9.5, 'rgba(255,255,255,.35)', 'left');

    if (noticeTimer > 0) {
      ctx.globalAlpha = clamp(noticeTimer * 2, 0, 1);
      Draw.fillRR(ctx, 566, 206, 360, 34, 17, 'rgba(232,116,91,.92)', null);
      Draw.text(ctx, notice, 746, 224, 12, '#FFFDF5');
      ctx.globalAlpha = 1;
    }
  }

  function draw() {
    ctx.save();
    if (shake > 0) ctx.translate(rand(-shake, shake), rand(-shake, shake));
    drawBg();
    Draw.text(ctx, '密 码 推 理', 36, 36, 24, '#FFE9A8', 'left', 'bold', 'rgba(0,0,0,.4)', 4);
    Draw.text(ctx, '宿舍门禁 · 4 位密码 · 10 次机会', 38, 58, 11, 'rgba(255,255,255,.5)', 'left');
    Draw.text(ctx, '用时 ' + Math.floor(elapsed) + 's', 928, 36, 12, 'rgba(255,255,255,.45)', 'right');
    drawHistory();
    drawInput();
    ctx.restore();

    if (over && winGlow > 0) {
      ctx.fillStyle = `rgba(255, 220, 130, ${winGlow * 0.12})`;
      ctx.fillRect(0, 0, W, H);
    }
    confetti.forEach(c => {
      ctx.globalAlpha = clamp(c.life / c.max, 0, 1);
      ctx.fillStyle = c.color;
      ctx.fillRect(c.x, c.y, c.r * 2, c.r * 2);
    });
    ctx.globalAlpha = 1;
  }

  function update(dt) {
    if (paused) return;
    if (!over) elapsed += dt;
    if (noticeTimer > 0) noticeTimer -= dt;
    if (shake > 0) shake = Math.max(0, shake - dt * 60);
    if (winGlow > 0) winGlow = Math.min(1, winGlow + dt);
    confetti.forEach(c => {
      c.life -= dt;
      c.x += c.vx * dt;
      c.y += c.vy * dt;
      c.vy += 220 * dt;
    });
    confetti = confetti.filter(c => c.life > 0);
  }

  function loop(t) {
    if (paused || destroyed) return;
    if (!last) last = t;
    const dt = Math.min(0.05, (t - last) / 1000);
    last = t;
    update(dt);
    draw();
    raf = requestAnimationFrame(loop);
  }

  newSecret();
  draw();
  raf = requestAnimationFrame(loop);

  return {
    pause() { paused = true; cancelAnimationFrame(raf); },
    resume() { paused = false; last = 0; raf = requestAnimationFrame(loop); },
    destroy() {
      destroyed = true;
      cancelAnimationFrame(raf);
      canvas.removeEventListener('pointerdown', onClick);
      window.removeEventListener('keydown', onKey);
    }
  };
};
