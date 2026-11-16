/* =========================================================
   食堂贪吃蛇 · 子衿食堂
   方向键 / WASD 转向，吃遍食堂，别撞墙也别咬到自己
   ========================================================= */
'use strict';

GameRegistry.canteen = function (stage, api) {
  const W = 960, H = 600;
  const canvas = makeCanvas(stage, W, H);
  const ctx = canvas.getContext('2d');
  const CELL = 36, COLS = 24, ROWS = 13, OX = 48, OY = 74;
  const GW = COLS * CELL, GH = ROWS * CELL;
  const rnd = seeded(3011);

  let paused = false, over = false, destroyed = false;
  let raf = 0, last = 0;
  let score = 0, eaten = 0, acc = 0, stepMs = 150, elapsed = 0;
  let deathFlash = 0, popScale = 1;
  let dir = { x: 1, y: 0 }, queue = [];
  let snake = [], prev = [], food = null, special = null, obstacles = [];
  let stageLevel = 0;

  const FOODS = [
    { type: 'tomato', name: '番茄', color: '#E8745B', score: 10 },
    { type: 'bao', name: '包子', color: '#FFF6E0', score: 10 },
    { type: 'rice', name: '盖饭', color: '#F5E6C8', score: 10 },
    { type: 'greens', name: '青菜', color: '#7BC96F', score: 10 },
    { type: 'milk', name: '奶茶', color: '#F2C6A0', score: 10 },
    { type: 'leg', name: '鸡腿', color: '#C98A5B', score: 20 }
  ];

  function reset() {
    snake = [{ x: 7, y: 6 }, { x: 6, y: 6 }, { x: 5, y: 6 }];
    prev = snake.map(s => ({ ...s }));
    dir = { x: 1, y: 0 };
    queue = [];
    obstacles = [];
    spawnFood();
    special = null;
  }

  function occupied(x, y) {
    return snake.some(s => s.x === x && s.y === y) ||
      obstacles.some(o => o.x === x && o.y === y) ||
      (food && food.x === x && food.y === y);
  }

  function spawnFood() {
    let guard = 0;
    do {
      food = { x: randInt(1, COLS - 2), y: randInt(1, ROWS - 2) };
      guard++;
    } while (occupied(food.x, food.y) && guard < 400);
    food.cfg = choice(FOODS);
    if (rnd() < 0.16) food.cfg = FOODS[5];
    food.born = elapsed;
  }

  function addObstacles(n) {
    for (let i = 0; i < n; i++) {
      let guard = 0, x, y;
      do {
        const horizontal = rnd() < 0.5;
        x = randInt(2, COLS - 3);
        y = randInt(2, ROWS - 3);
        if (horizontal) x = clamp(x, 1, COLS - 3);
        guard++;
      } while ((occupied(x, y) || dist(x, y, snake[0].x, snake[0].y) < 5) && guard < 200);
      obstacles.push({ x, y });
    }
  }

  function turn(nx, ny) {
    const lastD = queue.length ? queue[queue.length - 1] : dir;
    if (lastD.x === -nx && lastD.y === -ny) return;
    if (lastD.x === nx && lastD.y === ny) return;
    if (queue.length < 2) queue.push({ x: nx, y: ny });
  }

  const onKey = e => {
    const k = e.key;
    let handled = true;
    if (k === 'ArrowLeft' || k === 'a' || k === 'A') turn(-1, 0);
    else if (k === 'ArrowRight' || k === 'd' || k === 'D') turn(1, 0);
    else if (k === 'ArrowUp' || k === 'w' || k === 'W') turn(0, -1);
    else if (k === 'ArrowDown' || k === 's' || k === 'S') turn(0, 1);
    else handled = false;
    if (handled) e.preventDefault();
  };
  let touchStart = null;
  const onPointerDown = e => { const p = canvasPos(canvas, e); touchStart = p; };
  const onPointerUp = e => {
    if (!touchStart) return;
    const p = canvasPos(canvas, e);
    const dx = p.x - touchStart.x, dy = p.y - touchStart.y;
    if (Math.hypot(dx, dy) < 24) { touchStart = null; return; }
    if (Math.abs(dx) > Math.abs(dy)) turn(dx > 0 ? 1 : -1, 0);
    else turn(0, dy > 0 ? 1 : -1);
    touchStart = null;
  };
  window.addEventListener('keydown', onKey);
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointerup', onPointerUp);

  function die() {
    if (over) return;
    over = true;
    deathFlash = 1;
    Sfx.play('lose');
    setTimeout(() => {
      if (destroyed) return;
      api.finish({
        score,
        win: false,
        subtitle: '你一头撞上了' + (hitWall ? '食堂的墙' : '自己的尾巴'),
        stats: [
          ['吃到菜品', eaten + ' 份'],
          ['蛇身长度', snake.length + ' 节'],
          ['坚持时间', Math.floor(elapsed) + ' 秒']
        ],
        detail: `长度${snake.length} · ${eaten}份 · ${Math.floor(elapsed)}秒`,
        tip: '提示：转弯提前半拍按，别贴着墙走；鸡腿一份顶两份，但别为了它把自己绕死。'
      });
    }, 780);
  }
  let hitWall = false;

  function step() {
    if (queue.length) dir = queue.shift();
    const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };
    if (head.x < 0 || head.x >= COLS || head.y < 0 || head.y >= ROWS) { hitWall = true; die(); return; }
    if (obstacles.some(o => o.x === head.x && o.y === head.y)) { hitWall = true; die(); return; }
    if (snake.some((s, i) => i < snake.length - 1 && s.x === head.x && s.y === head.y)) { hitWall = false; die(); return; }

    prev = snake.map(s => ({ ...s }));
    snake.unshift(head);
    let grow = false;
    if (food && head.x === food.x && head.y === food.y) {
      grow = true;
      score += food.cfg.score;
      eaten++;
      popScale = 1.5;
      Sfx.play(food.cfg.type === 'leg' ? 'up' : 'coin');
      spawnFood();
      stepMs = Math.max(78, 150 - eaten * 2.1);
      if (eaten === 10 && stageLevel < 1) { stageLevel = 1; addObstacles(3); }
      if (eaten === 22 && stageLevel < 2) { stageLevel = 2; addObstacles(4); }
      if (eaten === 36 && stageLevel < 3) { stageLevel = 3; addObstacles(4); }
    }
    if (!grow) snake.pop();
    else {
      // 新增尾节从原尾位置开始，插值更顺滑
      prev.push({ ...prev[prev.length - 1] });
    }
  }

  function update(dt) {
    elapsed += dt;
    acc += dt * 1000;
    let guard = 0;
    while (acc >= stepMs && !over && guard < 4) {
      acc -= stepMs;
      step();
      guard++;
    }
    if (popScale > 1) popScale = Math.max(1, popScale - dt * 3);
    if (deathFlash > 0) deathFlash = Math.max(0, deathFlash - dt * 1.6);
  }

  /* ---------------- 绘制 ---------------- */
  function drawBoard() {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#FFF1D6');
    g.addColorStop(1, '#F6DDB4');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // 墙面瓷砖
    ctx.strokeStyle = 'rgba(200, 150, 100, .16)';
    ctx.lineWidth = 1.5;
    for (let x = 0; x < W; x += 34) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, OY - 18); ctx.stroke();
    }
    for (let y = 0; y < OY - 18; y += 34) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }

    // 招牌
    Draw.fillRR(ctx, 24, 10, 250, 46, 10, '#C8452F', '#3B2F2A', 3);
    Draw.text(ctx, '子衿食堂 · 今天吃点什么', 149, 27, 16, '#FFE9A8', 'center', 'bold', 'rgba(122,35,24,.6)', 3);
    Draw.text(ctx, 'SHAHE CANTEEN', 149, 44, 8, 'rgba(255,233,168,.75)');

    // 灯笼
    [[700, 46], [820, 46]].forEach(([x, y]) => {
      ctx.strokeStyle = '#3B2F2A';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, y - 14); ctx.stroke();
      Draw.fillRR(ctx, x - 20, y - 14, 40, 34, 11, '#E2553C', '#3B2F2A', 2.5);
      ctx.strokeStyle = 'rgba(255,255,255,.45)';
      ctx.beginPath(); ctx.arc(x, y + 3, 11, 0.3, Math.PI - 0.3); ctx.stroke();
      ctx.strokeStyle = '#F5C451';
      ctx.beginPath(); ctx.moveTo(x, y + 20); ctx.lineTo(x, y + 32); ctx.stroke();
    });

    // 餐桌板
    ctx.save();
    ctx.shadowColor = 'rgba(120, 80, 40, .28)';
    ctx.shadowBlur = 16;
    ctx.shadowOffsetY = 6;
    Draw.fillRR(ctx, OX - 10, OY - 10, GW + 20, GH + 20, 16, '#C98A5B', '#3B2F2A', 4);
    ctx.restore();
    Draw.fillRR(ctx, OX, OY, GW, GH, 8, '#FFF8E6', '#B98E63', 2);
    // 格子
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        if ((x + y) % 2 === 0) {
          ctx.fillStyle = 'rgba(210, 226, 180, .35)';
          ctx.fillRect(OX + x * CELL, OY + y * CELL, CELL, CELL);
        }
      }
    }
    // 边缘餐盘装饰
    Draw.text(ctx, '今日供应：糖醋里脊 / 麻辣香锅 / 免费汤', 480, OY - 22, 11, 'rgba(120, 84, 58, .65)');
  }

  function cellC(x, y) {
    return { x: OX + x * CELL + CELL / 2, y: OY + y * CELL + CELL / 2 };
  }

  function drawFoods() {
    // 障碍餐桌
    obstacles.forEach(o => {
      const p = cellC(o.x, o.y);
      ctx.save();
      ctx.translate(p.x, p.y);
      Draw.fillRR(ctx, -CELL * 0.42, -CELL * 0.42, CELL * 0.84, CELL * 0.84, 8, '#B77A4E', '#3B2F2A', 2.5);
      ctx.fillStyle = '#F7F3E7';
      ctx.beginPath();
      ctx.arc(0, 0, CELL * 0.22, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(59,47,42,.4)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();
    });

    if (!food) return;
    const p = cellC(food.x, food.y);
    const bob = Math.sin(elapsed * 4 + food.x) * 2;
    const cfg = food.cfg;
    ctx.save();
    ctx.translate(p.x, p.y + bob);
    ctx.scale(popScale, popScale);
    // 光晕
    ctx.fillStyle = 'rgba(245, 196, 81, .22)';
    ctx.beginPath();
    ctx.arc(0, 0, CELL * 0.52, 0, Math.PI * 2);
    ctx.fill();
    if (cfg.type === 'tomato') {
      ctx.fillStyle = '#E8745B';
      ctx.beginPath(); ctx.arc(0, 2, 12, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#8C3B2B'; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = '#5A9A5F';
      ctx.beginPath();
      ctx.ellipse(-4, -11, 5, 2.6, -0.6, 0, Math.PI * 2);
      ctx.ellipse(4, -11, 5, 2.6, 0.6, 0, Math.PI * 2);
      ctx.fill();
    } else if (cfg.type === 'bao') {
      ctx.fillStyle = '#FFF6E0';
      ctx.beginPath();
      ctx.arc(0, 2, 13, Math.PI, 0);
      ctx.lineTo(13, 8);
      ctx.quadraticCurveTo(0, 16, -13, 8);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#B98E63'; ctx.lineWidth = 2; ctx.stroke();
      ctx.strokeStyle = 'rgba(185,142,99,.8)';
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(0, -10);
        ctx.lineTo(0, 2);
        ctx.stroke();
        ctx.rotate(Math.PI / 3);
      }
    } else if (cfg.type === 'rice') {
      Draw.fillRR(ctx, -14, -4, 28, 14, 6, '#FFFDF5', '#3B2F2A', 2);
      ctx.fillStyle = '#F5E6C8';
      ctx.beginPath(); ctx.ellipse(0, -4, 15, 9, 0, Math.PI, 0); ctx.fill();
      ctx.fillStyle = '#C98A5B';
      ctx.beginPath(); ctx.arc(-5, -6, 4, 0, Math.PI * 2); ctx.arc(5, -8, 4, 0, Math.PI * 2); ctx.fill();
    } else if (cfg.type === 'greens') {
      ctx.strokeStyle = '#2E6B45';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(0, 12); ctx.lineTo(0, -2); ctx.stroke();
      ctx.fillStyle = '#7BC96F';
      [[-8, -8, -0.6], [8, -8, 0.6], [0, -14, 0]].forEach(([x, y, r]) => {
        ctx.beginPath();
        ctx.ellipse(x, y, 9, 5.5, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#3E8257';
        ctx.lineWidth = 1.8;
        ctx.stroke();
      });
    } else if (cfg.type === 'milk') {
      Draw.fillRR(ctx, -10, -10, 20, 24, 4, '#F2C6A0', '#3B2F2A', 2);
      ctx.strokeStyle = '#8B5E3C';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(6, -10); ctx.lineTo(13, -24); ctx.stroke();
      ctx.fillStyle = 'rgba(139,94,60,.5)';
      ctx.fillRect(-9, -4, 18, 10);
    } else {
      // 鸡腿
      ctx.save();
      ctx.rotate(0.5);
      ctx.fillStyle = '#C98A5B';
      ctx.beginPath();
      ctx.ellipse(0, 0, 11, 13, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#6E4A32'; ctx.lineWidth = 2; ctx.stroke();
      ctx.strokeStyle = '#FFF6E0';
      ctx.lineWidth = 6;
      ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(2, 11); ctx.lineTo(9, 19); ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
    // 飘分
    if (popScale > 1.05) {
      Draw.text(ctx, '+' + cfg.score, p.x, p.y - 26, 14, '#E8745B', 'center', 'bold', '#FFFDF5', 3);
    }
  }

  function drawSnake() {
    const t = clamp(acc / stepMs, 0, 1);
    for (let i = snake.length - 1; i >= 0; i--) {
      const s = snake[i];
      const p0 = prev[i] || prev[prev.length - 1] || s;
      const gx = lerp(p0.x, s.x, t);
      const gy = lerp(p0.y, s.y, t);
      const p = cellC(gx, gy);
      const isHead = i === 0;
      const r = CELL * (isHead ? 0.46 : 0.42);
      // 阴影
      ctx.fillStyle = 'rgba(120, 84, 58, .16)';
      ctx.beginPath();
      ctx.arc(p.x + 2, p.y + 3, r, 0, Math.PI * 2);
      ctx.fill();
      // 身体
      const grad = i === 0 ? '#8FD983' : (i % 2 ? '#6FBF73' : '#7BC96F');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = over ? '#B4553E' : '#2E6B45';
      ctx.lineWidth = 2.4;
      ctx.stroke();
      // 腹部
      ctx.fillStyle = 'rgba(255,255,255,.28)';
      ctx.beginPath();
      ctx.arc(p.x - r * 0.2, p.y - r * 0.25, r * 0.42, 0, Math.PI * 2);
      ctx.fill();
      if (isHead) {
        const dx = dir.x, dy = dir.y;
        const ex = p.x + dx * 5, ey = p.y + dy * 5;
        const px = -dy * 5, py = dx * 5;
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(ex + px, ey + py, 4.2, 0, Math.PI * 2);
        ctx.arc(ex - px, ey - py, 4.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#3B2F2A';
        ctx.beginPath();
        ctx.arc(ex + px + dx * 0.8, ey + py + dy * 0.8, 2.1, 0, Math.PI * 2);
        ctx.arc(ex - px + dx * 0.8, ey - py + dy * 0.8, 2.1, 0, Math.PI * 2);
        ctx.fill();
        // 舌头
        if (!over) {
          ctx.strokeStyle = '#E2553C';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(p.x + dx * r, p.y + dy * r);
          ctx.lineTo(p.x + dx * (r + 8), p.y + dy * (r + 8));
          ctx.stroke();
        }
        // 小苗
        ctx.fillStyle = '#5A9A5F';
        ctx.beginPath();
        ctx.ellipse(p.x + 4, p.y - r - 5, 6, 3.2, -0.6, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function drawHUD() {
    Draw.text(ctx, '得分', 330, 18, 11, 'rgba(120,84,58,.7)', 'left');
    Draw.text(ctx, fmtScore(score), 330, 42, 24, '#3B2F2A', 'left');
    Draw.text(ctx, '长度 ' + snake.length, 460, 20, 12, 'rgba(120,84,58,.75)', 'left');
    Draw.text(ctx, '已吃 ' + eaten + ' 份', 460, 40, 12, 'rgba(120,84,58,.75)', 'left');
    Draw.text(ctx, '速度 ' + (150 / stepMs).toFixed(1) + 'x', 590, 20, 12, 'rgba(120,84,58,.75)', 'left');
    Draw.text(ctx, '时间 ' + Math.floor(elapsed) + 's', 590, 40, 12, 'rgba(120,84,58,.75)', 'left');
    // 小提示
    Draw.fillRR(ctx, OX, H - 30, 300, 20, 10, 'rgba(255,253,245,.7)', 'rgba(185,142,99,.5)', 1.2);
    Draw.text(ctx, '方向键 / WASD / 滑动屏幕转向', OX + 150, H - 20, 10.5, '#8B6B52');
    // 阶段提示
    if (stageLevel > 0) {
      Draw.text(ctx, '餐桌已摆开 · 小心绕行', W - 60, H - 20, 11, '#B4553E', 'right');
    }
  }

  reset();
  // 开局给一点缓冲
  stepMs = 190;
  setTimeout(() => {
    if (!destroyed && !over && stepMs === 190) stepMs = 150;
  }, 900);

  function draw() {
    drawBoard();
    drawFoods();
    drawHUD();
    drawSnake();
    if (deathFlash > 0) {
      ctx.fillStyle = `rgba(180, 60, 40, ${deathFlash * 0.3})`;
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
      destroyed = true; over = true;
      cancelAnimationFrame(raf);
      window.removeEventListener('keydown', onKey);
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointerup', onPointerUp);
    }
  };
};
