/* =========================================================
   种菜解压记 · 核心框架
   工具函数 / 音效 / 本地战绩 / 屏幕调度 / 游戏外壳 / 绘图
   ========================================================= */
'use strict';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a = 0, b = 1) => a + Math.random() * (b - a);
const randInt = (a, b) => Math.floor(rand(a, b + 1));
const choice = arr => arr[Math.floor(Math.random() * arr.length)];
const shuffle = arr => {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
const dist = (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1);
const nowSec = () => performance.now() / 1000;

/* ---------------- 本地存储：历史战绩 ---------------- */
const GAME_NAMES = {
  dorm: '保卫宿舍',
  canteen: '食堂贪吃蛇',
  activity: '跳地为牢',
  library: '诸葛嘻嘻',
  express: '包裹雨',
  'puzzle-spot': '找不同',
  'puzzle-link': '一笔连线',
  'puzzle-code': '密码推理',
  gomoku: '五子棋'
};

/* ---------------- 本地存储（浏览器禁用存储时自动降级到内存） ---------------- */
const SafeStore = (function () {
  let ls = null;
  try {
    const t = '__zcdj_probe__';
    localStorage.setItem(t, '1');
    localStorage.removeItem(t);
    ls = localStorage;
  } catch (e) { ls = null; }
  const mem = new Map();
  return {
    get(k) {
      try { if (ls) return ls.getItem(k); } catch (e) { /* 忽略 */ }
      return mem.has(k) ? mem.get(k) : null;
    },
    set(k, v) {
      try { if (ls) { ls.setItem(k, v); return; } } catch (e) { /* 忽略 */ }
      mem.set(k, String(v));
    },
    remove(k) {
      try { if (ls) ls.removeItem(k); } catch (e) { /* 忽略 */ }
      mem.delete(k);
    }
  };
})();

const Store = {
  KEY: 'zcdj.records.v2',
  data: { records: [] },
  load() {
    try {
      const raw = SafeStore.get(this.KEY);
      if (raw) {
        const d = JSON.parse(raw);
        if (d && Array.isArray(d.records)) this.data = d;
      }
    } catch (e) { this.data = { records: [] }; }
    return this.data;
  },
  save() {
    SafeStore.set(this.KEY, JSON.stringify(this.data));
  },
  add(rec) {
    this.load();
    const prev = this.best(rec.game);
    const entry = {
      game: rec.game,
      score: Math.max(0, Math.round(rec.score || 0)),
      detail: rec.detail || '',
      win: !!rec.win,
      ts: Date.now()
    };
    this.data.records.unshift(entry);
    if (this.data.records.length > 240) this.data.records.length = 240;
    this.save();
    return { entry, prev, isBest: !prev || entry.score > prev.score };
  },
  best(gameId) {
    this.load();
    let b = null;
    for (const r of this.data.records) {
      if (r.game !== gameId) continue;
      if (!b || r.score > b.score) b = r;
    }
    return b;
  },
  groupBest(ids) {
    this.load();
    let b = null;
    for (const r of this.data.records) {
      if (!ids.includes(r.game)) continue;
      if (!b || r.score > b.score) b = r;
    }
    return b;
  },
  recent(n = 12) {
    this.load();
    return this.data.records.slice(0, n);
  },
  count() { this.load(); return this.data.records.length; },
  clear() { this.data = { records: [] }; this.save(); }
};

/* ---------------- 音效（WebAudio 合成，无外部资源） ---------------- */
const Sfx = {
  on: SafeStore.get('zcdj.sound') !== 'off',
  ctx: null,
  master: null,
  noiseBuf: null,
  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      if (this.master) this.master.gain.value = this.on ? 0.9 : 0;
      return this.ctx;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.on ? 0.9 : 0;
    this.master.connect(this.ctx.destination);
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  },
  get t() { return this.ctx ? this.ctx.currentTime : 0; },
  tone(opt) {
    if (!this.ctx) return;
    const { freq = 440, freq2 = null, dur = 0.12, type = 'sine', vol = 0.12, delay = 0, attack = 0.006 } = opt;
    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (freq2) osc.frequency.exponentialRampToValueAtTime(Math.max(30, freq2), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.03);
  },
  ensureNoise() {
    if (!this.ctx || this.noiseBuf) return this.noiseBuf;
    const len = Math.floor(this.ctx.sampleRate * 1.2);
    this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return this.noiseBuf;
  },
  noise(opt = {}) {
    if (!this.ctx) return;
    const { dur = 0.3, vol = 0.18, delay = 0, lp = 1400 } = opt;
    if (!this.ensureNoise()) return;
    const t0 = this.ctx.currentTime + delay;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(lp, t0);
    filter.frequency.exponentialRampToValueAtTime(180, t0 + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filter).connect(g).connect(this.master);
    src.start(t0);
    src.stop(t0 + dur + 0.02);
  },
  play(name) {
    if (!this.on) return;
    if (!this.init()) return;
    switch (name) {
      case 'click': this.tone({ freq: 620, freq2: 880, dur: 0.07, type: 'triangle', vol: 0.08 }); break;
      case 'hover': this.tone({ freq: 520, dur: 0.04, type: 'sine', vol: 0.04 }); break;
      case 'shoot': this.tone({ freq: 900, freq2: 480, dur: 0.05, type: 'square', vol: 0.025 }); break;
      case 'hit': this.tone({ freq: 320, freq2: 140, dur: 0.09, type: 'sawtooth', vol: 0.05 }); break;
      case 'pop': this.tone({ freq: 420, freq2: 900, dur: 0.09, type: 'sine', vol: 0.1 }); break;
      case 'coin':
        this.tone({ freq: 880, dur: 0.07, type: 'triangle', vol: 0.09 });
        this.tone({ freq: 1320, dur: 0.1, type: 'triangle', vol: 0.08, delay: 0.07 });
        break;
      case 'up':
        this.tone({ freq: 523, dur: 0.08, type: 'triangle', vol: 0.1 });
        this.tone({ freq: 784, dur: 0.08, type: 'triangle', vol: 0.1, delay: 0.08 });
        this.tone({ freq: 1046, dur: 0.12, type: 'triangle', vol: 0.1, delay: 0.16 });
        break;
      case 'wrong': this.tone({ freq: 220, freq2: 110, dur: 0.22, type: 'square', vol: 0.07 }); break;
      case 'damage': this.noise({ dur: 0.25, vol: 0.22, lp: 900 }); this.tone({ freq: 160, freq2: 70, dur: 0.3, type: 'sawtooth', vol: 0.08 }); break;
      case 'explode': this.noise({ dur: 0.36, vol: 0.3, lp: 2200 }); break;
      case 'win':
        [523, 659, 784, 1046].forEach((f, i) => this.tone({ freq: f, dur: 0.24, type: 'triangle', vol: 0.11, delay: i * 0.11 }));
        break;
      case 'lose':
        [392, 330, 262, 196].forEach((f, i) => this.tone({ freq: f, dur: 0.28, type: 'sawtooth', vol: 0.07, delay: i * 0.13 }));
        break;
      case 'note': this.tone({ freq: 760, dur: 0.06, type: 'triangle', vol: 0.07 }); break;
      case 'perfect': this.tone({ freq: 1180, dur: 0.09, type: 'triangle', vol: 0.08 }); break;
      case 'step': this.tone({ freq: 300, dur: 0.05, type: 'sine', vol: 0.04 }); break;
    }
  },
  toggle() {
    this.on = !this.on;
    SafeStore.set('zcdj.sound', this.on ? 'on' : 'off');
    if (this.master) this.master.gain.value = this.on ? 0.9 : 0;
    if (this.on) this.play('click');
    return this.on;
  }
};

