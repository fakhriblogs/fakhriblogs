/**
 * Service Worker — مدونات فخري
 * استراتيجية: Cache-First للأصول الثابتة، Network-First لـ Supabase و API
 * آمن تماماً ولا يتعارض مع Supabase أو أي طلبات خارجية
 */

const CACHE_NAME = 'fakhri-blogs-v1';

// الموارد التي نخزّنها محلياً للعمل offline
const STATIC_ASSETS = [
  './index.html',
  './manifest.json'
];

// النطاقات التي تمر مباشرة عبر الشبكة دائماً (لا نخزّنها أبداً)
const NETWORK_ONLY_PATTERNS = [
  'supabase.co',
  'supabase.in',
  'fonts.googleapis.com',
  'fonts.gstatic.com',
  'cdnjs.cloudflare.com',
  'cdn.tailwindcss.com',
  'cdn.jsdelivr.net'
];

// ─── تثبيت SW: تخزين الأصول الثابتة ───
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch(() => {
        // نتجاهل أخطاء التخزين لعدم تعطيل التثبيت
      });
    })
  );
  self.skipWaiting();
});

// ─── تفعيل SW: حذف الكاشات القديمة ───
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// ─── اعتراض الطلبات ───
self.addEventListener('fetch', (event) => {
  const url = event.request.url;

  // 1. طلبات non-GET تمر مباشرة دائماً
  if (event.request.method !== 'GET') return;

  // 2. النطاقات الخارجية (Supabase، CDN...) تمر مباشرة دائماً
  const isNetworkOnly = NETWORK_ONLY_PATTERNS.some((pattern) =>
    url.includes(pattern)
  );
  if (isNetworkOnly) return;

  // 3. بقية الموارد: Cache-First مع fallback للشبكة
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;

      return fetch(event.request)
        .then((response) => {
          // نخزّن فقط الردود الصحيحة
          if (
            response &&
            response.status === 200 &&
            response.type !== 'opaque'
          ) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, clone);
            });
          }
          return response;
        })
        .catch(() => {
          // Offline fallback: أعد index.html
          return caches.match('./index.html');
        });
    })
  );
});
