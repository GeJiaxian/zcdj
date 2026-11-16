/* =========================================================
   骋望楼 · 诸葛嘻嘻
   大厅 + 找不同
   ========================================================= */
'use strict';

const PuzzleSub = {};
const LibraryState = { lastSub: null };

const LIB_META = {
  spot: { sub: 'spot', record: 'puzzle-spot', title: '找不同', subText: '找两幅校园图中的 5 处不同 · 点错扣分', icon: '找', color: '#E8745B' },
  link: { sub: 'link', record: 'puzzle-link', title: '一笔连线', subText: '连连看：一笔连起两个相同图标，最多两次转弯', icon: '连', color: '#57A773' },
  code: { sub: 'code', record: 'puzzle-code', title: '密码推理', subText: '4 位不重复门禁密码 · 用 A/B 反馈推理，10 次机会', icon: '密', color: '#6E8FB8' },
  gomoku: { sub: 'gomoku', record: 'gomoku', title: '五子棋', subText: '人机 / 双人同屏 / 浏览器联机对战', icon: '棋', color: '#9C6B4A' }
};

GameRegistry.library = function (stage, api) {
  let sub = null;

  function clearStage() {
    if (sub && sub.destroy) {
      try { sub.destroy(); } catch (e) { console.warn(e); }
    }
    sub = null;
    stage.innerHTML = '';
  }

  function bestText(record) {
    const b = Store.best(record);
    return b ? `最高 ${b.score.toLocaleString('zh-CN')}` : '暂无战绩';
  }

  function lobby() {
    clearStage();
    LibraryState.lastSub = null;
    api.setTitle('诸葛嘻嘻');
    api.setSub('骋望楼益智四连：找不同 / 一笔连线 / 密码推理 / 五子棋');
    const cards = Object.values(LIB_META).map(m => `
      <button class="lib-card" data-sub="${m.sub}">
        <span class="lib-badge" style="background:${m.color}">${m.icon}</span>
        <b>${m.title}</b>
        <small>${m.subText}</small>
        <em>${bestText(m.record)}</em>
      </button>`).join('');
    stage.innerHTML = `
      <div class="lib-lobby">
        <div class="lib-head">
          <h2>诸葛嘻嘻</h2>
          <p>骋望楼 · 四款益智小游戏，专治各种脑子痒</p>
        </div>
        <div class="lib-grid">${cards}</div>
        <p class="lib-foot">小提示：每款游戏战绩独立记录，五子棋支持复制邀请码与同学联机对战。</p>
      </div>`;
    $$('.lib-card', stage).forEach(card => {
      card.addEventListener('click', () => {
        Sfx.play('click');
        start(card.dataset.sub);
      });
    });
  }

  function start(key) {
    const meta = LIB_META[key];
    if (!meta) return;
    clearStage();
    LibraryState.lastSub = key;
    api.setTitle('诸葛嘻嘻 · ' + meta.title);
    api.setSub(meta.subText);
    const back = document.createElement('button');
    back.className = 'stage-back';
    back.textContent = '← 换个小游戏';
    back.addEventListener('click', () => { Sfx.play('click'); lobby(); });
    stage.appendChild(back);

    const subApi = Object.assign({}, api, {
      finish: r => api.finish(Object.assign({ recordId: meta.record }, r)),
      setSub: t => api.setSub(t)
    });
    if (key === 'gomoku') {
      sub = GameRegistry.gomoku(stage, subApi);
    } else if (PuzzleSub[key]) {
      sub = PuzzleSub[key](stage, subApi);
    }
  }

  if (api.restarting && LibraryState.lastSub) start(LibraryState.lastSub);
  else lobby();

  return {
    pause() { if (sub && sub.pause) sub.pause(); },
    resume() { if (sub && sub.resume) sub.resume(); },
    destroy() { clearStage(); }
  };
};

/* =========================================================
   找不同
   ========================================================= */
