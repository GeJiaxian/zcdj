/* =========================================================
   五子棋 · 骋望楼棋室
   人机对战 / 双人同屏 / WebRTC 点对点联机
   ========================================================= */
'use strict';

GameRegistry.gomoku = function (stage, api) {
  const W = 960, H = 600;
  const N = 15, CELL = 34, BX = 48, BY = 56;
  const BOARD_W = (N - 1) * CELL;
  const PANEL_X = 640;

  let canvas = null, ctx = null;
  let board = [], moves = [], turn = 1, mode = 'pve', gameOver = false, winner = 0, winLine = null;
  let aiThinking = false, hover = null, paused = false, destroyed = false;
  let raf = 0, last = 0;
  let bubble = '', bubbleTimer = 0;
  let myColor = 1;
  let aiTimer = 0, finishTimer = 0;

  let pc = null, dc = null, onlineRole = null, connected = false;
  let menuEl = null, onlineEl = null;

  const hitBtns = [];

  /* ================= 菜单 ================= */
  function showMenu() {
    cleanupOnline();
    removeCanvas();
    if (onlineEl) { onlineEl.remove(); onlineEl = null; }
    if (menuEl) menuEl.remove();
    api.setSub('五子棋：人机 / 双人同屏 / 浏览器联机对战 · 15 路棋盘');
    menuEl = document.createElement('div');
    menuEl.className = 'gm-menu';
    menuEl.innerHTML = `
      <div class="gm-head">
        <h2>五 子 棋</h2>
        <p>骋望楼 · 棋室 · 15 路棋盘</p>
      </div>
      <div class="gm-modes">
        <button class="gm-mode" data-mode="pve">
          <span class="gm-icon" style="background:#57A773">人</span>
          <b>人机对战</b>
          <small>执黑先行，挑战棋室 AI，可悔棋</small>
        </button>
        <button class="gm-mode" data-mode="pvp">
          <span class="gm-icon" style="background:#6E8FB8">双</span>
          <b>双人同屏</b>
          <small>一台电脑，和朋友轮流落子</small>
        </button>
        <button class="gm-mode" data-mode="online">
          <span class="gm-icon" style="background:#E8745B">联</span>
          <b>联机对战</b>
          <small>复制邀请码，和同学实时对弈</small>
        </button>
      </div>
      <p class="gm-note">联机使用 WebRTC 点对点连接（同一 Wi-Fi 下最稳定）。连接后房主执黑先行，可发快捷短语互动。</p>`;
    stage.appendChild(menuEl);
    menuEl.querySelectorAll('.gm-mode').forEach(btn => {
      btn.addEventListener('click', () => {
        Sfx.play('click');
        const m = btn.dataset.mode;
        menuEl.remove();
        menuEl = null;
        start(m);
      });
    });
  }

  function removeCanvas() {
    if (canvas) { canvas.remove(); canvas = null; ctx = null; }
    hitBtns.length = 0;
  }

  /* ================= 开局 ================= */
  function start(m) {
    mode = m;
    myColor = 1;
    onlineRole = null;
    connected = false;
    resetBoard();
    buildCanvas();
    if (m === 'online') showOnlinePanel();
    else api.setSub(m === 'pve' ? '你执黑先行 · 点击交叉点落子 · 可悔棋' : '双人同屏：黑先白后，轮流落子');
  }

  function resetBoard() {
    clearTimeout(finishTimer);
    finishGame.done = false;
    board = Array.from({ length: N }, () => Array(N).fill(0));
    moves = [];
    turn = 1;
    gameOver = false;
    winner = 0;
    winLine = null;
    aiThinking = false;
    hover = null;
    bubble = '';
    bubbleTimer = 0;
    if (mode === 'online' && onlineRole === 'guest') {
      // 客方执白，等待房主开局
    }
  }

  function buildCanvas() {
    removeCanvas();
    canvas = makeCanvas(stage, W, H);
    ctx = canvas.getContext('2d');
    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerleave', () => { hover = null; });
    last = 0;
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(loop);
  }

  /* ================= 落子 ================= */
  function inB(r, c) { return r >= 0 && r < N && c >= 0 && c < N; }

  function canHumanPlay() {
    if (gameOver || paused || aiThinking) return false;
    if (mode === 'online') return connected && turn === myColor;
    return true;
  }

  function place(r, c, color, send = true) {
    if (!inB(r, c) || board[r][c] !== 0 || gameOver) return false;
    board[r][c] = color;
    moves.push({ r, c, color, n: moves.length });
    const line = checkWin(r, c, color);
    if (line) {
      winner = color;
      winLine = line;
      gameOver = true;
      Sfx.play('win');
      scheduleFinish(1100);
      return true;
    }
    if (moves.length >= N * N) {
      gameOver = true;
      winner = 0;
      Sfx.play('pop');
      scheduleFinish(900);
      return true;
    }
    turn = color === 1 ? 2 : 1;
    Sfx.play(color === 1 ? 'click' : 'pop');
    if (mode === 'online' && send && dc && dc.readyState === 'open') {
      dc.send(JSON.stringify({ t: 'move', r, c }));
    }
    if (mode === 'pve' && turn === 2 && !gameOver) {
      aiThinking = true;
      clearTimeout(aiTimer);
      aiTimer = setTimeout(aiTurn, 380);
    }
    return true;
  }

  function scheduleFinish(delay) {
    clearTimeout(finishTimer);
    finishTimer = setTimeout(() => {
      if (destroyed) return;
      finishGame();
    }, delay);
  }

  function finishGame() {
    if (finishGame.done) return;
    finishGame.done = true;
    const myWin = winner !== 0 && (mode === 'online' ? winner === myColor : true);
    let title, score, detail;
    if (winner === 0) {
      title = '和棋';
      score = 200;
      detail = `${label(mode)} · 和棋 · ${moves.length} 手`;
    } else {
      const winnerName = winner === 1 ? '黑棋' : '白棋';
      if (mode === 'online') {
        const iWin = winner === myColor;
        title = iWin ? '联机获胜！' : '惜败一局';
        score = iWin ? 900 + Math.max(0, 225 - moves.length) * 2 : 0;
        detail = `联机 · ${iWin ? '胜' : '负'} · ${moves.length} 手`;
      } else if (mode === 'pve') {
        const iWin = winner === 1;
        title = iWin ? '棋高一着！' : 'AI 赢了这一局';
        score = iWin ? 800 + Math.max(0, 225 - moves.length) * 3 : 0;
        detail = `人机 · ${iWin ? `胜 · ${moves.length}手` : `负 · ${moves.length}手`}`;
      } else {
        title = winnerName + '获胜';
        score = 600;
        detail = `双人 · ${winner === 1 ? '黑' : '白'}胜 · ${moves.length} 手`;
      }
    }
    api.finish({
      score,
      win: Boolean(winner !== 0 && (mode !== 'pve' ? true : winner === 1) && (mode !== 'online' ? true : winner === myColor)),
      title,
      subtitle: winner === 0 ? '棋盘满了，握手言和' : `${winner === 1 ? '黑棋' : '白棋'}连成五子`,
      stats: [
        ['总手数', moves.length],
        ['模式', label(mode)],
        ['结果', winner === 0 ? '和棋' : winner === 1 ? '黑胜' : '白胜']
      ],
      detail,
      tip: '提示：进攻时优先做“活三”“冲四”，防守时先堵对手的四；联机模式下可以发快捷短语互动。'
    });
  }

  function label(m) {
    return m === 'pve' ? '人机' : m === 'pvp' ? '双人' : '联机';
  }

  function checkWin(r, c, color) {
    const dirs = [[1, 0], [0, 1], [1, 1], [1, -1]];
    for (const [dr, dc] of dirs) {
      const line = [{ r, c }];
      for (let s = 1; s < 5; s++) {
        const nr = r + dr * s, nc = c + dc * s;
        if (inB(nr, nc) && board[nr][nc] === color) line.push({ r: nr, c: nc });
        else break;
      }
      for (let s = 1; s < 5; s++) {
        const nr = r - dr * s, nc = c - dc * s;
        if (inB(nr, nc) && board[nr][nc] === color) line.unshift({ r: nr, c: nc });
        else break;
      }
      if (line.length >= 5) return line;
    }
    return null;
  }

  /* ================= AI ================= */
  function aiTurn() {
    if (destroyed || gameOver || mode !== 'pve') { aiThinking = false; return; }
    if (paused) { aiTimer = setTimeout(aiTurn, 500); return; }
    const mv = chooseAI();
    if (!mv) { aiThinking = false; return; }
    aiThinking = false;
    place(mv.r, mv.c, 2, false);
  }

  function evalPoint(r, c, p) {
    let total = 0;
    const dirs = [[1, 0], [0, 1], [1, 1], [1, -1]];
    for (const [dr, dc] of dirs) {
      let count = 1, open = 0;
      let i = 1;
      while (inB(r + dr * i, c + dc * i) && board[r + dr * i][c + dc * i] === p) { count++; i++; }
      if (inB(r + dr * i, c + dc * i) && board[r + dr * i][c + dc * i] === 0) open++;
      i = 1;
      while (inB(r - dr * i, c - dc * i) && board[r - dr * i][c - dc * i] === p) { count++; i++; }
      if (inB(r - dr * i, c - dc * i) && board[r - dr * i][c - dc * i] === 0) open++;
      total += patternScore(count, open);
    }
    return total;
  }

  function patternScore(n, open) {
    if (n >= 5) return 1000000;
    if (n === 4) return open >= 2 ? 100000 : open === 1 ? 12000 : 0;
    if (n === 3) return open >= 2 ? 8000 : open === 1 ? 900 : 0;
    if (n === 2) return open >= 2 ? 500 : open === 1 ? 90 : 0;
    if (n === 1) return open >= 2 ? 30 : open === 1 ? 10 : 0;
    return 0;
  }

  function candidates() {
    const list = [];
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        if (board[r][c] !== 0) continue;
        let near = false;
        for (let dr = -2; dr <= 2 && !near; dr++) {
          for (let dc = -2; dc <= 2; dc++) {
            if (inB(r + dr, c + dc) && board[r + dr][c + dc] !== 0) { near = true; break; }
          }
        }
        if (near) list.push({ r, c });
      }
    }
    return list;
  }

  function chooseAI() {
    if (moves.length === 0) return { r: 7, c: 7 };
    const cand = candidates();
    if (!cand.length) {
      for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (board[r][c] === 0) return { r, c };
      return null;
    }
    // 直接赢
    for (const m of cand) {
      board[m.r][m.c] = 2;
      const win = checkWin(m.r, m.c, 2);
      board[m.r][m.c] = 0;
      if (win) return m;
    }
    // 堵对手
    for (const m of cand) {
      board[m.r][m.c] = 1;
      const win = checkWin(m.r, m.c, 1);
      board[m.r][m.c] = 0;
      if (win) return m;
    }
    let best = null, bestScore = -1;
    for (const m of cand) {
      const attack = evalPoint(m.r, m.c, 2);
      const defend = evalPoint(m.r, m.c, 1);
      const center = 30 - (Math.abs(m.r - 7) + Math.abs(m.c - 7)) * 2;
      const s = attack * 1.1 + defend + center + rand(0, 12);
      if (s > bestScore) { bestScore = s; best = m; }
    }
    return best;
  }

  /* ================= 输入 ================= */
  function boardPos(px, py) {
    const c = Math.round((px - BX) / CELL);
    const r = Math.round((py - BY) / CELL);
    return { r, c };
  }

  function onPointerMove(e) {
    if (!ctx) return;
    const p = canvasPos(canvas, e);
    const { r, c } = boardPos(p.x, p.y);
    hover = (inB(r, c) && board[r][c] === 0) ? { r, c } : null;
  }

  function onPointerDown(e) {
    if (!ctx) return;
    const p = canvasPos(canvas, e);
    // 侧栏按钮
    for (const b of hitBtns) {
      if (p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h) {
        b.fn();
        return;
      }
    }
    if (p.x > BOARD_W + BX + 24) return;
    if (!canHumanPlay()) return;
    const { r, c } = boardPos(p.x, p.y);
    if (!inB(r, c)) return;
    if (Math.abs(p.x - (BX + c * CELL)) > CELL * 0.48) return;
    if (Math.abs(p.y - (BY + r * CELL)) > CELL * 0.48) return;
    const color = mode === 'online' ? myColor : turn;
    if (mode === 'online' && turn !== myColor) return;
    if (board[r][c] !== 0) return;
    place(r, c, color, true);
  }

  /* ================= 联机 ================= */
  function showOnlinePanel() {
    if (onlineEl) onlineEl.remove();
    onlineEl = document.createElement('div');
    onlineEl.className = 'online-panel';
    onlineEl.innerHTML = `
      <div class="online-box">
        <h3>联机对战</h3>
        <p class="online-status" id="online-status">房主先「生成邀请码」，把邀请码发给同学；对方生成应答码后发回来即可连接。</p>
        <div class="online-tabs">
          <button data-tab="host" class="active">创建房间（执黑）</button>
          <button data-tab="join">加入房间（执白）</button>
        </div>
        <div class="online-tab" data-pane="host">
          <button class="btn btn-sm btn-green" id="btn-make-offer">1. 生成邀请码</button>
          <textarea id="offer-out" readonly placeholder="邀请码会显示在这里，点击全选复制"></textarea>
          <textarea id="answer-in" placeholder="把对方发回的应答码粘贴到这里"></textarea>
          <button class="btn btn-sm" id="btn-accept">2. 完成连接</button>
        </div>
        <div class="online-tab" data-pane="join" hidden>
          <textarea id="offer-in" placeholder="粘贴房主发来的邀请码"></textarea>
          <button class="btn btn-sm btn-green" id="btn-make-answer">生成应答码</button>
          <textarea id="answer-out" readonly placeholder="把应答码复制回给房主"></textarea>
        </div>
        <div class="online-foot">
          <span id="online-hint">连接建立后自动开始，房主执黑先行</span>
          <button class="btn btn-sm" id="btn-online-cancel">取消</button>
        </div>
      </div>`;
    stage.appendChild(onlineEl);

    const status = onlineEl.querySelector('#online-status');
    const setStatus = t => { status.textContent = t; };
    onlineEl.querySelectorAll('.online-tabs button').forEach(tab => {
      tab.addEventListener('click', () => {
        onlineEl.querySelectorAll('.online-tabs button').forEach(b => b.classList.toggle('active', b === tab));
        onlineEl.querySelectorAll('.online-tab').forEach(pane => {
          pane.hidden = pane.dataset.pane !== tab.dataset.tab;
        });
      });
    });
    ['offer-out', 'answer-out'].forEach(id => {
      onlineEl.querySelector('#' + id).addEventListener('click', e => e.target.select());
    });
    onlineEl.querySelector('#btn-online-cancel').addEventListener('click', () => {
      cleanupOnline();
      if (onlineEl) { onlineEl.remove(); onlineEl = null; }
      showMenu();
    });

    onlineEl.querySelector('#btn-make-offer').addEventListener('click', async () => {
      try {
        setStatus('正在生成邀请码…');
        await createHost();
        onlineEl.querySelector('#offer-out').value = encodeDesc(pc.localDescription);
        setStatus('把邀请码发给对方；对方发回应答码后，粘贴到下面的框里点「完成连接」。');
      } catch (err) {
        setStatus('生成失败：' + (err && err.message ? err.message : err));
      }
    });
    onlineEl.querySelector('#btn-accept').addEventListener('click', async () => {
      try {
        const code = onlineEl.querySelector('#answer-in').value.trim();
        if (!code) { setStatus('请先粘贴应答码'); return; }
        setStatus('正在完成连接…');
        await pc.setRemoteDescription(decodeDesc(code));
        setStatus('已收到应答，等待通道建立…');
      } catch (err) {
        setStatus('连接失败：' + (err && err.message ? err.message : err));
      }
    });
    onlineEl.querySelector('#btn-make-answer').addEventListener('click', async () => {
      try {
        const code = onlineEl.querySelector('#offer-in').value.trim();
        if (!code) { setStatus('请先粘贴房主的邀请码'); return; }
        setStatus('正在生成应答码…');
        await createGuest(code);
        onlineEl.querySelector('#answer-out').value = encodeDesc(pc.localDescription);
        setStatus('把上面的应答码复制回给房主，等待房主完成连接。');
      } catch (err) {
        setStatus('生成失败：' + (err && err.message ? err.message : err));
      }
    });
  }

  function rtcConfig() {
    return {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun.miwifi.com:3478' }
      ]
    };
  }

  function waitIce(peer) {
    return new Promise(resolve => {
      if (peer.iceGatheringState === 'complete') { resolve(); return; }
      const done = () => {
        if (peer.iceGatheringState === 'complete') {
          peer.removeEventListener('icegatheringstatechange', done);
          resolve();
        }
      };
      peer.addEventListener('icegatheringstatechange', done);
      setTimeout(resolve, 6000);
    });
  }

  async function createHost() {
    cleanupPeerOnly();
    onlineRole = 'host';
    myColor = 1;
    pc = new RTCPeerConnection(rtcConfig());
    dc = pc.createDataChannel('gomoku');
    bindChannel();
    pc.onconnectionstatechange = () => {
      if (pc && (pc.connectionState === 'failed' || pc.connectionState === 'disconnected')) {
        connected = false;
        setOnlineStatus('连接已断开');
      }
    };
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await waitIce(pc);
  }

  async function createGuest(code) {
    cleanupPeerOnly();
    onlineRole = 'guest';
    myColor = 2;
    pc = new RTCPeerConnection(rtcConfig());
    pc.ondatachannel = e => { dc = e.channel; bindChannel(); };
    pc.onconnectionstatechange = () => {
      if (pc && (pc.connectionState === 'failed' || pc.connectionState === 'disconnected')) {
        connected = false;
        setOnlineStatus('连接已断开');
      }
    };
    await pc.setRemoteDescription(decodeDesc(code));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    await waitIce(pc);
  }

  function bindChannel() {
    dc.onopen = () => {
      connected = true;
      if (onlineEl) { onlineEl.remove(); onlineEl = null; }
      resetBoard();
      finishGame.done = false;
      api.setSub('联机对战 · 你执' + (myColor === 1 ? '黑先行' : '白') + ' · 点击棋盘落子');
      showBubble('连接成功，开始对弈');
      Sfx.play('up');
    };
    dc.onmessage = ev => {
      let msg = null;
      try { msg = JSON.parse(ev.data); } catch (e) { return; }
      if (!msg) return;
      if (msg.t === 'move') {
        const opp = myColor === 1 ? 2 : 1;
        if (turn === opp && !gameOver) place(msg.r, msg.c, opp, false);
      } else if (msg.t === 'chat') {
        showBubble('对手：' + msg.msg);
        Sfx.play('note');
      } else if (msg.t === 'restart') {
        resetBoard();
        finishGame.done = false;
        showBubble('对手发起了重开');
      } else if (msg.t === 'resign') {
        showBubble('对手认输了');
        if (!gameOver) {
          winner = myColor;
          gameOver = true;
          Sfx.play('win');
          scheduleFinish(700);
        }
      }
    };
    dc.onclose = () => { connected = false; };
  }

  function setOnlineStatus(t) {
    if (!onlineEl) return;
    const el = onlineEl.querySelector('#online-status');
    if (el) el.textContent = t;
  }

  function cleanupPeerOnly() {
    if (dc) { try { dc.close(); } catch (e) { } }
    if (pc) { try { pc.close(); } catch (e) { } }
    dc = null; pc = null; connected = false;
  }

  function cleanupOnline() {
    cleanupPeerOnly();
    onlineRole = null;
  }

  function encodeDesc(desc) {
    return btoa(JSON.stringify({ type: desc.type, sdp: desc.sdp }));
  }
  function decodeDesc(code) {
    const o = JSON.parse(atob(code.replace(/\s+/g, '')));
    return { type: o.type, sdp: o.sdp };
  }

  function showBubble(text) {
    bubble = text;
    bubbleTimer = 2.6;
  }

  /* ================= 绘制 ================= */
  function drawBoard() {
    // 背景
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#2A2118');
    g.addColorStop(1, '#17110C');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    const glow = ctx.createRadialGradient(300, 280, 40, 300, 280, 520);
    glow.addColorStop(0, 'rgba(255, 210, 140, .14)');
    glow.addColorStop(1, 'rgba(255, 210, 140, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);

    // 棋盘
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,.55)';
    ctx.shadowBlur = 26;
    ctx.shadowOffsetY = 10;
    Draw.fillRR(ctx, BX - 30, BY - 30, BOARD_W + 60, BOARD_W + 60, 16, '#DDBB85', '#3B2F2A', 4);
    ctx.restore();
    const wood = ctx.createLinearGradient(BX, BY, BX + BOARD_W, BY + BOARD_W);
    wood.addColorStop(0, '#EBCB95');
    wood.addColorStop(0.5, '#E2BE84');
    wood.addColorStop(1, '#D6B078');
    Draw.fillRR(ctx, BX - 14, BY - 14, BOARD_W + 28, BOARD_W + 28, 10, wood, null);
    // 木纹
    ctx.save();
    ctx.globalAlpha = 0.1;
    ctx.strokeStyle = '#8B5E3C';
    ctx.lineWidth = 1;
    for (let i = 0; i < 14; i++) {
      ctx.beginPath();
      ctx.moveTo(BX - 10, BY + i * 40 + 8);
      ctx.bezierCurveTo(BX + 150, BY + i * 40, BX + 300, BY + i * 40 + 12, BX + BOARD_W + 10, BY + i * 40 + 4);
      ctx.stroke();
    }
    ctx.restore();

    ctx.strokeStyle = 'rgba(59, 42, 28, .75)';
    ctx.lineWidth = 1.4;
    for (let i = 0; i < N; i++) {
      ctx.beginPath();
      ctx.moveTo(BX, BY + i * CELL);
      ctx.lineTo(BX + BOARD_W, BY + i * CELL);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(BX + i * CELL, BY);
      ctx.lineTo(BX + i * CELL, BY + BOARD_W);
      ctx.stroke();
    }
    // 星位
    [[3, 3], [3, 11], [11, 3], [11, 11], [7, 7]].forEach(([r, c]) => {
      ctx.fillStyle = '#3B2F2A';
      ctx.beginPath();
      ctx.arc(BX + c * CELL, BY + r * CELL, 4.2, 0, Math.PI * 2);
      ctx.fill();
    });

    // 悬停提示
    if (hover && canHumanPlay()) {
      const x = BX + hover.c * CELL, y = BY + hover.r * CELL;
      ctx.fillStyle = 'rgba(59, 47, 42, .22)';
      ctx.beginPath();
      ctx.arc(x, y, CELL * 0.42, 0, Math.PI * 2);
      ctx.fill();
    }

    // 棋子
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        if (!board[r][c]) continue;
        drawStone(BX + c * CELL, BY + r * CELL, board[r][c]);
      }
    }
    // 最后一手
    const lm = moves[moves.length - 1];
    if (lm) {
      const x = BX + lm.c * CELL, y = BY + lm.r * CELL;
      ctx.strokeStyle = '#E8745B';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.arc(x, y, CELL * 0.2, 0, Math.PI * 2);
      ctx.stroke();
    }
    // 胜利连线
    if (winLine && winLine.length >= 2) {
      const a = winLine[0], b = winLine[winLine.length - 1];
      ctx.save();
      ctx.shadowColor = 'rgba(245, 196, 81, .9)';
      ctx.shadowBlur = 20;
      ctx.strokeStyle = 'rgba(255, 217, 125, .95)';
      ctx.lineWidth = 6;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(BX + a.c * CELL, BY + a.r * CELL);
      ctx.lineTo(BX + b.c * CELL, BY + b.r * CELL);
      ctx.stroke();
      ctx.restore();
    }

    // 棋盘标题
    Draw.text(ctx, '骋 望 楼 · 棋 室', BX + BOARD_W / 2, BY - 42, 13, 'rgba(255, 240, 200, .75)', 'center');
  }

  function drawStone(x, y, color) {
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(x + 2, y + 4, CELL * 0.4, CELL * 0.36, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(40, 24, 12, .3)';
    ctx.fill();
    const g = ctx.createRadialGradient(x - CELL * 0.16, y - CELL * 0.18, 2, x, y, CELL * 0.45);
    if (color === 1) {
      g.addColorStop(0, '#7A7A7A');
      g.addColorStop(0.45, '#3A3A3A');
      g.addColorStop(1, '#141414');
    } else {
      g.addColorStop(0, '#FFFFFF');
      g.addColorStop(0.6, '#F2EEE4');
      g.addColorStop(1, '#CFC6B4');
    }
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, CELL * 0.42, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = color === 1 ? 'rgba(0,0,0,.7)' : 'rgba(140,120,90,.65)';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    // 高光
    ctx.fillStyle = 'rgba(255,255,255,' + (color === 1 ? '.22' : '.75') + ')';
    ctx.beginPath();
    ctx.ellipse(x - CELL * 0.13, y - CELL * 0.15, CELL * 0.1, CELL * 0.07, -0.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawPanel() {
    hitBtns.length = 0;
    Draw.fillRR(ctx, PANEL_X, 56, 290, 488, 16, 'rgba(255, 248, 232, .06)', 'rgba(255, 248, 232, .14)', 1.5);
    Draw.text(ctx, '五 子 棋', PANEL_X + 145, 88, 20, '#FFE9A8', 'center', 'bold', 'rgba(0,0,0,.4)', 3);
    Draw.text(ctx, label(mode) + ' · 15 路', PANEL_X + 145, 110, 11, 'rgba(255,255,255,.5)', 'center');

    // 回合
    let turnText;
    if (gameOver) turnText = winner === 0 ? '和棋' : (winner === 1 ? '黑棋胜' : '白棋胜');
    else if (mode === 'online') {
      turnText = !connected ? '等待连接…' : (turn === myColor ? '轮到你落子' : '等待对手…');
    } else if (mode === 'pve') {
      turnText = turn === 1 ? '轮到你（黑）' : 'AI 思考中…';
    } else {
      turnText = turn === 1 ? '黑棋回合' : '白棋回合';
    }
    Draw.fillRR(ctx, PANEL_X + 20, 132, 250, 54, 12, 'rgba(255,255,255,.06)', 'rgba(255,255,255,.12)', 1);
    if (!gameOver) drawStone(PANEL_X + 52, 159, turn);
    else {
      ctx.fillStyle = 'rgba(255,217,125,.9)';
      Draw.star(ctx, PANEL_X + 52, 159, 11, 5);
      ctx.fill();
    }
    Draw.text(ctx, turnText, PANEL_X + 78, 152, 14, '#FFFDF5', 'left');
    Draw.text(ctx, '共 ' + moves.length + ' 手' + (mode === 'online' ? ' · 你执' + (myColor === 1 ? '黑' : '白') : ''), PANEL_X + 78, 172, 10, 'rgba(255,255,255,.45)', 'left');

    // 按钮
    const btnDefs = [];
    if (mode !== 'online') {
      btnDefs.push({ label: '悔棋', fn: undo });
    } else {
      btnDefs.push({ label: '重开', fn: onlineRestart });
    }
    btnDefs.push({ label: '重新开始', fn: () => { finishGame.done = false; resetBoard(); if (mode === 'online' && dc && dc.readyState === 'open') dc.send(JSON.stringify({ t: 'restart' })); Sfx.play('click'); } });
    btnDefs.push({ label: '换模式', fn: showMenu });

    btnDefs.forEach((b, i) => {
      const bw = mode === 'online' ? 116 : 116;
      const x = PANEL_X + 20 + i * 132;
      const y = 204;
      Draw.fillRR(ctx, x, y, bw, 40, 10, 'rgba(255,255,255,.08)', 'rgba(255,255,255,.2)', 1.2);
      Draw.text(ctx, b.label, x + bw / 2, y + 20, 12.5, '#FFFDF5');
      hitBtns.push({ x, y, w: bw, h: 40, fn: b.fn });
    });

    // 联机快捷互动
    if (mode === 'online') {
      Draw.text(ctx, '快捷互动', PANEL_X + 145, 272, 11, 'rgba(255,255,255,.45)', 'center');
      const msgs = ['好棋', '加油', '让我想想', '哈哈', '认输'];
      msgs.forEach((m, i) => {
        const x = PANEL_X + 20 + (i % 3) * 86;
        const y = 286 + Math.floor(i / 3) * 46;
        Draw.fillRR(ctx, x, y, 78, 34, 17, 'rgba(255,217,125,.1)', 'rgba(255,217,125,.4)', 1.2);
        Draw.text(ctx, m, x + 39, y + 17, 11.5, '#FFE9A8');
        hitBtns.push({
          x, y, w: 78, h: 34, fn: () => {
            if (dc && dc.readyState === 'open') {
              dc.send(JSON.stringify({ t: 'chat', msg: m }));
              showBubble('你：' + m);
            }
            if (m === '认输' && !gameOver) {
              if (dc && dc.readyState === 'open') dc.send(JSON.stringify({ t: 'resign' }));
              winner = myColor === 1 ? 2 : 1;
              gameOver = true;
              scheduleFinish(600);
            }
          }
        });
      });
      Draw.text(ctx, connected ? '已连接 · 点对点' : '未连接', PANEL_X + 145, 382, 10, connected ? '#A8D5A2' : 'rgba(255,255,255,.35)', 'center');
    }

    // 提示 / 气泡
    Draw.fillRR(ctx, PANEL_X + 20, 400, 250, 124, 12, 'rgba(0,0,0,.18)', 'rgba(255,255,255,.08)', 1);
    const tips = mode === 'pve'
      ? ['AI 会进攻也会防守', '先手记得抢中心', '活三、冲四比蛮冲管用', '悔棋会撤回你和 AI 各一手']
      : mode === 'pvp'
        ? ['黑棋先行，轮流落子', '横竖斜连成五子即胜', '长连同样算赢']
        : ['邀请码较长，全选复制', '同一 Wi-Fi 下连接更稳', '连接后房主执黑先行', '发快捷短语不会打断对局'];
    tips.forEach((t, i) => Draw.text(ctx, '· ' + t, PANEL_X + 34, 424 + i * 24, 10.5, 'rgba(255,255,255,.42)', 'left'));

    if (bubbleTimer > 0) {
      const alpha = clamp(bubbleTimer * 1.5, 0, 1);
      ctx.globalAlpha = alpha;
      Draw.fillRR(ctx, PANEL_X + 8, 540, 274, 40, 14, 'rgba(255, 248, 232, .92)', '#C9B48F', 1.4);
      Draw.text(ctx, bubble, PANEL_X + 145, 560, 12, '#5A3B2A', 'center');
      ctx.globalAlpha = 1;
    }
  }

  function undo() {
    if (gameOver || mode === 'online') return;
    if (mode === 'pve') {
      // 撤回 AI 与玩家各一手
      if (moves.length < 2) return;
      let lastMove = moves.pop();
      board[lastMove.r][lastMove.c] = 0;
      let pMove = null;
      if (moves.length && moves[moves.length - 1].color === 1) pMove = moves.pop();
      if (pMove) board[pMove.r][pMove.c] = 0;
      turn = 1;
      aiThinking = false;
      clearTimeout(aiTimer);
    } else {
      const lastMove = moves.pop();
      if (!lastMove) return;
      board[lastMove.r][lastMove.c] = 0;
      turn = lastMove.color;
    }
    gameOver = false;
    winner = 0;
    winLine = null;
    Sfx.play('click');
  }

  function onlineRestart() {
    if (!connected) return;
    resetBoard();
    finishGame.done = false;
    if (dc && dc.readyState === 'open') dc.send(JSON.stringify({ t: 'restart' }));
    showBubble('已重新开局');
    Sfx.play('up');
  }

  function draw() {
    drawBoard();
    drawPanel();
    if (bubbleTimer > 0) {
      // 棋盘上方气泡
      Draw.fillRR(ctx, 300, 18, 240, 34, 17, 'rgba(255, 248, 232, .92)', '#C9B48F', 1.4);
      Draw.text(ctx, bubble, 420, 35, 12, '#5A3B2A');
    }
  }

  function update(dt) {
    if (bubbleTimer > 0) bubbleTimer -= dt;
  }

  function loop(t) {
    if (paused || destroyed || !ctx) return;
    if (!last) last = t;
    const dt = Math.min(0.05, (t - last) / 1000);
    last = t;
    update(dt);
    draw();
    raf = requestAnimationFrame(loop);
  }

  showMenu();

  return {
    pause() { paused = true; cancelAnimationFrame(raf); },
    resume() { if (destroyed) return; paused = false; last = 0; raf = requestAnimationFrame(loop); },
    destroy() {
      destroyed = true;
      paused = true;
      cancelAnimationFrame(raf);
      clearTimeout(aiTimer);
      clearTimeout(finishTimer);
      cleanupOnline();
      if (menuEl) menuEl.remove();
      if (onlineEl) onlineEl.remove();
      removeCanvas();
    }
  };
};
