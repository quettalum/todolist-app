// ============================================================
// sw.js — Service Worker 离线缓存
// ============================================================

var CACHE_NAME = 'todolist-v9'

var CACHE_FILES = [
  'index.html',
  'manifest.json',
  'styles.css',
  'model.js',
  'storage.js',
  'sync.js',
  'ui.js',
  'app.js'
]

self.addEventListener('message', function (event) {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})

self.addEventListener('install', function (event) {
  self.skipWaiting()
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(CACHE_FILES)
    })
  )
})

self.addEventListener('activate', function (event) {
  event.waitUntil(
    clients.claim().then(function () {
      return caches.keys().then(function (keys) {
        return Promise.all(
          keys.filter(function (key) { return key !== CACHE_NAME })
            .map(function (key) { return caches.delete(key) })
        )
      })
    })
  )
})

self.addEventListener('fetch', function (event) {
  if (event.request.url.includes('api.github.com')) {
    return
  }
  event.respondWith(
    caches.match(event.request).then(function (cached) {
      var fetched = fetch(event.request).then(function (response) {
        if (response && response.status === 200 && response.type === 'basic') {
          var clone = response.clone()
          caches.open(CACHE_NAME).then(function (cache) {
            cache.put(event.request, clone)
          })
        }
        return response
      })
      return cached || fetched
    })
  )
})
