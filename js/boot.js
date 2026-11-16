/* =========================================================
   启动：初始化页面与游戏外壳按钮
   ========================================================= */
'use strict';

(function () {
  function initGameBar() {
    const pauseVisible = () => $('#pause-overlay').classList.contains('show');
    const resultVisible = () => $('#result-overlay').classList.contains('show');

    $('#btn-exit').addEventListener('click', () => Shell.close());
    $('#btn-exit-2').addEventListener('click', () => Shell.close());
    $('#btn-pause').addEventListener('click', () => {
      if (pauseVisible()) Shell.resume();
      else Shell.pause();
    });
    $('#btn-resume').addEventListener('click', () => Shell.resume());
    $('#btn-restart').addEventListener('click', () => Shell.restart());
    $('#btn-restart-2').addEventListener('click', () => Shell.restart());
    $('#btn-again').addEventListener('click', () => Shell.restart());
    $('#btn-back-map').addEventListener('click', () => Shell.close());

    document.addEventListener('keydown', e => {
      if (UI.current !== 'screen-game') return;
      const tag = (e.target && e.target.tagName) || '';
      if (tag === 'TEXTAREA' || tag === 'INPUT') return;
      if (e.key === 'Escape') {
        if (resultVisible()) return;
        e.preventDefault();
        if (pauseVisible()) Shell.resume();
        else Shell.pause();
      }
    });

    document.addEventListener('visibilitychange', () => {
      if (document.hidden && UI.current === 'screen-game' && Shell.current && !Shell.ended && !pauseVisible()) {
        Shell.pause();
      }
    });
  }

  function syncSoundButtons() {
    ['#btn-sound-home', '#btn-sound-map'].forEach(sel => {
      const btn = $(sel);
      if (!btn) return;
      btn.classList.toggle('off', !Sfx.on);
      btn.textContent = Sfx.on ? '音效' : '静音';
    });
  }

  function boot() {
    History.init();
    HomePage.init();
    MapPage.init();
    initGameBar();
    syncSoundButtons();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