/* ---------------- 绘图小工具 ---------------- */
const Draw = {
  rr(ctx, x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  },
  fillRR(ctx, x, y, w, h, r, fill, stroke, lw = 2) {
    this.rr(ctx, x, y, w, h, r);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); }
  },
  text(ctx, str, x, y, size = 20, color = '#3B2F2A', align = 'center', weight = 'bold', stroke = null, sw = 4) {
    ctx.font = `${weight} ${size}px "YouYuan","PingFang SC","Microsoft YaHei",sans-serif`;
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    if (stroke) {
      ctx.lineWidth = sw;
      ctx.strokeStyle = stroke;
      ctx.lineJoin = 'round';
      ctx.strokeText(str, x, y);
    }
    ctx.fillStyle = color;
    ctx.fillText(str, x, y);
  },
  star(ctx, x, y, r, inner = r * 0.45, rot = -Math.PI / 2) {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const rr = i % 2 === 0 ? r : inner;
      const a = rot + (Math.PI / 5) * i;
      const px = x + Math.cos(a) * rr;
      const py = y + Math.sin(a) * rr;
      i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    }
    ctx.closePath();
  },
  heart(ctx, x, y, s) {
    ctx.beginPath();
    ctx.moveTo(x, y + s * 0.65);
    ctx.bezierCurveTo(x - s * 1.25, y - s * 0.2, x - s * 0.55, y - s * 1.05, x, y - s * 0.35);
    ctx.bezierCurveTo(x + s * 0.55, y - s * 1.05, x + s * 1.25, y - s * 0.2, x, y + s * 0.65);
    ctx.closePath();
  },
  cloud(ctx, x, y, s, color = '#fff', alpha = 1) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, s * 0.46, 0, Math.PI * 2);
    ctx.arc(x + s * 0.5, y + s * 0.08, s * 0.36, 0, Math.PI * 2);
    ctx.arc(x - s * 0.5, y + s * 0.1, s * 0.32, 0, Math.PI * 2);
    ctx.arc(x + s * 0.1, y + s * 0.28, s * 0.42, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  },
  star4(ctx, x, y, s, color, alpha = 1) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x, y - s);
    ctx.quadraticCurveTo(x + s * 0.18, y - s * 0.18, x + s, y);
    ctx.quadraticCurveTo(x + s * 0.18, y + s * 0.18, x, y + s);
    ctx.quadraticCurveTo(x - s * 0.18, y + s * 0.18, x - s, y);
    ctx.quadraticCurveTo(x - s * 0.18, y - s * 0.18, x, y - s);
    ctx.fill();
    ctx.restore();
  },
  shadowText(ctx, str, x, y, size, fill, stroke, align = 'center') {
    this.text(ctx, str, x, y + 3, size, 'rgba(0,0,0,.22)', align);
    this.text(ctx, str, x, y, size, fill, align, 'bold', stroke);
  }
};

