/* =========================================================
   跳地为牢 · 大学生活动中心
   四轨音游：D F J K 击打，跟着节拍踩准每一个音符
   ========================================================= */
'use strict';

GameRegistry.activity = function (stage, api) {
  const W = 960, H = 600;
  const canvas = makeCanvas(stage, W, H);
  const ctx = canvas.getContext('2d');

  const LANES = 4;
  const LANE_W = 92;
  const FIELD_W = LANE_W * LANES;
  const FIELD_X = (W - FIELD_W) / 2;
  const JUDGE_Y = 500;
  const BPM = 128;
  const BEAT = 60 / BPM;
  const TRAVEL = 1.55;
  const SPEED = (JUDGE_Y + 60) / TRAVEL;
  const TOTAL_BEATS = 144;
  const SONG_LEN = TOTAL_BEATS * BEAT;
  const LANE_COLORS = ['#FF7BC0', '#6FE3FF', '#FFD97D', '#A8D5A2'];
  const LANE_KEYS = ['D', 'F', 'J', 'K'];
  const KEY_MAP = { d: 0, f: 1, j: 2, k: 3, D: 0, F: 1, J: 2, K: 3 };

  const rnd = seeded(128128);
  let paused = false, over = false, destroyed = false, started = false;
  let raf = 0, last = 0;
  let songTime = -1.2, musicStart = 0;
  let score = 0, combo = 0, maxCombo = 0, perfect = 0, good = 0, miss = 0;
  let judgeText = '', judgeTimer = 0, judgeColor = '#fff';
  let laneFlash = [0, 0, 0, 0];
  let particles = [], ringPulse = 0, endTimer = 0;

  const notes = [];
  // 生成谱面
  (function makeChart() {
    for (let bar = 0; bar < 33; bar++) {
      const base = 8 + bar * 4;
      const dense = bar >= 6;
      for (let b = 0; b < 4; b++) {
        const t = (base + b) * BEAT;
        if (rnd() < 0.78) {
          notes.push({ t, lane: randInt(0, 3), hit: false, missed: false });
        }
        if (dense && b % 2 === 1 && rnd() < 0.55) {
          const lane = randInt(0, 3);
          notes.push({ t: t + BEAT * 0.5, lane, hit: false, missed: false });
        }
        if (bar >= 10 && rnd() < 0.3) {
          const lane1 = randInt(0, 3);
          notes.push({ t, lane: lane1, hit: false, missed: false });
          notes.push({ t, lane: (lane1 + 2) % 4, hit: false, missed: false, twin: true });
        }
      }
    }
    notes.sort((a, b) => a.t - b.t);
  })();
  const TOTAL_NOTES = notes.length;

  /* ---------------- 音乐合成 ---------------- */
  function scheduleMusic(t0) {
    const c = Sfx.ctx;
    if (!c) return;
    Sfx.ensureNoise();
    const out = c.createGain();
    out.gain.value = 0.62;
    out.connect(Sfx.master);

    const kick = (when) => {
      const o = c.createOscillator(), g = c.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(150, when);
      o.frequency.exponentialRampToValueAtTime(46, when + 0.16);
      g.gain.setValueAtTime(0.5, when);
      g.gain.exponentialRampToValueAtTime(0.001, when + 0.2);
      o.connect(g).connect(out);
      o.start(when); o.stop(when + 0.22);
    };
    const hat = (when, soft = 0.09) => {
      const src = c.createBufferSource();
      if (!Sfx.noiseBuf) return;
      src.buffer = Sfx.noiseBuf;
      const f = c.createBiquadFilter();
      f.type = 'highpass';
      f.frequency.value = 6800;
      const g = c.createGain();
      g.gain.setValueAtTime(soft, when);
      g.gain.exponentialRampToValueAtTime(0.0001, when + 0.05);
      src.connect(f).connect(g).connect(out);
      src.start(when); src.stop(when + 0.06);
    };
    const bass = (when, freq, dur) => {
      const o = c.createOscillator(), g = c.createGain();
      o.type = 'triangle';
      o.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, when);
      g.gain.exponentialRampToValueAtTime(0.26, when + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
      o.connect(g).connect(out);
      o.start(when); o.stop(when + dur + 0.02);
    };
    const lead = (when, freq, dur, vol = 0.1) => {
      const o = c.createOscillator(), g = c.createGain();
      o.type = 'square';
      o.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, when);
      g.gain.exponentialRampToValueAtTime(vol, when + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
      o.connect(g).connect(out);
      o.start(when); o.stop(when + dur + 0.03);
    };

    const A2 = 220, C3 = 261.63, D3 = 293.66, E3 = 329.63, G3 = 392, A3 = 440;
    const roots = [A2, C3, D3, E3];
    const scale = [440, 523.25, 587.33, 659.25, 783.99, 880, 1046.5];
    for (let b = 0; b < TOTAL_BEATS; b++) {
      const when = t0 + b * BEAT;
      const bar = Math.floor(b / 4);
      if (b >= 4) {
        kick(when);
        if (b % 4 === 2) kick(when + BEAT * 0.5);
        hat(when + BEAT * 0.5, 0.1);
        if (b % 4 === 1 || b % 4 === 3) hat(when, 0.06);
        bass(when, roots[bar % roots.length], BEAT * 0.9);
        if (bar % 2 === 0) bass(when + BEAT * 0.5, roots[(bar + 1) % roots.length], BEAT * 0.4);
      }
      if (bar >= 4) {
        const step = Math.floor((b * 2) % 8);
        const f = scale[[0, 2, 4, 3, 5, 4, 2, 1][step]];
        lead(when, f, BEAT * 0.32, b % 4 === 0 ? 0.09 : 0.055);
        if (bar % 4 === 3) lead(when + BEAT * 0.5, f * 1.5, BEAT * 0.22, 0.05);
      }
    }
  }

  function startAudio() {
    Sfx.init();
    if (!Sfx.ctx) return;
    musicStart = Sfx.ctx.currentTime + 1.2;
    scheduleMusic(musicStart);
  }

  /* ---------------- 输入 ---------------- */
  function hitLane(lane) {
    if (paused || over || !started) return;
    if (songTime < -0.3) return;
    laneFlash[lane] = 1;
    let best = null, bestDiff = Infinity;
    for (const n of notes) {
      if (n.lane !== lane || n.hit || n.missed) continue;
      const d = n.t - songTime;
      if (d > 0.24) break;
      const ad = Math.abs(d);
      if (ad < bestDiff && ad <= 0.19) { best = n; bestDiff = ad; }
    }
    if (!best) {
      // 空敲：轻微惩罚
      combo = Math.max(0, combo - 1);
      return;
    }
    best.hit = true;
    let base, label, color, pts;
    if (bestDiff <= 0.085) {
      perfect++;
      pts = 1000;
      label = 'PERFECT';
      color = '#FFE27A';
      Sfx.play('perfect');
    } else {
      good++;
      pts = 500;
      label = 'GOOD';
      color = '#9BF2FF';
      Sfx.play('note');
    }
    combo++;
    maxCombo = Math.max(maxCombo, combo);
    score += pts + Math.min(combo, 50) * 3;
    judgeText = label;
    judgeColor = color;
    judgeTimer = 0.5;
    ringPulse = 0.4;
    const laneX = FIELD_X + lane * LANE_W + LANE_W / 2;
    for (let i = 0; i < 9; i++) {
      particles.push({
        x: laneX + rand(-26, 26), y: JUDGE_Y + rand(-10, 10),
        vx: rand(-130, 130), vy: rand(-260, -40), life: rand(0.3, 0.6), max: 0.6,
        color: LANE_COLORS[lane], r: rand(2, 4.5)
      });
    }
  }

  const onKeyDown = e => {
    if (e.repeat) return;
    const lane = KEY_MAP[e.key];
    if (lane === undefined) return;
    e.preventDefault();
    hitLane(lane);
  };
  const onPointerDown = e => {
    const p = canvasPos(canvas, e);
    if (p.y < 330) return;
    const lane = Math.floor((p.x - FIELD_X) / LANE_W);
    if (lane >= 0 && lane < 4) hitLane(lane);
  };
  window.addEventListener('keydown', onKeyDown);
  canvas.addEventListener('pointerdown', onPointerDown);

  /* ---------------- 更新 ---------------- */
  function update(dt) {
    if (!started) return;
    // 以音频时钟为准，暂停时 WebAudio 同步冻结，音画不漂移
    if (Sfx.ctx && Sfx.ctx.state !== 'closed') {
      songTime = Sfx.ctx.currentTime - musicStart;
    } else {
      songTime += dt;
    }
    if (judgeTimer > 0) judgeTimer -= dt;
    if (ringPulse > 0) ringPulse = Math.max(0, ringPulse - dt);
    laneFlash = laneFlash.map(v => Math.max(0, v - dt * 4));

    for (const n of notes) {
      if (n.hit || n.missed) continue;
      if (songTime - n.t > 0.19) {
        n.missed = true;
        miss++;
        combo = 0;
        judgeText = 'MISS';
        judgeColor = '#FF8A7A';
        judgeTimer = 0.4;
      }
    }

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 520 * dt;
      if (p.life <= 0) particles.splice(i, 1);
    }

    if (songTime > SONG_LEN + 1.2) {
      endTimer += dt;
      if (endTimer > 0.9 && !over) endSong();
    }
  }

  function endSong() {
    over = true;
    cancelAnimationFrame(raf);
    const total = TOTAL_NOTES;
    const acc = total ? (perfect + good * 0.6) / total : 0;
    const rank = acc >= 0.95 ? 'S' : acc >= 0.85 ? 'A' : acc >= 0.7 ? 'B' : acc >= 0.5 ? 'C' : 'D';
    const win = acc >= 0.6;
    setTimeout(() => {
      if (destroyed) return;
      api.finish({
        score,
        win,
        title: win ? '跳得漂亮！' : '舞步踩乱了……',
        subtitle: win ? '压力已经被踩在拍子上' : '再练一遍，把节奏找回来',
        stats: [
          ['评级', rank],
          ['PERFECT', perfect],
          ['GOOD / MISS', good + ' / ' + miss],
          ['最高连击', maxCombo]
        ],
        detail: `${rank}评 · 准确率 ${(acc * 100).toFixed(1)}% · 连击${maxCombo}`,
        tip: win ? '提示：想冲 S 就稳住 Perfect 判定，连击加成很可观。' : '提示：跟着鼓点按，不要被视觉带乱；判定线以上一小段就是最佳击打区。'
      });
    }, 500);
  }

  /* ---------------- 绘制 ---------------- */
  function drawBg() {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#170F2E');
    g.addColorStop(0.6, '#2A1A4A');
    g.addColorStop(1, '#120B22');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // 呼吸灯束
    const pulse = started ? 0.5 + 0.5 * Math.sin(songTime * Math.PI * 2 / BEAT * 0.5) : 0.5;
    for (let i = 0; i < 4; i++) {
      const x = FIELD_X + i * LANE_W + LANE_W / 2;
      const grad = ctx.createLinearGradient(x, 0, x, H);
      grad.addColorStop(0, 'rgba(255,255,255,.02)');
      grad.addColorStop(1, LANE_COLORS[i] + '22');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(x - 10, 0);
      ctx.lineTo(x + 10, 0);
      ctx.lineTo(x + 150, H);
      ctx.lineTo(x - 150, H);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 0.18 + pulse * 0.14;
      ctx.strokeStyle = LANE_COLORS[i];
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, 0); ctx.lineTo(x, H);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // 招牌
    ctx.save();
    ctx.shadowColor = '#6FE3FF';
    ctx.shadowBlur = 16;
    Draw.text(ctx, '大 活 · 跳 地 为 牢', 40, 40, 22, '#9BF2FF', 'left', 'bold', 'rgba(8,14,30,.7)', 4);
    ctx.restore();
    Draw.text(ctx, 'STAGE  ·  SHAHE', 42, 62, 9, 'rgba(255,255,255,.4)', 'left');

    // 观众
    const r = seeded(88);
    for (let i = 0; i < 22; i++) {
      const x = 12 + i * 44 + r() * 10;
      const y = H + 4 - r() * 16;
      ctx.fillStyle = 'rgba(5, 4, 12, .92)';
      ctx.beginPath();
      ctx.arc(x, y - 26, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(x, y, 14, 24, 0, Math.PI, Math.PI * 2);
      ctx.fill();
    }

    // 舞台侧边小人
    drawDancer(songTime);

    // 轨道底板
    Draw.fillRR(ctx, FIELD_X - 6, 90, FIELD_W + 12, JUDGE_Y - 90 + 18, 14, 'rgba(255,255,255,.045)', 'rgba(255,255,255,.13)', 2);
    // 判定线
    ctx.save();
    ctx.shadowColor = 'rgba(255, 255, 255, .8)';
    ctx.shadowBlur = 16 + (ringPulse > 0 ? 24 : 0);
    ctx.strokeStyle = 'rgba(255,255,255,.9)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(FIELD_X - 4, JUDGE_Y);
    ctx.lineTo(FIELD_X + FIELD_W + 4, JUDGE_Y);
    ctx.stroke();
    ctx.restore();
    // 轨道分隔
    ctx.strokeStyle = 'rgba(255,255,255,.12)';
    ctx.lineWidth = 2;
    for (let i = 1; i < LANES; i++) {
      const x = FIELD_X + i * LANE_W;
      ctx.beginPath();
      ctx.moveTo(x, 96);
      ctx.lineTo(x, JUDGE_Y + 10);
      ctx.stroke();
    }
    // 键位
    for (let i = 0; i < 4; i++) {
      const x = FIELD_X + i * LANE_W + LANE_W / 2;
      const y = JUDGE_Y + 34;
      const fl = laneFlash[i];
      ctx.save();
      ctx.globalAlpha = 0.55 + fl * 0.45;
      Draw.fillRR(ctx, x - 30, y - 20, 60, 40, 10, fl > 0.1 ? LANE_COLORS[i] : 'rgba(255,255,255,.08)', LANE_COLORS[i], 2);
      Draw.text(ctx, LANE_KEYS[i], x, y + 1, 20, fl > 0.1 ? '#241A2E' : '#FFFFFF', 'center', 'bold');
      ctx.restore();
    }
  }

  function drawDancer(t) {
    const beatPulse = Math.abs(Math.sin(t * Math.PI / BEAT));
    ctx.save();
    ctx.translate(830, 330);
    ctx.scale(1.55, 1.55);
    ctx.globalAlpha = 0.95;
    // 光晕
    ctx.fillStyle = 'rgba(255, 123, 192, .12)';
    ctx.beginPath();
    ctx.arc(0, 0, 90, 0, Math.PI * 2);
    ctx.fill();
    // 腿
    ctx.strokeStyle = '#3B2F2A';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-5, 26); ctx.lineTo(-16 - beatPulse * 6, 48);
    ctx.moveTo(5, 26); ctx.lineTo(18 + beatPulse * 6, 44);
    ctx.stroke();
    // 身体
    Draw.fillRR(ctx, -15, 0, 30, 30, 12, '#FFD97D', '#3B2F2A', 3);
    // 手臂
    ctx.strokeStyle = '#FFE0C2';
    ctx.lineWidth = 5.5;
    ctx.beginPath();
    ctx.moveTo(-14, 6); ctx.lineTo(-30, -12 - beatPulse * 8);
    ctx.moveTo(14, 6); ctx.lineTo(30, -10 + beatPulse * 6);
    ctx.stroke();
    // 头
    ctx.fillStyle = '#FFEBD2';
    ctx.beginPath();
    ctx.arc(0, -22, 17, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#3B2F2A';
    ctx.lineWidth = 2.6;
    ctx.stroke();
    ctx.fillStyle = '#3B2F2A';
    ctx.beginPath();
    ctx.ellipse(-5.5, -24, 2, 2.6, 0, 0, Math.PI * 2);
    ctx.ellipse(5.5, -24, 2, 2.6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(0, -18, 5, 0.15, Math.PI - 0.15);
    ctx.stroke();
    // 耳机
    ctx.strokeStyle = '#6FE3FF';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, -22, 18, Math.PI * 1.05, Math.PI * 1.95);
    ctx.stroke();
    // 叶子
    ctx.fillStyle = '#7BC96F';
    ctx.beginPath();
    ctx.ellipse(5, -39, 6.5, 3.2, -0.6, 0, Math.PI * 2);
    ctx.fill();
    // 音符环绕
    ctx.fillStyle = 'rgba(255,255,255,.65)';
    ctx.font = 'bold 14px "YouYuan", sans-serif';
    for (let i = 0; i < 3; i++) {
      const a = t * 1.6 + i * 2.2;
      ctx.globalAlpha = 0.35 + 0.4 * Math.abs(Math.sin(a));
      ctx.fillText(['♪', '♫', '♩'][i], Math.cos(a) * 46, Math.sin(a) * 30 - 10);
    }
    ctx.restore();
  }

  function drawNotes() {
    for (const n of notes) {
      if (n.hit || n.missed) continue;
      const dt = n.t - songTime;
      if (dt > TRAVEL + 0.2 || dt < -0.4) continue;
      const y = JUDGE_Y - dt * SPEED;
      const x = FIELD_X + n.lane * LANE_W + LANE_W / 2;
      const color = LANE_COLORS[n.lane];
      ctx.save();
      ctx.globalAlpha = 0.95;
      ctx.shadowColor = color;
      ctx.shadowBlur = 14;
      Draw.fillRR(ctx, x - 34, y - 12, 68, 24, 12, color, '#241A2E', 2.5);
      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(255,255,255,.7)';
      Draw.rr(ctx, x - 27, y - 6, 54, 4, 2);
      ctx.fill();
      Draw.text(ctx, LANE_KEYS[n.lane], x, y + 1, 13, 'rgba(36,26,46,.85)');
      ctx.restore();
    }
  }

  function drawHUD() {
    Draw.text(ctx, fmtScore(score), 40, 108, 34, '#FFF3C4', 'left', 'bold', 'rgba(0,0,0,.5)', 5);
    Draw.text(ctx, 'SCORE', 42, 132, 9, 'rgba(255,255,255,.4)', 'left');
    // 连击
    if (combo >= 2) {
      const s = 1 + Math.min(0.25, combo / 400);
      ctx.save();
      ctx.translate(W / 2, 190);
      ctx.scale(s, s);
      Draw.text(ctx, combo, 0, 0, 46, '#FFE27A', 'center', 'bold', 'rgba(0,0,0,.5)', 6);
      Draw.text(ctx, 'COMBO', 0, 32, 12, 'rgba(255,255,255,.65)', 'center');
      ctx.restore();
    }
    // 进度
    const prog = clamp((songTime / SONG_LEN), 0, 1);
    Draw.fillRR(ctx, 620, 106, 300, 10, 5, 'rgba(255,255,255,.14)', null);
    Draw.fillRR(ctx, 620, 106, Math.max(4, 300 * prog), 10, 5, '#FF7BC0', null);
    Draw.text(ctx, '准确率 ' + (perfect + good + miss ? ((perfect + good * 0.6) / (perfect + good + miss) * 100).toFixed(1) : '100.0') + '%', 920, 132, 11, 'rgba(255,255,255,.55)', 'right');

    // 判定文字
    if (judgeTimer > 0) {
      ctx.save();
      ctx.globalAlpha = clamp(judgeTimer * 3, 0, 1);
      Draw.text(ctx, judgeText, W / 2, 380, judgeText === 'PERFECT' ? 28 : 24, judgeColor, 'center', 'bold', 'rgba(0,0,0,.45)', 5);
      ctx.restore();
    }
    // 倒计时
    if (songTime < 0) {
      Draw.text(ctx, Math.ceil(-songTime) + '', W / 2, 300, 64, '#FFF3C4', 'center', 'bold', 'rgba(0,0,0,.5)', 8);
      Draw.text(ctx, '准备好了吗', W / 2, 352, 16, 'rgba(255,255,255,.75)');
    }
    // 提示
    if (started && songTime >= 0 && songTime < 2.5) {
      ctx.globalAlpha = 1 - clamp(songTime / 2.5, 0, 1);
      Draw.text(ctx, 'D  F  J  K  ·  踩准节拍', W / 2, 300, 18, '#FFFFFF', 'center', 'bold', 'rgba(0,0,0,.5)', 4);
      ctx.globalAlpha = 1;
    }
  }

  function draw() {
    drawBg();
    drawNotes();
    particles.forEach(p => {
      ctx.globalAlpha = clamp(p.life / p.max, 0, 1);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
    drawHUD();
  }

  function loop(t) {
    if (paused || over || destroyed) return;
    if (!last) last = t;
    const dt = Math.min(0.05, (t - last) / 1000);
    last = t;
    if (!started) {
      started = true;
      startAudio();
    }
    update(dt);
    draw();
    if (!over) raf = requestAnimationFrame(loop);
  }

  draw();
  raf = requestAnimationFrame(loop);

  return {
    pause() {
      paused = true;
      cancelAnimationFrame(raf);
      if (Sfx.ctx && Sfx.ctx.state === 'running') Sfx.ctx.suspend();
    },
    resume() {
      if (over) return;
      paused = false;
      last = 0;
      if (Sfx.ctx && Sfx.ctx.state === 'suspended') Sfx.ctx.resume();
      raf = requestAnimationFrame(loop);
    },
    destroy() {
      destroyed = true; over = true;
      cancelAnimationFrame(raf);
      window.removeEventListener('keydown', onKeyDown);
      canvas.removeEventListener('pointerdown', onPointerDown);
      if (Sfx.ctx && Sfx.ctx.state === 'suspended') Sfx.ctx.resume();
    }
  };
};