PuzzleSub.spot = function (stage, api) {
  const W = 960, H = 600;
  const canvas = makeCanvas(stage, W, H);
  const ctx = canvas.getContext('2d');
  const PW = 440, PH = 320;
  const PANELS = [{ x: 28, y: 96 }, { x: 492, y: 96 }];
  const TOTAL_TIME = 90;

  const DIFFS = [
    { id: 'sun', name: '太阳表情', x: 68, y: 62, r: 30 },
    { id: 'cloud', name: '多出的云', x: 336, y: 40, r: 30 },
    { id: 'balloon', name: '气球颜色', x: 120, y: 96, r: 28 },
    { id: 'apple', name: '苹果数量', x: 100, y: 196, r: 28 },
    { id: 'window', name: '亮着的窗', x: 338, y: 176, r: 24 },
    { id: 'flag', name: '旗子颜色', x: 404, y: 120, r: 24 },
    { id: 'cat', name: '猫咪尾巴', x: 248, y: 254, r: 26 },
    { id: 'bench', name: '长椅颜色', x: 202, y: 258, r: 28 },
    { id: 'flower', name: '小花颜色', x: 320, y: 288, r: 26 },
    { id: 'bird', name: '飞过的小鸟', x: 176, y: 70, r: 24 }
  ];

  let chosen = [], found = [], wrong = 0;
  let timeLeft = TOTAL_TIME, score = 0;
  let raf = 0, last = 0, paused = false, over = false, destroyed = false;
  let effects = [], won = false;

  function reset() {
    chosen = shuffle(DIFFS).slice(0, 5);
    found = [];
    wrong = 0;
    timeLeft = TOTAL_TIME;
    score = 0;
    effects = [];
    over = false;
    won = false;
  }

  const has = id => chosen.some(d => d.id === id) && found.some(f => f.id === id);

  /* ---------------- 场景绘制（440×320） ---------------- */
  function drawScene(alt) {
    const A = id => alt && chosen.some(d => d.id === id);
    // 天空
    const sky = ctx.createLinearGradient(0, 0, 0, 210);
    sky.addColorStop(0, '#CFEAFA');
    sky.addColorStop(1, '#EDF7E5');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, PW, PH);
    // 远山
    ctx.fillStyle = '#CFE6BE';
    ctx.beginPath();
    ctx.ellipse(120, 236, 210, 74, 0, Math.PI, Math.PI * 2);
    ctx.fill();
    // 草地
    ctx.fillStyle = '#A9D69A';
    ctx.beginPath();
    ctx.ellipse(PW / 2, 330, 300, 100, 0, Math.PI, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#8FC97F';
    ctx.beginPath();
    ctx.ellipse(PW / 2, 342, 330, 110, 0, Math.PI, Math.PI * 2);
    ctx.fill();

    // 太阳
    ctx.save();
    ctx.shadowColor = 'rgba(255,220,120,.8)';
    ctx.shadowBlur = 18;
    ctx.fillStyle = '#FFD966';
    ctx.beginPath();
    ctx.arc(68, 62, 26, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = 'rgba(224,164,42,.55)';
    ctx.lineWidth = 3;
    for (let i = 0; i < 8; i++) {
      const a = i * Math.PI / 4;
      ctx.beginPath();
      ctx.moveTo(68 + Math.cos(a) * 32, 62 + Math.sin(a) * 32);
      ctx.lineTo(68 + Math.cos(a) * 40, 62 + Math.sin(a) * 40);
      ctx.stroke();
    }
    if (!A('sun')) {
      ctx.fillStyle = '#7A5A20';
      ctx.beginPath();
      ctx.arc(59, 59, 2.2, 0, Math.PI * 2);
      ctx.arc(77, 59, 2.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#7A5A20';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(68, 64, 7, 0.25, Math.PI - 0.25);
      ctx.stroke();
    }

    // 云
    Draw.cloud(ctx, 208, 50, 62, '#FFFFFF', 0.95);
    Draw.cloud(ctx, 350, 94, 44, '#FFFFFF', 0.85);
    if (A('cloud')) Draw.cloud(ctx, 336, 36, 38, '#FFFFFF', 0.95);

    // 主楼（骋望楼）
    const bx = 262, by = 132, bw = 152, bh = 118;
    Draw.fillRR(ctx, bx, by - 18, bw, 22, 4, '#4A7C59', '#3B2F2A', 2.6);
    Draw.fillRR(ctx, bx, by, bw, bh, 3, '#EFE0C4', '#3B2F2A', 2.8);
    for (let i = 0; i < 4; i++) {
      const wx = bx + 12 + i * 34;
      const lit = i === 2 ? A('window') : false;
      Draw.fillRR(ctx, wx, by + 14, 22, 82, 3, lit ? '#FFD97D' : '#6E8FB8', '#3B2F2A', 2);
      ctx.fillStyle = 'rgba(255,255,255,.25)';
      ctx.fillRect(wx + 4, by + 18, 4, 74);
    }
    Draw.fillRR(ctx, bx + 52, by + 96, 48, 22, 3, '#7B3F2A', '#3B2F2A', 2.2);
    Draw.text(ctx, '骋望楼', bx + 76, by + 107, 9, '#FFE9A8');

    // 树
    ctx.fillStyle = '#8B5E3C';
    ctx.fillRect(100, 232, 12, 46);
    ctx.strokeStyle = '#3B2F2A';
    ctx.lineWidth = 2;
    ctx.strokeRect(100, 232, 12, 46);
    ctx.fillStyle = '#5A9A5F';
    [[104, 206, 44], [72, 214, 30], [136, 214, 30]].forEach(([x, y, r]) => {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.strokeStyle = '#3B6B45';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.arc(104, 206, 44, 0, Math.PI * 2);
    ctx.stroke();
    // 苹果
    const apples = A('apple') ? [[80, 208], [122, 210]] : [[80, 208], [104, 188], [122, 210]];
    apples.forEach(([x, y]) => {
      ctx.fillStyle = '#E8745B';
      ctx.beginPath();
      ctx.arc(x, y, 5.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#A2482F';
      ctx.lineWidth = 1.6;
      ctx.stroke();
    });

    // 长椅
    const benchColor = A('bench') ? '#6FBF73' : '#C98A5B';
    Draw.fillRR(ctx, 174, 250, 62, 8, 4, benchColor, '#3B2F2A', 2.2);
    Draw.fillRR(ctx, 174, 238, 62, 8, 4, benchColor, '#3B2F2A', 2.2);
    ctx.strokeStyle = '#3B2F2A';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(180, 258); ctx.lineTo(180, 272);
    ctx.moveTo(230, 258); ctx.lineTo(230, 272);
    ctx.stroke();

    // 猫
    if (!A('cat')) {
      ctx.save();
      ctx.translate(248, 250);
      // 尾巴
      ctx.strokeStyle = '#D9A15E';
      ctx.lineWidth = 5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(9, 12);
      ctx.quadraticCurveTo(22, 6, 18, -4);
      ctx.stroke();
      // 身体
      ctx.fillStyle = '#F5D7A8';
      ctx.beginPath();
      ctx.ellipse(0, 12, 12, 11, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#3B2F2A';
      ctx.lineWidth = 2;
      ctx.stroke();
      // 头
      ctx.beginPath();
      ctx.arc(0, -2, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      // 耳朵
      ctx.beginPath();
      ctx.moveTo(-8, -8); ctx.lineTo(-11, -16); ctx.lineTo(-3, -11);
      ctx.moveTo(8, -8); ctx.lineTo(11, -16); ctx.lineTo(3, -11);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#3B2F2A';
      ctx.beginPath();
      ctx.arc(-3.4, -3, 1.5, 0, Math.PI * 2);
      ctx.arc(3.4, -3, 1.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 小花
    const fColor = A('flower') ? '#B58AD6' : '#F2A6C0';
    [[300, 290], [320, 282], [340, 291]].forEach(([x, y]) => {
      ctx.strokeStyle = '#5A9A5F';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x, y + 8); ctx.lineTo(x, y); ctx.stroke();
      for (let i = 0; i < 5; i++) {
        const a = i * Math.PI * 2 / 5;
        ctx.fillStyle = fColor;
        ctx.beginPath();
        ctx.arc(x + Math.cos(a) * 5.5, y + Math.sin(a) * 5.5, 4, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = '#FFE27A';
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fill();
    });

    // 气球
    const balloonColor = A('balloon') ? '#6E8FB8' : '#E8745B';
    ctx.strokeStyle = 'rgba(90,80,70,.6)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(120, 112);
    ctx.quadraticCurveTo(128, 136, 120, 158);
    ctx.stroke();
    ctx.fillStyle = balloonColor;
    ctx.beginPath();
    ctx.ellipse(120, 92, 17, 21, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(59,47,42,.5)';
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.5)';
    ctx.beginPath();
    ctx.ellipse(114, 84, 5, 8, -0.4, 0, Math.PI * 2);
    ctx.fill();
    // 气球结
    ctx.fillStyle = balloonColor;
    ctx.beginPath();
    ctx.moveTo(116, 112); ctx.lineTo(124, 112); ctx.lineTo(120, 118);
    ctx.closePath();
    ctx.fill();

    // 小鸟
    if (!A('bird')) {
      ctx.strokeStyle = '#5A5048';
      ctx.lineWidth = 2.4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(166, 72);
      ctx.quadraticCurveTo(172, 65, 178, 72);
      ctx.quadraticCurveTo(184, 65, 190, 72);
      ctx.stroke();
    }

    // 旗子
    ctx.strokeStyle = '#3B2F2A';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(398, 108);
    ctx.lineTo(398, 152);
    ctx.stroke();
    ctx.fillStyle = A('flag') ? '#6FBF73' : '#E2553C';
    ctx.beginPath();
    ctx.moveTo(398, 110);
    ctx.lineTo(424, 119);
    ctx.lineTo(398, 128);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#3B2F2A';
    ctx.lineWidth = 1.6;
    ctx.stroke();

    // 前景草
    ctx.strokeStyle = 'rgba(90, 154, 95, .55)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 12; i++) {
      const x = 20 + i * 36;
      ctx.beginPath();
      ctx.moveTo(x, 316);
      ctx.quadraticCurveTo(x + 3, 304, x + 8, 300);
      ctx.stroke();
    }
  }

  function drawPanel(origin, alt, label) {
    ctx.save();
    ctx.translate(origin.x, origin.y);
    Draw.fillRR(ctx, -6, -6, PW + 12, PH + 12, 14, '#FFFDF5', '#3B2F2A', 3.5);
    ctx.save();
    Draw.rr(ctx, 0, 0, PW, PH, 8);
    ctx.clip();
    drawScene(alt);
    // 已找到标记
    found.forEach((d, i) => {
      const pulse = 1 + Math.sin(nowSec() * 4 + i) * 0.06;
      ctx.save();
      ctx.translate(d.x, d.y);
      ctx.scale(pulse, pulse);
      ctx.strokeStyle = 'rgba(87, 167, 115, .95)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(0, 0, d.r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = 'rgba(87, 167, 115, .95)';
      ctx.beginPath();
      ctx.arc(d.r * 0.78, -d.r * 0.78, 10, 0, Math.PI * 2);
      ctx.fill();
      Draw.text(ctx, String(i + 1), d.r * 0.78, -d.r * 0.78 - 1, 12, '#FFFDF5');
      ctx.restore();
    });
    // 点击特效
    effects.forEach(e => {
      ctx.globalAlpha = clamp(e.life / 0.6, 0, 1);
      ctx.strokeStyle = e.ok ? '#57A773' : '#E8745B';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2);
      ctx.stroke();
      if (!e.ok) {
        ctx.beginPath();
        ctx.moveTo(e.x - 8, e.y - 8); ctx.lineTo(e.x + 8, e.y + 8);
        ctx.moveTo(e.x + 8, e.y - 8); ctx.lineTo(e.x - 8, e.y + 8);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    });
    ctx.restore();
    ctx.restore();
    // 标签
    Draw.fillRR(ctx, origin.x + PW / 2 - 34, origin.y - 28, 68, 22, 11, 'rgba(255,253,245,.9)', '#C9B48F', 1.4);
    Draw.text(ctx, label, origin.x + PW / 2, origin.y - 17, 11, '#7A5C3E');
  }

  function onClick(e) {
    if (paused || over) return;
    const p = canvasPos(canvas, e);
    let local = null;
    for (const o of PANELS) {
      if (p.x >= o.x && p.x <= o.x + PW && p.y >= o.y && p.y <= o.y + PH) {
        local = { x: p.x - o.x, y: p.y - o.y };
        break;
      }
    }
    if (!local) return;
    const hit = chosen.find(d => !found.includes(d) && dist(local.x, local.y, d.x, d.y) <= d.r + 4);
    if (hit) {
      found.push(hit);
      score += 100;
      effects.push({ x: local.x, y: local.y, r: 18, life: 0.6, ok: true });
      Sfx.play('pop');
      if (found.length === chosen.length) {
        won = true;
        setTimeout(() => finishGame(), 480);
      }
    } else {
      wrong++;
      timeLeft = Math.max(0, timeLeft - 3);
      score = Math.max(0, score - 25);
      effects.push({ x: local.x, y: local.y, r: 16, life: 0.6, ok: false });
      Sfx.play('wrong');
    }
  }
  canvas.addEventListener('pointerdown', onClick);

  function finishGame() {
    if (over || destroyed) return;
    over = true;
    cancelAnimationFrame(raf);
    const rest = Math.max(0, Math.ceil(timeLeft));
    const finalScore = won ? score + rest * 8 : score;
    api.finish({
      score: finalScore,
      win: won,
      title: won ? '五处全中！' : '时间到',
      subtitle: won ? '骋望楼的每个角落都被你看穿了' : `还有 ${chosen.length - found.length} 处没找到`,
      stats: [
        ['找到不同', found.length + ' / 5'],
        ['剩余时间', rest + ' 秒'],
        ['点错次数', wrong]
      ],
      detail: won ? `全找齐 · 剩余${rest}秒 · 错${wrong}次` : `找到${found.length}/5 · 错${wrong}次`,
      tip: '提示：先扫一遍天空和建筑，再看树下、长椅和花坛；点错会扣分并扣时间，想清楚再点。'
    });
  }

  /* ---------------- 更新与绘制 ---------------- */
  function draw() {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#2A3A4D');
    g.addColorStop(1, '#1E2A33');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // 顶部
    Draw.text(ctx, '找 不 同', 40, 32, 24, '#FFE9A8', 'left', 'bold', 'rgba(0,0,0,.4)', 4);
    Draw.text(ctx, '点出两幅图中不一样的地方', 42, 56, 11, 'rgba(255,255,255,.5)', 'left');
    Draw.text(ctx, '得分 ' + score, 470, 30, 16, '#FFFDF5', 'center');
    Draw.text(ctx, '找到 ' + found.length + ' / 5', 470, 54, 12, 'rgba(255,255,255,.55)', 'center');
    // 计时
    const tw = 240, tx = 690;
    Draw.fillRR(ctx, tx, 22, tw, 12, 6, 'rgba(255,255,255,.15)', null);
    const ratio = clamp(timeLeft / TOTAL_TIME, 0, 1);
    Draw.fillRR(ctx, tx, 22, Math.max(4, tw * ratio), 12, 6, ratio < 0.25 ? '#E8745B' : '#7BC96F', null);
    Draw.text(ctx, Math.ceil(timeLeft) + 's', tx + tw + 24, 28, 14, timeLeft < 15 ? '#FF9A86' : '#FFFDF5');

    drawPanel(PANELS[0], false, '左图');
    drawPanel(PANELS[1], true, '右图');

    // 底部
    Draw.text(ctx, '5 处不同 · 点对 +100 分 · 点错 -25 分并扣 3 秒', W / 2, 448, 13, 'rgba(255,255,255,.6)');
    chosen.forEach((d, i) => {
      const isFound = found.includes(d);
      const x = 300 + i * 76;
      Draw.fillRR(ctx, x - 30, 470, 60, 26, 13,
        isFound ? 'rgba(87,167,115,.9)' : 'rgba(255,255,255,.08)',
        isFound ? '#A8D5A2' : 'rgba(255,255,255,.22)', 1.5);
      Draw.text(ctx, isFound ? (i + 1) + ' ✓' : '?', x, 483, 12, isFound ? '#FFFDF5' : 'rgba(255,255,255,.4)');
    });
    // 提示
    Draw.fillRR(ctx, 250, 516, 460, 30, 15, 'rgba(255,255,255,.06)', 'rgba(255,255,255,.14)', 1);
    const tip = found.length === 5 ? '全部找齐，漂亮！' : '小提示：先看天空，再看建筑和草地';
    Draw.text(ctx, tip, W / 2, 531, 12, 'rgba(255,255,255,.65)');
  }

  function update(dt) {
    if (paused || over) return;
    timeLeft -= dt;
    for (let i = effects.length - 1; i >= 0; i--) {
      effects[i].life -= dt;
      if (effects[i].life <= 0) effects.splice(i, 1);
    }
    if (timeLeft <= 0) {
      timeLeft = 0;
      finishGame();
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

  reset();
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
