// ============================
// BGM 管理（画面別BGM / PWA）
// ・バトル画面: Samurai_Strain.mp3
// ・その他の画面: 新年の風.mp3
// 音量・ミュートは端末(OS/ブラウザ)の設定に従う。
//   → アプリ側では volume を変更せず、ミュートUIも持たない。
//   → 端末の音量つまみ／サイレントモードがそのまま反映される。
// ============================
const BGM = (() => {
  // 画面名 → 再生するトラック。battle のみ専用曲、それ以外は共通曲。
  const TRACKS = {
    battle: './Samurai_Strain.mp3',
  };
  const DEFAULT_TRACK = './新年の風.mp3';

  const audio = new Audio();
  audio.loop = true;
  audio.preload = 'auto';
  // volume はデフォルト(1.0)のまま。端末の音量／ミュート設定に従わせるため、
  // ここで volume や muted を触らない。

  let currentSrc = null;   // 現在ロード中のトラック
  let armed = false;       // 自動再生ブロック時のユーザー操作待ち中か

  function resolveSrc(screen) {
    return TRACKS[screen] || DEFAULT_TRACK;
  }

  // 指定画面に応じたBGMへ切り替える（App.goTo から呼ぶ）
  function playFor(screen) {
    const src = resolveSrc(screen);
    if (src === currentSrc) {
      // 同じ曲。停止中なら再生だけ試みる（連続再生中は何もしない）
      if (audio.paused) tryPlay();
      return;
    }
    currentSrc = src;
    audio.src = src;
    tryPlay();
  }

  function tryPlay() {
    const p = audio.play();
    if (p && typeof p.catch === 'function') {
      // 自動再生がブラウザにブロックされた場合 → 次のユーザー操作で再生
      p.catch(() => armUserGesture());
    }
  }

  // 自動再生がブロックされたら、最初のタップ／キー入力で再生を開始する
  function armUserGesture() {
    if (armed) return;
    armed = true;
    const resume = () => {
      armed = false;
      document.removeEventListener('pointerdown', resume);
      document.removeEventListener('keydown', resume);
      tryPlay();
    };
    document.addEventListener('pointerdown', resume);
    document.addEventListener('keydown', resume);
  }

  return { playFor };
})();
