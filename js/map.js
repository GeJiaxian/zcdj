/* =========================================================
   校园地图：五处地标插画（全部 Canvas 代码绘制）+ 小人寻路进入
   ========================================================= */
'use strict';

/* 可复现的伪随机，保证每次刷新插画一致 */
function seeded(seed) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

const MapArt = {
  init() {
    $$('canvas[data-art]').forEach(c => {
      const ctx = c.getContext('2d');
      const fn = this[c.dataset.art];
      if (fn) { ctx.save(); fn.call(this, ctx, c.width, c.height); ctx.restore(); }
    });
  },

  /* ---------- 通用小部件 ---------- */
  sky(ctx, w, h, stops) {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    stops.forEach(([p, c]) => g.addColorStop(p, c));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  },
  stars(ctx, w, h, n, seed) {
    const r = seeded(seed);
    for (let i = 0; i < n; i++) {
      const x = r() * w, y = r() * h * 0.7;
      ctx.globalAlpha = 0.3 + r() * 0.7;
      ctx.fillStyle = '#FFF6D0';
      ctx.beginPath();
      ctx.arc(x, y, 0.7 + r() * 1.3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  },
  tree(ctx, x, y, s, dark = '#2E6B45', light = '#4E9160') {
    ctx.fillStyle = '#7A5236';
    ctx.fillRect(x - s * 0.06, y - s * 0.25, s * 0.12, s * 0.3);
    ctx.fillStyle = dark;
    ctx.beginPath();
    ctx.arc(x, y - s * 0.52, s * 0.3, 0, Math.PI * 2);
    ctx.arc(x - s * 0.26, y - s * 0.36, s * 0.24, 0, Math.PI * 2);
    ctx.arc(x + s * 0.26, y - s * 0.36, s * 0.24, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = light;
    ctx.beginPath();
    ctx.arc(x - s * 0.1, y - s * 0.62, s * 0.18, 0, Math.PI * 2);
    ctx.fill();
  },
  parcel(ctx, x, y, s, color = '#C98A5B', label = '') {
    ctx.save();
    ctx.translate(x, y);
    Draw.fillRR(ctx, -s / 2, -s / 2, s, s, s * 0.12, color, '#3B2F2A', 2.6);
    ctx.strokeStyle = 'rgba(59,47,42,.35)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(-s / 2 + 2, 0);
    ctx.lineTo(s / 2 - 2, 0);
    ctx.stroke();
    ctx.fillStyle = '#FFF3D8';
    Draw.fillRR(ctx, -s * 0.16, -s * 0.14, s * 0.32, s * 0.24, 2, '#FFF3D8', null);
    if (label) Draw.text(ctx, label, 0, s * 0.32, s * 0.28, '#FFF3D8');
    ctx.restore();
  },

  /* ---------- 1. 宿舍楼 · 保卫宿舍 ---------- */
  dorm(ctx, w, h) {
    this.sky(ctx, w, h, [[0, '#16233F'], [0.62, '#2D4670'], [1, '#4B6B8F']]);
    this.stars(ctx, w, h, 46, 7);
    // 月亮
    ctx.save();
    ctx.shadowColor = 'rgba(255, 238, 170, .85)';
    ctx.shadowBlur = 26;
    ctx.fillStyle = '#FFEAA0';
    ctx.beginPath();
    ctx.arc(302, 34, 17, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = 'rgba(255,255,255,.15)';
    ctx.beginPath();
    ctx.arc(296, 29, 4.5, 0, Math.PI * 2);
    ctx.arc(308, 40, 3.2, 0, Math.PI * 2);
    ctx.fill();
    // 地面
    ctx.fillStyle = '#1C2B25';
    ctx.beginPath();
    ctx.ellipse(w * 0.5, h + 10, w * 0.72, 46, 0, 0, Math.PI * 2);
    ctx.fill();
    this.tree(ctx, 30, h - 8, 70, '#1E3A2E', '#2C5340');
    this.tree(ctx, 340, h - 6, 60, '#1E3A2E', '#2C5340');

    // 宿舍楼
    const bx = 56, by = 84, bw = 248, bh = 132;
    ctx.fillStyle = 'rgba(0,0,0,.25)';
    ctx.beginPath();
    ctx.ellipse(bx + bw / 2, h - 4, bw * 0.5, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    Draw.fillRR(ctx, bx, by, bw, bh, 8, '#E7CFAC', '#3B2F2A', 4);
    ctx.fillStyle = '#C9A87F';
    ctx.fillRect(bx, by, bw, 13);
    Draw.text(ctx, '6 号 宿 舍 楼', bx + bw / 2, by + 7, 10, '#FFF3D8');
    // 窗户
    const r = seeded(21);
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 6; col++) {
        const wx = bx + 20 + col * 37;
        const wy = by + 25 + row * 32;
        const lit = r() > 0.45;
        Draw.fillRR(ctx, wx, wy, 24, 20, 4, lit ? '#FFD97D' : '#4E5D6E', '#3B2F2A', 2);
        if (lit) {
          ctx.fillStyle = 'rgba(255, 236, 170, .35)';
          ctx.beginPath();
          ctx.arc(wx + 12, wy + 10, 16, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.strokeStyle = 'rgba(59,47,42,.5)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(wx + 12, wy + 2);
        ctx.lineTo(wx + 12, wy + 18);
        ctx.stroke();
      }
    }
    // 阳台与门
    Draw.fillRR(ctx, bx + bw / 2 - 22, by + bh - 30, 44, 30, 4, '#6E4A32', '#3B2F2A', 3);
    ctx.fillStyle = '#FFD97D';
    ctx.beginPath();
    ctx.arc(bx + bw / 2, by + bh - 16, 4, 0, Math.PI * 2);
    ctx.fill();
    // 睡觉的 Zzz
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,.85)';
    ctx.font = 'bold 15px "YouYuan", sans-serif';
    ctx.fillText('Z', 140, 104);
    ctx.font = 'bold 20px "YouYuan", sans-serif';
    ctx.fillText('z', 152, 96);
    ctx.font = 'bold 25px "YouYuan", sans-serif';
    ctx.fillText('Z', 165, 86);
    ctx.restore();

    // 小飞机
    this.plane(ctx, 104, 62, 1.05);
    // 向上的子弹
    ctx.strokeStyle = 'rgba(255, 226, 130, .8)';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    [[94, 48, 94, 22], [114, 46, 114, 20]].forEach(([x1, y1, x2, y2]) => {
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    });
    // 掉落的烦恼
    this.fallingItem(ctx, 226, 26, 30, '#EE8A5D', '早八');
    this.fallingItem(ctx, 268, 42, 26, '#8AB6E8', '作业');
    this.fallingItem(ctx, 244, 66, 22, '#C6E3A8', '签到');
    ctx.strokeStyle = 'rgba(255,255,255,.28)';
    ctx.lineWidth = 2;
    [[224, 44], [226, 54], [269, 60], [270, 72]].forEach(([x, y]) => {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y - 8);
      ctx.stroke();
    });
  },

  plane(ctx, x, y, s) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    ctx.rotate(-0.06);
    // 尾焰
    ctx.fillStyle = 'rgba(255, 200, 100, .65)';
    ctx.beginPath();
    ctx.moveTo(-14, 18);
    ctx.quadraticCurveTo(0, 34, 14, 18);
    ctx.quadraticCurveTo(0, 23, -14, 18);
    ctx.fill();
    // 机翼
    ctx.fillStyle = '#F7F1DC';
    ctx.strokeStyle = '#3B2F2A';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, -26);
    ctx.lineTo(20, 12);
    ctx.lineTo(8, 20);
    ctx.lineTo(0, 10);
    ctx.lineTo(-8, 20);
    ctx.lineTo(-20, 12);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // 机身
    ctx.fillStyle = '#57A773';
    ctx.beginPath();
    ctx.ellipse(0, -2, 6.5, 16, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // 驾驶舱
    ctx.fillStyle = '#BFE6F6';
    ctx.beginPath();
    ctx.arc(0, -13, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // 小苗
    ctx.fillStyle = '#7BC96F';
    ctx.beginPath();
    ctx.ellipse(2, -22, 5, 3, -0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  },

  fallingItem(ctx, x, y, s, color, label) {
    Draw.fillRR(ctx, x - s / 2, y - s / 2, s, s, 6, color, '#3B2F2A', 2.6);
    Draw.text(ctx, label, x, y + 1, Math.max(9, s * 0.34), '#FFFDF5', 'center', 'bold', 'rgba(59,47,42,.35)', 2);
  },

  /* ---------- 2. 子衿食堂 · 贪吃蛇 ---------- */
  canteen(ctx, w, h) {
    this.sky(ctx, w, h, [[0, '#FFF0CE'], [1, '#F6D9A8']]);
    // 瓷砖墙
    ctx.strokeStyle = 'rgba(190, 140, 90, .22)';
    ctx.lineWidth = 1.5;
    for (let x = 0; x < w; x += 30) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 132); ctx.stroke();
    }
    for (let y = 0; y < 132; y += 30) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }
    // 招牌
    Draw.fillRR(ctx, 84, 12, 192, 38, 8, '#C8452F', '#3B2F2A', 3);
    Draw.text(ctx, '子衿食堂', 180, 27, 22, '#FFE9A8', 'center', 'bold', '#7A2318', 4);
    Draw.text(ctx, 'SHAHE CANTEEN', 180, 42, 7.5, 'rgba(255,233,168,.8)', 'center', 'bold');
    // 灯笼
    [[22, 30], [338, 30]].forEach(([x, y]) => {
      ctx.strokeStyle = '#3B2F2A';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, y - 10); ctx.stroke();
      Draw.fillRR(ctx, x - 14, y - 10, 28, 26, 9, '#E2553C', '#3B2F2A', 2.5);
      ctx.strokeStyle = 'rgba(255,255,255,.5)';
      ctx.beginPath(); ctx.arc(x, y + 3, 8, 0.3, Math.PI - 0.3); ctx.stroke();
      ctx.strokeStyle = '#F5C451';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x, y + 16); ctx.lineTo(x, y + 26); ctx.stroke();
    });
    // 柜台
    Draw.fillRR(ctx, 0, 150, w, 53, 0, '#C98A5B', null);
    ctx.fillStyle = '#B3714A';
    ctx.fillRect(0, 150, w, 8);
    ctx.strokeStyle = 'rgba(59,47,42,.25)';
    for (let x = 18; x < w; x += 48) {
      ctx.beginPath(); ctx.moveTo(x, 160); ctx.lineTo(x, h); ctx.stroke();
    }
    // 餐盘
    ctx.fillStyle = '#F7F3E7';
    ctx.beginPath();
    ctx.ellipse(72, 168, 40, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#3B2F2A';
    ctx.lineWidth = 2.5;
    ctx.stroke();
    // 大碗面
    Draw.fillRR(ctx, 128, 142, 80, 36, 8, '#FFFDF5', '#3B2F2A', 3);
    ctx.fillStyle = '#FFE0A8';
    ctx.beginPath();
    ctx.ellipse(168, 145, 36, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#E0A34A';
    ctx.lineWidth = 3;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(146 + i * 16, 141);
      ctx.quadraticCurveTo(150 + i * 16, 132, 158 + i * 16, 139);
      ctx.stroke();
    }
    // 热气
    ctx.strokeStyle = 'rgba(255,255,255,.8)';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    [150, 168, 186].forEach((x, i) => {
      ctx.beginPath();
      ctx.moveTo(x, 130);
      ctx.bezierCurveTo(x - 8, 118, x + 8, 112, x, 98 - i * 2);
      ctx.stroke();
    });
    // 筷子
    ctx.strokeStyle = '#8B5E3C';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(212, 128);
    ctx.lineTo(252, 164);
    ctx.moveTo(220, 124);
    ctx.lineTo(258, 158);
    ctx.stroke();
    // 贪吃蛇
    ctx.save();
    ctx.translate(292, 108);
    ctx.fillStyle = '#6FBF73';
    ctx.strokeStyle = '#2E6B45';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-6, 40);
    ctx.bezierCurveTo(-38, 26, -8, 2, 8, 12);
    ctx.bezierCurveTo(22, 22, 0, 30, -14, 20);
    ctx.strokeStyle = '#6FBF73';
    ctx.lineWidth = 15;
    ctx.lineCap = 'round';
    ctx.stroke();
    ctx.strokeStyle = '#2E6B45';
    ctx.lineWidth = 3;
    // 头
    ctx.fillStyle = '#7BC96F';
    ctx.beginPath();
    ctx.arc(-16, 20, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(-21, 16, 4.5, 0, Math.PI * 2);
    ctx.arc(-11, 16, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#3B2F2A';
    ctx.beginPath();
    ctx.arc(-21, 16, 2.2, 0, Math.PI * 2);
    ctx.arc(-11, 16, 2.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#E2553C';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-26, 25);
    ctx.lineTo(-36, 27);
    ctx.moveTo(-26, 25);
    ctx.lineTo(-35, 31);
    ctx.stroke();
    ctx.restore();
    // 包子
    ctx.fillStyle = '#FFF6E0';
    ctx.beginPath();
    ctx.arc(258, 170, 11, Math.PI, 0);
    ctx.fill();
    ctx.strokeStyle = '#3B2F2A';
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(200,140,80,.7)';
    ctx.beginPath();
    ctx.moveTo(258, 160);
    ctx.lineTo(258, 168);
    ctx.stroke();
  },

  /* ---------- 3. 大活 · 跳地为牢 ---------- */
  activity(ctx, w, h) {
    this.sky(ctx, w, h, [[0, '#170F2E'], [0.6, '#2A1A4A'], [1, '#402A63']]);
    // 灯束
    const beams = [
      [54, 'rgba(255, 120, 180, .28)'], [150, 'rgba(120, 220, 255, .22)'],
      [250, 'rgba(255, 210, 120, .24)'], [318, 'rgba(160, 130, 255, .26)']
    ];
    beams.forEach(([x, color]) => {
      const g = ctx.createLinearGradient(x, 0, w / 2, h);
      g.addColorStop(0, color);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(x - 6, -4);
      ctx.lineTo(x + 6, -4);
      ctx.lineTo(w / 2 + 120, h);
      ctx.lineTo(w / 2 - 120, h);
      ctx.closePath();
      ctx.fill();
    });
    // 霓虹招牌
    ctx.save();
    ctx.shadowColor = '#6FE3FF';
    ctx.shadowBlur = 18;
    Draw.text(ctx, '大 活', 62, 34, 30, '#9BF2FF', 'left', 'bold', 'rgba(10,20,40,.65)', 5);
    ctx.shadowColor = '#FF7BC0';
    Draw.text(ctx, '跳地为牢', 64, 62, 13, '#FFB8DE', 'left', 'bold');
    ctx.restore();
    // 舞台
    ctx.fillStyle = 'rgba(255,255,255,.08)';
    ctx.beginPath();
    ctx.ellipse(w / 2, 190, 190, 34, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 150, 220, .5)';
    ctx.lineWidth = 2;
    ctx.stroke();
    // 观众剪影
    const r = seeded(5);
    for (let i = 0; i < 16; i++) {
      const x = 8 + i * 23 + r() * 8;
      const y = h + 2 - r() * 14;
      ctx.fillStyle = 'rgba(8, 6, 18, .9)';
      ctx.beginPath();
      ctx.arc(x, y - 20, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(x, y, 11, 18, 0, Math.PI, Math.PI * 2);
      ctx.fill();
    }
    // 跳舞的小人
    ctx.save();
    ctx.translate(w / 2, 122);
    // 腿
    ctx.strokeStyle = '#3B2F2A';
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-7, 30); ctx.lineTo(-22, 56);
    ctx.moveTo(7, 30); ctx.lineTo(24, 50);
    ctx.stroke();
    // 身体
    Draw.fillRR(ctx, -19, -4, 38, 38, 16, '#F5C451', '#3B2F2A', 3.5);
    // 手臂
    ctx.strokeStyle = '#FFE0C2';
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(-17, 6); ctx.lineTo(-38, -12);
    ctx.moveTo(17, 6); ctx.lineTo(38, -16);
    ctx.stroke();
    // 头
    ctx.fillStyle = '#FFEBD2';
    ctx.beginPath();
    ctx.arc(0, -30, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#3B2F2A';
    ctx.lineWidth = 3.2;
    ctx.stroke();
    // 耳机
    ctx.strokeStyle = '#6FE3FF';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, -30, 24, Math.PI * 1.05, Math.PI * 1.95);
    ctx.stroke();
    ctx.fillStyle = '#6FE3FF';
    ctx.beginPath(); ctx.arc(-23, -28, 5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(23, -28, 5, 0, Math.PI * 2); ctx.fill();
    // 表情
    ctx.fillStyle = '#3B2F2A';
    ctx.beginPath();
    ctx.ellipse(-7, -32, 2.6, 3.4, 0, 0, Math.PI * 2);
    ctx.ellipse(7, -32, 2.6, 3.4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#3B2F2A';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.arc(0, -24, 6, 0.15, Math.PI - 0.15);
    ctx.stroke();
    // 叶子
    ctx.fillStyle = '#7BC96F';
    ctx.beginPath();
    ctx.ellipse(6, -52, 8, 4, -0.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    // 音符
    ctx.save();
    ctx.globalAlpha = .85;
    Draw.text(ctx, '♪', 92, 100, 26, '#FFB8DE', 'center', 'bold', 'rgba(0,0,0,.3)', 3);
    Draw.text(ctx, '♫', 272, 78, 30, '#9BF2FF', 'center', 'bold', 'rgba(0,0,0,.3)', 3);
    ctx.restore();
    // 四个轨道提示
    ['D', 'F', 'J', 'K'].forEach((k, i) => {
      ctx.fillStyle = 'rgba(255,255,255,.14)';
      Draw.fillRR(ctx, 128 + i * 27, 172, 22, 18, 5, 'rgba(255,255,255,.12)', 'rgba(255,255,255,.3)', 1.5);
      Draw.text(ctx, k, 139 + i * 27, 181, 10, 'rgba(255,255,255,.85)');
    });
  },

  /* ---------- 4. 骋望楼 · 诸葛嘻嘻 ---------- */
  library(ctx, w, h) {
    this.sky(ctx, w, h, [[0, '#4A5A82'], [0.45, '#9E7E93'], [1, '#F2C08A']]);
    // 落日
    ctx.save();
    ctx.shadowColor = 'rgba(255, 220, 150, .9)';
    ctx.shadowBlur = 30;
    ctx.fillStyle = '#FFE0A0';
    ctx.beginPath();
    ctx.arc(288, 76, 26, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    // 云
    Draw.cloud(ctx, 84, 44, 56, '#FFE9D2', .55);
    Draw.cloud(ctx, 226, 30, 40, '#FFE9D2', .4);
    // 骋望楼
    const bx = 96, by = 44, bw = 168, bh = 146;
    ctx.fillStyle = 'rgba(30, 30, 40, .22)';
    ctx.beginPath();
    ctx.ellipse(bx + bw / 2, h - 4, bw * 0.52, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    Draw.fillRR(ctx, bx, by, bw, bh, 6, '#EFE0C4', '#3B2F2A', 4);
    // 竖向书脊窗
    for (let i = 0; i < 6; i++) {
      const x = bx + 14 + i * 24;
      const colors = ['#6E8FB8', '#8AA9C9', '#5C7FA8'];
      ctx.fillStyle = colors[i % 3];
      Draw.fillRR(ctx, x, by + 18, 16, 110, 3, colors[i % 3], '#3B2F2A', 2);
      ctx.fillStyle = 'rgba(255,255,255,.25)';
      ctx.fillRect(x + 3, by + 24, 3, 96);
      ctx.strokeStyle = 'rgba(59,47,42,.3)';
      ctx.lineWidth = 1;
      for (let y = by + 30; y < by + 120; y += 12) {
        ctx.beginPath(); ctx.moveTo(x + 2, y); ctx.lineTo(x + 14, y); ctx.stroke();
      }
    }
    // 顶部坡檐
    ctx.fillStyle = '#C7B08C';
    ctx.beginPath();
    ctx.moveTo(bx - 8, by + 4);
    ctx.lineTo(bx + bw / 2, by - 16);
    ctx.lineTo(bx + bw + 8, by + 4);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#3B2F2A';
    ctx.lineWidth = 3.5;
    ctx.stroke();
    // 牌匾
    Draw.fillRR(ctx, bx + 50, by + 128, 68, 18, 4, '#7B3F2A', '#3B2F2A', 2.5);
    Draw.text(ctx, '骋望楼', bx + 84, by + 137, 11, '#FFE9A8');
    // 门前台阶
    Draw.fillRR(ctx, bx + 40, by + bh, 88, 7, 2, '#CDB997', '#3B2F2A', 2);
    // 树
    this.tree(ctx, 36, h - 4, 92, '#2E6B45', '#5A9A5F');
    this.tree(ctx, 326, h - 2, 84, '#2E6B45', '#5A9A5F');
    // 书堆
    const books = [['#E8745B', 84], ['#57A773', 76], ['#6E8FB8', 68]];
    let byy = h - 12;
    books.forEach(([c, ww]) => {
      Draw.fillRR(ctx, 24, byy - 9, ww, 11, 2, c, '#3B2F2A', 2);
      byy -= 12;
    });
    // 放大镜
    ctx.save();
    ctx.translate(286, 156);
    ctx.strokeStyle = '#3B2F2A';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(12, 12);
    ctx.lineTo(26, 26);
    ctx.stroke();
    ctx.fillStyle = 'rgba(205, 234, 247, .55)';
    ctx.beginPath();
    ctx.arc(0, 0, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#3B2F2A';
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,.85)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(-4, -4, 9, Math.PI * 0.9, Math.PI * 1.7);
    ctx.stroke();
    ctx.restore();
    // 棋盘一角
    ctx.save();
    ctx.translate(62, 168);
    ctx.rotate(-0.08);
    Draw.fillRR(ctx, 0, 0, 54, 34, 3, '#E9C98F', '#3B2F2A', 2.5);
    ctx.strokeStyle = 'rgba(59,47,42,.55)';
    ctx.lineWidth = 1;
    for (let i = 1; i < 5; i++) {
      ctx.beginPath(); ctx.moveTo(i * 10.8, 2); ctx.lineTo(i * 10.8, 32); ctx.stroke();
    }
    for (let j = 1; j < 3; j++) {
      ctx.beginPath(); ctx.moveTo(2, j * 11.3); ctx.lineTo(52, j * 11.3); ctx.stroke();
    }
    ctx.fillStyle = '#2B2622';
    ctx.beginPath(); ctx.arc(21.6, 11.3, 4.2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#FFFDF5';
    ctx.beginPath(); ctx.arc(32.4, 22.6, 4.2, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#3B2F2A'; ctx.lineWidth = 1.4; ctx.stroke();
    ctx.restore();
  },

  /* ---------- 5. 快递驿站 · 包裹雨 ---------- */
  express(ctx, w, h) {
    this.sky(ctx, w, h, [[0, '#F9C98A'], [0.55, '#F6A97E'], [1, '#E8826D']]);
    // 云
    Draw.cloud(ctx, 60, 32, 46, '#FFF1DC', .7);
    Draw.cloud(ctx, 236, 24, 38, '#FFF1DC', .55);
    // 远处楼
    ctx.fillStyle = 'rgba(120, 80, 70, .22)';
    ctx.fillRect(0, 128, 90, 75);
    ctx.fillRect(250, 140, 110, 63);
    // 地面
    ctx.fillStyle = '#C97C5A';
    ctx.beginPath();
    ctx.ellipse(w / 2, h + 22, w * 0.75, 56, 0, 0, Math.PI * 2);
    ctx.fill();
    // 驿站小屋
    const hx = 96, hy = 92, hw = 168, hh = 96;
    Draw.fillRR(ctx, hx, hy, hw, hh, 6, '#F4E3C3', '#3B2F2A', 3.5);
    // 遮阳棚
    for (let i = 0; i < 7; i++) {
      ctx.fillStyle = i % 2 ? '#FFFDF5' : '#E8745B';
      ctx.fillRect(hx + 4 + i * 23, hy - 16, 23, 20);
    }
    ctx.strokeStyle = '#3B2F2A';
    ctx.lineWidth = 3;
    ctx.strokeRect(hx + 4, hy - 16, 161, 20);
    Draw.text(ctx, '快递驿站', hx + hw / 2, hy + 24, 18, '#5A3B2A');
    Draw.text(ctx, '沙河店 · 取件请扫码', hx + hw / 2, hy + 42, 8, '#8B6B52');
    // 门
    Draw.fillRR(ctx, hx + 56, hy + 56, 56, 40, 3, '#6E4A32', '#3B2F2A', 2.5);
    Draw.text(ctx, '取件', hx + 84, hy + 76, 10, '#FFE9A8');
    // 货架
    const px = 274, py = 118;
    Draw.fillRR(ctx, px, py, 74, 66, 4, '#B77A4E', '#3B2F2A', 3);
    for (let r = 0; r < 2; r++) {
      for (let c = 0; c < 2; c++) {
        this.parcel(ctx, px + 22 + c * 32, py + 20 + r * 30, 22, ['#D9A15E', '#C98A5B'][(r + c) % 2]);
      }
    }
    // 蜜雪冰城
    ctx.save();
    ctx.translate(268, 60);
    ctx.rotate(-0.12);
    Draw.fillRR(ctx, -22, -22, 44, 54, 8, '#FF6F91', '#3B2F2A', 3);
    ctx.fillStyle = '#FFFDF5';
    ctx.beginPath();
    ctx.arc(0, 12, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#3B2F2A';
    ctx.lineWidth = 2.5;
    ctx.stroke();
    // 小皇冠
    ctx.fillStyle = '#F5C451';
    ctx.beginPath();
    ctx.moveTo(-12, -26);
    ctx.lineTo(-6, -34);
    ctx.lineTo(0, -27);
    ctx.lineTo(6, -34);
    ctx.lineTo(12, -26);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // 雪人
    ctx.fillStyle = '#FFFDF5';
    ctx.beginPath();
    ctx.arc(-6, 11, 3.4, 0, Math.PI * 2);
    ctx.arc(6, 11, 3.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#3B2F2A';
    ctx.beginPath();
    ctx.arc(-6, 11, 1.4, 0, Math.PI * 2);
    ctx.arc(6, 11, 1.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#FF8A5B';
    ctx.beginPath();
    ctx.moveTo(0, 15); ctx.lineTo(3, 18); ctx.lineTo(-3, 18);
    ctx.closePath(); ctx.fill();
    // 吸管
    ctx.strokeStyle = '#3B2F2A';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(8, -22); ctx.lineTo(16, -40); ctx.stroke();
    ctx.restore();
    // 掉落的包裹
    this.parcel(ctx, 62, 44, 30, '#D9A15E', '急');
    this.parcel(ctx, 128, 28, 24, '#C98A5B');
    this.parcel(ctx, 190, 46, 22, '#E8B87E');
    ctx.strokeStyle = 'rgba(255,255,255,.5)';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    [[62, 26], [62, 8], [128, 12], [190, 30]].forEach(([x, y]) => {
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - 9); ctx.stroke();
    });
    // 快递车
    ctx.save();
    ctx.translate(50, 166);
    ctx.fillStyle = '#57A773';
    Draw.fillRR(ctx, -30, -20, 54, 22, 5, '#57A773', '#3B2F2A', 3);
    ctx.fillStyle = '#F5C451';
    ctx.beginPath();
    ctx.arc(-4, 4, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#3B2F2A';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.strokeStyle = '#3B2F2A';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(24, -18); ctx.lineTo(34, -30); ctx.stroke();
    ctx.fillStyle = '#3B2F2A';
    ctx.beginPath(); ctx.arc(34, -32, 5, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
};

const MapPage = {
  busy: false,
  init() {
    MapArt.init();
    $('#map-mascot').innerHTML = mascotHTML();
    this.refreshBest();
    this.bind();
    this.syncSound();
  },
  bind() {
    $$('.map-card').forEach(card => {
      card.addEventListener('click', () => this.enter(card));
    });
    $('#btn-back-home').addEventListener('click', () => {
      Sfx.play('click');
      UI.fade(() => {
        UI.go('screen-home');
        HomePage.busy = false;
      });
    });
    $('#btn-history-map').addEventListener('click', () => History.open());
    $('#btn-sound-map').addEventListener('click', () => {
      Sfx.toggle();
      this.syncSound();
      if (window.HomePage) HomePage.syncSound();
    });
  },
  syncSound() {
    const btn = $('#btn-sound-map');
    btn.classList.toggle('off', !Sfx.on);
    btn.textContent = Sfx.on ? '音效' : '静音';
  },
  refreshBest() {
    const groups = {
      dorm: ['dorm'],
      canteen: ['canteen'],
      activity: ['activity'],
      library: ['puzzle-spot', 'puzzle-link', 'puzzle-code', 'gomoku'],
      express: ['express']
    };
    $$('[data-best]').forEach(el => {
      const b = Store.groupBest(groups[el.dataset.best] || [el.dataset.best]);
      el.textContent = b ? `最高 ${b.score.toLocaleString('zh-CN')}` : '暂无战绩';
    });
  },
  onShow() {
    this.busy = false;
    const m = $('#map-mascot');
    if (!m) return;
    m.style.transition = 'none';
    m.style.transform = '';
    m.classList.remove('walking');
    $$('.map-card').forEach(c => c.classList.remove('target', 'flash'));
    requestAnimationFrame(() => { m.style.transition = ''; });
    this.refreshBest();
    this.syncSound();
  },
  enter(card) {
    if (this.busy) return;
    const id = card.dataset.game;
    if (!GameRegistry[id]) return;
    this.busy = true;
    Sfx.play('click');
    const m = $('#map-mascot');
    const rect = card.getBoundingClientRect();
    const inView = rect.top > 70 && rect.bottom < window.innerHeight - 10;
    if (!inView) {
      card.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
    const walk = () => {
      const cr = card.getBoundingClientRect();
      const mr = m.getBoundingClientRect();
      const tx = cr.left + cr.width / 2;
      const ty = cr.top + cr.height * 0.62;
      const dx = tx - (mr.left + mr.width / 2);
      const dy = ty - (mr.top + mr.height / 2);
      m.style.transform = `translate(calc(-50% + ${dx}px), ${dy}px) scale(.9)`;
      m.classList.add('walking');
      card.classList.add('target');
      for (let i = 0; i < 3; i++) setTimeout(() => Sfx.play('step'), 90 + i * 160);
      setTimeout(() => {
        m.classList.remove('walking');
        card.classList.add('flash');
        Sfx.play('pop');
        setTimeout(() => {
          Shell.open(id);
          setTimeout(() => { this.busy = false; }, 500);
        }, 260);
      }, 760);
    };
    if (inView) walk(); else setTimeout(walk, 420);
  }
};
