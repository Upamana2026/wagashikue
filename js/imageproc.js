// ============================
// キャラクター画像 白背景透過処理
// ============================
// ・透明ピクセルが1つでもあれば「既に透過済み」とみなして処理スキップ
// ・白背景のみの場合はCanvas APIでピクセル除去
// ・処理結果は絶対URLをキーとしてキャッシュ（アニメ切替でも再処理しない）

const _imgCache = new Map(); // absoluteURL → dataURL or 'SKIP'

// ---- 内部: 白背景除去 ------------------------------------------------
// 戻り値: 処理済みdataURL | null（既に透過あり → スキップ）
function _removeBg(imgEl) {
  const w = imgEl.naturalWidth;
  const h = imgEl.naturalHeight;
  if (!w || !h) throw new Error('not loaded');

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(imgEl, 0, 0);
  const idata = ctx.getImageData(0, 0, w, h);
  const px    = idata.data;

  // 透明ピクセルが1つでもある → 既に透過 → スキップ
  for (let i = 3; i < px.length; i += 4) {
    if (px[i] < 250) return null;
  }

  // 全ピクセル不透明 → 輝度で白背景を除去
  for (let i = 0; i < px.length; i += 4) {
    const lum = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
    if (lum >= 240) {
      px[i + 3] = 0;
    } else if (lum > 200) {
      px[i + 3] = Math.round(px[i + 3] * (240 - lum) / 40);
    }
  }
  ctx.putImageData(idata, 0, 0);
  return canvas.toDataURL('image/png');
}

// ---- 内部: dataset の相対パスを絶対URLへ解決 -------------------------
function _resolveUrl(rel) {
  try { return new URL(rel, document.baseURI).href; }
  catch { return rel; }
}

// ---- 内部: img を処理して src / dataset を更新 -----------------------
function _processImg(img) {
  if (img.src.startsWith('data:')) return; // 処理済み
  const absUrl = img.src;
  if (_imgCache.has(absUrl)) {
    _applyCache(img, absUrl);
    return;
  }
  try {
    const dataUrl = _removeBg(img);
    _imgCache.set(absUrl, dataUrl || 'SKIP');
    _applyCache(img, absUrl);
  } catch (e) {
    // CORS / file:// 等で Canvas が汚染され getImageData が読めない場合。
    // 以前はここで mix-blend-mode:'multiply' をかけていたが、multiply は
    // 要素を背景色（青空）と乗算合成するため、白〜淡色の体（白い餅・水色の
    // カップ等）が背景の青に溶けて「体が透明に見える」バグの原因になっていた。
    // 本プロジェクトの画像は元から透過PNGなので、読めない時は加工せず
    // そのまま表示するのが正しい。SKIP として記録し何もしない。
    _imgCache.set(absUrl, 'SKIP');
    // 過去に multiply が付与されていた場合に備えて明示的に解除しておく
    if (img.style.mixBlendMode) img.style.mixBlendMode = '';
  }
}

function _applyCache(img, absUrl) {
  const cached = _imgCache.get(absUrl);
  if (!cached || cached === 'SKIP') return; // スキップ or 未処理

  // dataset の中で同じ画像を指しているものをdataURLに差し替え
  ['normal', 'jump', 'attack'].forEach(k => {
    if (img.dataset[k] && _resolveUrl(img.dataset[k]) === absUrl) {
      img.dataset[k] = cached;
    }
  });

  // 現在表示中のsrcを更新
  if (img.src === absUrl) img.src = cached;
}

// ============================
// 外部API: バトル用スプライト
// normal/jump/attack の全パターンを処理する
// アニメ中のsrc切替にも対応するため load イベントを毎回監視
// ============================
function processCharSprite(img) {
  if (img._bgListening) return;
  img._bgListening = true;

  function onLoad() {
    _processImg(img);
  }
  img.addEventListener('load', onLoad);
  // 初回: 既にロード済みなら即実行
  if (img.complete && img.naturalWidth > 0) onLoad();

  // jump / attack の差分画像を事前にキャッシュしておく
  ['jump', 'attack'].forEach(k => {
    const rel = img.dataset[k];
    if (!rel || rel === img.dataset.normal) return;
    const absUrl = _resolveUrl(rel);
    if (_imgCache.has(absUrl)) return;
    const pre = new Image();
    pre.onload = () => {
      try {
        const dataUrl = _removeBg(pre);
        _imgCache.set(absUrl, dataUrl || 'SKIP');
        // このimgのdatasetに反映
        if (img.dataset[k] === rel || img.dataset[k] === absUrl) {
          if (dataUrl) img.dataset[k] = dataUrl;
        }
      } catch {
        _imgCache.set(absUrl, 'SKIP');
      }
    };
    pre.crossOrigin = 'anonymous';
    pre.src = absUrl;
  });
}

// ============================
// 外部API: 静止画用（図鑑・ガチャ・ストック）
// ============================
function processStaticImg(img) {
  if (!img) return;
  function onLoad() {
    _processImg(img);
  }
  if (img.complete && img.naturalWidth > 0) onLoad();
  else img.addEventListener('load', onLoad, { once: true });
}