/* ---------------- 屏幕调度 ---------------- */
const UI = {
  current: 'screen-home',
  go(id, cb) {
    if (this.current === id) { if (cb) cb(); return; }
    $$('.screen').forEach(s => s.classList.toggle('active', s.id === id));
    this.current = id;
    if (cb) setTimeout(cb, 460);
  },
  fade(cb) {
    const f = $('#fade');
    f.classList.add('on');
    setTimeout(() => {
      try { cb(); } catch (e) { console.error(e); }
      setTimeout(() => f.classList.remove('on'), 60);
    }, 330);
  }
};

/* ---------------- 游戏元信息 ---------------- */
const GameMeta = {
  dorm: {
    title: '保卫宿舍',
    sub: '← → / A D 移动 · 自动开火 · 接住「不调休」升级火力',
    overTitle: '宿舍沦陷了……',
    tip: '提示：左右移动躲开漏网之鱼，接住「不调休」可以升级弹道，「放假」能开护盾；漏掉一个就会损失一颗心。'
  },
  canteen: {
    title: '食堂贪吃蛇',
    sub: '方向键 / WASD 转向 · 吃遍子衿食堂 · 别撞墙也别咬自己',
    overTitle: '吃撑了……',
    tip: '提示：越吃越快，后期会出现餐桌障碍；吃鸡腿额外加分，西瓜是限时彩蛋。'
  },
  activity: {
    title: '跳地为牢',
    sub: 'D F J K 击打四条轨道 · 跟着节拍把压力跳成连击',
    overTitle: '舞步踩乱了……',
    tip: '提示：Perfect 判定 90ms 内。眼睛盯住判定线，不要盯一整屏，连击会额外加分。'
  },
  library: {
    title: '诸葛嘻嘻',
    sub: '骋望楼益智四连：找不同 / 一笔连线 / 密码推理 / 五子棋',
    overTitle: '今天的脑子需要充值……',
    tip: '提示：四个小游戏都可以单独开一局，战绩会分别记录；五子棋支持人机、双人同屏与浏览器联机。'
  },
  express: {
    title: '包裹雨',
    sub: '← → / A D 或鼠标移动快递筐 · 接快递与奶茶 · 躲易碎品',
    overTitle: '驿站今天爆仓了……',
    tip: '提示：连续接住包裹会累积连击倍率，易碎品和错件会让连击清零并扣一颗心。'
  }
};

