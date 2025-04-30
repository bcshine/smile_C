// PWA 캐싱을 위한 서비스 워커
const CACHE_NAME = 'smile-c-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/notification-details.html',
  '/fcm-test.html',
  '/styles.css',
  '/style.css',
  '/app.js',
  '/script.js',
  '/images/notification-icon.png',
  '/images/notification-badge.png',
  '/images/icon-192x192.png',
  '/images/icon-512x512.png',
  '/manifest.json'
];

// 서비스 워커 설치 시 리소스 캐싱
self.addEventListener('install', event => {
  console.log('PWA 서비스 워커 설치 중...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('PWA 캐시 생성 완료');
        return cache.addAll(ASSETS_TO_CACHE);
      })
      .then(() => self.skipWaiting())
  );
});

// 서비스 워커 활성화 시 이전 캐시 정리
self.addEventListener('activate', event => {
  console.log('PWA 서비스 워커 활성화 중...');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.filter(cacheName => {
          return cacheName !== CACHE_NAME;
        }).map(cacheName => {
          console.log(`이전 캐시 삭제: ${cacheName}`);
          return caches.delete(cacheName);
        })
      );
    }).then(() => self.clients.claim())
  );
});

// 네트워크 요청 가로채기 (오프라인 지원)
self.addEventListener('fetch', event => {
  // Firebase 요청은 캐싱하지 않음
  if (event.request.url.includes('firebaseio.com') || 
      event.request.url.includes('googleapis.com')) {
    return;
  }
  
  // 캐시 우선, 캐시에 없으면 네트워크 요청 (Cache-First 전략)
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          console.log('캐시에서 응답 찾음:', event.request.url);
          return response;
        }
        
        console.log('캐시에 없음, 네트워크에서 가져오기:', event.request.url);
        return fetch(event.request)
          .then(networkResponse => {
            // 성공한 네트워크 응답만 캐시에 저장
            if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
              return networkResponse;
            }
            
            // 네트워크 응답을 캐시에 저장 (응답은 스트림이므로 복제 필요)
            let responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseToCache);
              });
            
            return networkResponse;
          })
          .catch(error => {
            console.error('네트워크 요청 실패:', error);
            // 오프라인 폴백 페이지 제공 (필요한 경우)
            if (event.request.mode === 'navigate') {
              return caches.match('/offline.html');
            }
            return null;
          });
      })
  );
}); 