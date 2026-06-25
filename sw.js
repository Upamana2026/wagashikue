// ============================
// Service Worker（PWA / オフライン対応）
// GitHub Pages のサブディレクトリ配信でも動くよう、
// すべて相対パスで登録・キャッシュする。
// ※ ファイルを更新したら CACHE のバージョン名（v1 → v2 ...）を上げる
// ============================
const CACHE = 'wagashikue-v10';

// 起動に必要な「アプリシェル」一式（相対パス）
const APP_SHELL = [
  './',
  './index.html',
  './style.css',
  './manifest.json',
  './js/imageproc.js',
  './js/data.js',
  './js/storage.js',
  './js/quiz.js',
  './js/battle.js',
  './js/gacha.js',
  './js/encyclopedia.js',
  './js/bgm.js',
  './js/app.js',
  './Samurai_Strain.mp3',
  './新年の風.mp3',
  './中アイコン.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

// インストール: アプリシェルを事前キャッシュ
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      // 1つでも失敗すると addAll 全体が失敗するため、個別に許容する
      .then((cache) => Promise.all(
        APP_SHELL.map((url) => cache.add(url).catch(() => null))
      ))
      .then(() => self.skipWaiting())
  );
});

// 有効化: 古いバージョンのキャッシュを掃除
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// フェッチ: キャッシュ優先（無ければネットワーク → 取得できたものは実行時キャッシュ）
// キャラ画像や CDN(SheetJS) も初回アクセス後はオフラインで使える。
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        // 成功レスポンス（同一オリジン or CDN の opaque）を実行時キャッシュ
        if (res && (res.ok || res.type === 'opaque')) {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(req, copy)).catch(() => {});
        }
        return res;
      }).catch(() => {
        // オフラインかつ未キャッシュ: ナビゲーションなら index.html を返す
        if (req.mode === 'navigate') return caches.match('./index.html');
        return cached;
      });
    })
  );
});