const GameRegistry = {};

/* ---------------- 游戏外壳 ---------------- */
const Shell = {
  current: null,
  activeId: null,
  ended: false,
  _restarting: false,
  open(id) {
    const meta = GameMeta[id];
    if (!meta || !GameRegistry[id]) { console.warn('未注册的游戏', id); return; }
    Shell._restarting = false;
    Sfx.init();
    Shell.destroyCurrent();
    UI.fade(() => {
      UI.current = 'screen-game';
      $$('.screen').forEach(s => s.classList.toggle('active', s.id === 'screen-game'));
      $('#game-title').textContent = meta.title;
      $('#game-sub').textContent = meta.sub;
      $('#pause-tip').innerHTML = meta.tip || '';
      $('#pause-overlay').classList.remove('show');
      $('#result-overlay').classList.remove('show');
      Shell.activeId = id;
      Shell.ended = false;
      Shell.build();
    });
  },
  build() {
    const stage = $('#stage');
    stage.innerHTML = '';
    const id = Shell.activeId;
    const meta = GameMeta[id];
    const api = {
      finish(result) { Shell.finish(result); },
      setSub(text) { $('#game-sub').textContent = text; },
      setTitle(text) { $('#game-title').textContent = text; },
      exit() { Shell.close(); },
      restarting: Shell._restarting,
      meta
    };
    Shell.ended = false;
    Shell.current = { id, inst: GameRegistry[id](stage, api) || {} };
  },
  finish(result) {
    if (!Shell.current || Shell.ended) return;
    Shell.ended = true;
    const id = Shell.current.id;
    const meta = GameMeta[id];
    const recordId = result.recordId || id;
    const score = Math.max(0, Math.round(result.score || 0));
    const added = Store.add({
      game: recordId,
      score,
      detail: result.detail || GAME_NAMES[recordId] || '',
      win: !!result.win
    });
    Shell.refreshMapBest();
    $('#result-title').textContent = result.title || (result.win ? '漂亮！' : meta.overTitle);
    $('#result-sub').textContent = result.subtitle || '';
    $('#result-score').textContent = score.toLocaleString('zh-CN');
    $('#new-record-slot').innerHTML = added.isBest && score > 0 ? '<span class="new-record">新纪录</span>' : '';
    const stats = (result.stats || []).map(([k, v]) => `<div>${k}<b>${v}</b></div>`).join('');
    $('#result-stats').innerHTML = stats;
    $('#result-tip').innerHTML = result.tip || meta.tip || '';
    $('#result-overlay').classList.add('show');
    if (result.win) Sfx.play('win'); else Sfx.play('lose');
  },
  pause() {
    if (!Shell.current || Shell.ended) return;
    if ($('#pause-overlay').classList.contains('show')) return;
    try { Shell.current.inst.pause && Shell.current.inst.pause(); } catch (e) { console.warn(e); }
    $('#pause-overlay').classList.add('show');
    Sfx.play('click');
  },
  resume() {
    if (!Shell.current) return;
    $('#pause-overlay').classList.remove('show');
    try { Shell.current.inst.resume && Shell.current.inst.resume(); } catch (e) { console.warn(e); }
    Sfx.play('click');
  },
  restart() {
    if (!Shell.activeId) return;
    $('#pause-overlay').classList.remove('show');
    $('#result-overlay').classList.remove('show');
    Sfx.init();
    Sfx.play('click');
    Shell.destroyCurrent();
    Shell._restarting = true;
    Shell.build();
    Shell._restarting = false;
  },
  close() {
    Shell.destroyCurrent();
    Shell.activeId = null;
    $('#pause-overlay').classList.remove('show');
    $('#result-overlay').classList.remove('show');
    UI.current = 'screen-map';
    $$('.screen').forEach(s => s.classList.toggle('active', s.id === 'screen-map'));
    if (window.MapPage && MapPage.onShow) MapPage.onShow();
    Sfx.play('click');
  },
  destroyCurrent() {
    if (!Shell.current) return;
    try { Shell.current.inst.destroy && Shell.current.inst.destroy(); } catch (e) { console.warn(e); }
    Shell.current = null;
    const stage = $('#stage');
    if (stage) stage.innerHTML = '';
  },
  refreshMapBest() {
    if (window.MapPage && MapPage.refreshBest) MapPage.refreshBest();
  }
};

