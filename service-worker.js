/**
 * service-worker.js —— PWA 离线缓存
 * 策略：应用外壳（HTML/CSS/JS/图标/manifest）在 install 时全部缓存；
 *       fetch 采用缓存优先，未命中则走网络并写入缓存。
 * 升级代码后请递增 CACHE_VERSION，旧缓存会在 activate 时被清理。
 */
var CACHE_VERSION = 'life-assistant-v1';
var CACHE_NAME = 'life-assistant-' + CACHE_VERSION;

/** 应用外壳：首次安装时全部缓存，确保离线可用 */
var APP_SHELL = [
  './index.html',
  './manifest.json',
  './css/style.css',
  './js/dateutil.js',
  './js/storage.js',
  './js/store.js',
  './js/stats.js',
  './js/backup.js',
  './js/ui.js',
  './js/app.js',
  './js/main.js',
  './js/views/home.js',
  './js/views/checkin-list.js',
  './js/views/checkin-detail.js',
  './js/views/account-daily.js',
  './js/views/account-stats.js',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(APP_SHELL);
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.filter(function (key) {
          return key !== CACHE_NAME;
        }).map(function (key) {
          return caches.delete(key);
        })
      );
    }).then(function () {
      return self.clients.claim();
    })
  );
});

/**
 * 缓存优先：命中缓存直接返回；未命中则走网络，成功后写入缓存。
 * 应用运行时不发起任何网络请求，此策略仅用于加载静态资源与离线兜底。
 */
self.addEventListener('fetch', function (event) {
  var req = event.request;
  if (req.method !== 'GET') return;

  event.respondWith(
    caches.match(req).then(function (cached) {
      if (cached) return cached;
      return fetch(req).then(function (resp) {
        if (!resp || resp.status !== 200 || resp.type === 'opaque') return resp;
        var clone = resp.clone();
        caches.open(CACHE_NAME).then(function (cache) {
          cache.put(req, clone);
        });
        return resp;
      }).catch(function () {
        // 离线且未命中缓存：导航请求回退到首页
        if (req.mode === 'navigate') {
          return caches.match('./index.html');
        }
      });
    })
  );
});
