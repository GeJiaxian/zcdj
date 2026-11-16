/* =========================================================
   首页：标题、校门开启动画、吉祥物入场
   ========================================================= */
'use strict';

const HomePage = {
  busy: false,
  init() {
    Sfx.init();
    $('#mascot-home').innerHTML = mascotHTML();
    this.makeLeaves();
    this.bind();
    this.syncSound();
  },
  bind() {
    const enter = () => this.enterCampus();
    $('#btn-enter').addEventListener('click', enter);
    $('#gate-scene').addEventListener('click', enter);
    $('#btn-history-home').addEventListener('click', () => History.open());
    $('#btn-sound-home').addEventListener('click', () => {
      Sfx.toggle();
      this.syncSound();
    });

    document.addEventListener('keydown', e => {
      if (UI.current !== 'screen-home') return;
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        enter();
      }
    });
  },
  syncSound() {
    const btn = $('#btn-sound-home');
    btn.classList.toggle('off', !Sfx.on);
    btn.textContent = Sfx.on ? '音效' : '静音';
    btn.title = Sfx.on ? '点击关闭音效' : '点击开启音效';
  },
  makeLeaves() {
    const layer = $('#leaf-layer');
    for (let i = 0; i < 9; i++) {
      const s = document.createElement('span');
      s.className = 'float-leaf';
      s.style.left = rand(0, 100) + 'vw';
      s.style.top = rand(-20, 10) + 'vh';
      s.style.animationDuration = rand(9, 18) + 's';
      s.style.animationDelay = -rand(0, 14) + 's';
      s.style.transform = `scale(${rand(0.6, 1.4)})`;
      s.style.opacity = rand(0.25, 0.55);
      layer.appendChild(s);
    }
  },
  enterCampus() {
    if (this.busy) return;
    this.busy = true;
    Sfx.init();
    Sfx.play('up');
    const gate = $('#gate');
    const screen = $('#screen-home');
    const mascot = $('#mascot-home');
    gate.classList.add('opening');
    mascot.classList.add('walking');
    screen.classList.add('entering');

    // 脚步声
    for (let i = 0; i < 4; i++) {
      setTimeout(() => { if (Sfx.on) Sfx.play('step'); }, 150 + i * 250);
    }

    setTimeout(() => {
      UI.fade(() => {
        UI.go('screen-map');
        if (window.MapPage) MapPage.onShow(true);
        // 复位首页状态
        gate.classList.remove('opening');
        mascot.classList.remove('walking');
        screen.classList.remove('entering');
        HomePage.busy = false;
      });
    }, 1250);
  }
};