/* ---------------- 历史战绩弹窗 ---------------- */
const History = {
  init() {
    $('#btn-close-history').addEventListener('click', () => this.close());
    $('#history-modal').addEventListener('click', e => {
      if (e.target.id === 'history-modal') this.close();
    });
    $('#btn-clear-history').addEventListener('click', () => {
      if (Store.count() === 0) return;
      if (confirm('确定清空本机保存的全部历史战绩吗？此操作不可恢复。')) {
        Store.clear();
        this.render();
        Shell.refreshMapBest();
        Sfx.play('click');
      }
    });
  },
  open() {
    this.render();
    $('#history-modal').classList.add('show');
    Sfx.play('click');
  },
  close() { $('#history-modal').classList.remove('show'); },
  render() {
    const groups = [
      { ids: ['dorm'], label: '保卫宿舍', icon: '舍' },
      { ids: ['canteen'], label: '食堂贪吃蛇', icon: '食' },
      { ids: ['activity'], label: '跳地为牢', icon: '舞' },
      { ids: ['puzzle-spot', 'puzzle-link', 'puzzle-code', 'gomoku'], label: '诸葛嘻嘻', icon: '智' },
      { ids: ['express'], label: '包裹雨', icon: '递' }
    ];
    $('#best-grid').innerHTML = groups.map(g => {
      const b = Store.groupBest(g.ids);
      return `<div class="best-item">
        <div class="bi-icon">${g.icon}</div>
        <div>
          <div class="bi-name">${g.label}</div>
          <div class="bi-score">${b ? b.score.toLocaleString('zh-CN') : '—'}</div>
        </div>
      </div>`;
    }).join('');

    const rows = Store.recent(16);
    $('#history-count').textContent = Store.count();
    if (!rows.length) {
      $('#history-list').innerHTML = '<div class="empty-tip">还没有战绩，去校园里逛逛吧</div>';
      return;
    }
    const pad = n => String(n).padStart(2, '0');
    $('#history-list').innerHTML = rows.map(r => {
      const d = new Date(r.ts);
      const time = `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
      return `<div class="history-row">
        <span class="h-name">${GAME_NAMES[r.game] || r.game}</span>
        <span class="h-detail">${r.detail || ''}</span>
        <span class="h-score">${r.score.toLocaleString('zh-CN')}</span>
        <span class="h-time">${time}</span>
      </div>`;
    }).join('');
  }
};

/* ---------------- 吉祥物 ---------------- */
function mascotHTML() {
  // 直接内联 SVG，便于用 CSS 对双腿做走路动画
  return `<svg viewBox="0 0 120 150" aria-hidden="true">
    <ellipse cx="60" cy="143" rx="29" ry="7" fill="rgba(59,47,42,.16)"/>
    <g class="leg-l" style="transform-origin:50px 106px">
      <rect x="45" y="102" width="11" height="30" rx="5.5" fill="#4A3B32" stroke="#3B2F2A" stroke-width="3"/>
      <ellipse cx="49" cy="133" rx="11" ry="6" fill="#E8745B" stroke="#3B2F2A" stroke-width="3"/>
    </g>
    <g class="leg-r" style="transform-origin:70px 106px">
      <rect x="64" y="102" width="11" height="30" rx="5.5" fill="#4A3B32" stroke="#3B2F2A" stroke-width="3"/>
      <ellipse cx="71" cy="133" rx="11" ry="6" fill="#E8745B" stroke="#3B2F2A" stroke-width="3"/>
    </g>
    <path d="M34 72 q-16 12 -13 26 q2 8 9 7 q6 -1 6 -9 l2 -14z" fill="#FFE0C2" stroke="#3B2F2A" stroke-width="3.2" stroke-linejoin="round"/>
    <path d="M86 72 q16 12 13 26 q-2 8 -9 7 q-6 -1 -6 -9 l-2 -14z" fill="#FFE0C2" stroke="#3B2F2A" stroke-width="3.2" stroke-linejoin="round"/>
    <path d="M34 66 q26 -12 52 0 l4 40 q-30 10 -60 0z" fill="#57A773" stroke="#3B2F2A" stroke-width="3.4" stroke-linejoin="round"/>
    <path d="M52 74 q8 10 16 0" fill="none" stroke="#3E8257" stroke-width="3" stroke-linecap="round"/>
    <circle cx="60" cy="88" r="3" fill="#2E6B45"/>
    <circle cx="60" cy="45" r="31" fill="#FFEBD2" stroke="#3B2F2A" stroke-width="3.4"/>
    <ellipse cx="49" cy="47" rx="3.7" ry="4.4" fill="#3B2F2A"/>
    <ellipse cx="71" cy="47" rx="3.7" ry="4.4" fill="#3B2F2A"/>
    <circle cx="50.4" cy="45.6" r="1.2" fill="#fff"/>
    <circle cx="72.4" cy="45.6" r="1.2" fill="#fff"/>
    <ellipse cx="40" cy="57" rx="6" ry="3.6" fill="#F7A9A0" opacity=".75"/>
    <ellipse cx="80" cy="57" rx="6" ry="3.6" fill="#F7A9A0" opacity=".75"/>
    <path d="M55 57 q5 5 10 0" fill="none" stroke="#3B2F2A" stroke-width="2.8" stroke-linecap="round"/>
    <path d="M60 15 q0 -8 1 -12" fill="none" stroke="#3E8257" stroke-width="3.4" stroke-linecap="round"/>
    <path d="M61 10 q10 -10 17 -4 q-6 10 -17 6z" fill="#7BC96F" stroke="#2E6B45" stroke-width="2.6" stroke-linejoin="round"/>
    <path d="M59 10 q-10 -9 -17 -3 q6 10 17 5z" fill="#8FD983" stroke="#2E6B45" stroke-width="2.6" stroke-linejoin="round"/>
  </svg>`;
}

/* ---------------- 画布坐标换算 ---------------- */
function canvasPos(canvas, ev) {
  const r = canvas.getBoundingClientRect();
  const cx = (ev.touches && ev.touches[0]) ? ev.touches[0].clientX : ev.clientX;
  const cy = (ev.touches && ev.touches[0]) ? ev.touches[0].clientY : ev.clientY;
  return {
    x: (cx - r.left) / r.width * canvas.width,
    y: (cy - r.top) / r.height * canvas.height
  };
}

function makeCanvas(stage, w = 960, h = 600) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  c.style.width = '100%';
  c.style.height = '100%';
  stage.appendChild(c);
  return c;
}

function fmtScore(n) {
  return Math.round(n).toLocaleString('zh-CN');
}
