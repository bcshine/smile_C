// 서비스 워커 로드 시 콘솔 로그
console.log('Firebase Messaging Service Worker 로드됨');

// Firebase 서비스 워커 (FCM 용)
importScripts('https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js');
importScripts('https://www.gstatic.com/firebasejs/8.10.1/firebase-messaging.js');

// 서비스 워커 설치 이벤트 처리
self.addEventListener('install', event => {
    console.log('Service Worker 설치됨', event);
    self.skipWaiting(); // 즉시 활성화
});

// 서비스 워커 활성화 이벤트 처리
self.addEventListener('activate', event => {
    console.log('Service Worker 활성화됨', event);
    return self.clients.claim(); // 모든 클라이언트 제어 권한 획득
});

// 서비스 워커 푸시 이벤트 처리
self.addEventListener('push', event => {
    console.log('Push 이벤트 수신:', event);
    
    if (event.data) {
        try {
            const dataObj = event.data.json();
            console.log('푸시 데이터:', dataObj);
            
            // 알림 표시 (사용자 상호작용 필요 옵션 추가)
            const title = dataObj.notification.title || '알림';
            const options = {
                body: dataObj.notification.body || '',
                icon: './images/notification-icon.png',
                badge: './images/notification-badge.png',
                requireInteraction: true,  // 사용자가 직접 닫을 때까지 알림 유지
                vibrate: [200, 100, 200]   // 알림 진동 패턴 추가
            };
            
            event.waitUntil(self.registration.showNotification(title, options));
        } catch (e) {
            console.error('푸시 데이터 처리 오류:', e);
        }
    }
});

// Firebase 초기화
firebase.initializeApp({
    apiKey: "AIzaSyCwx7sfeHtmqxb3D-CkyB4DBtFFEpG0ADw",
    authDomain: "smile-c-b8074.firebaseapp.com",
    projectId: "smile-c-b8074",
    storageBucket: "smile-c-b8074.firebasestorage.app",
    messagingSenderId: "747999033560",
    appId: "1:747999033560:web:53d62a80b2086bc3f1ffad",
    measurementId: "G-TK56LG30CK"
});

// 메시징 객체 가져오기
const messaging = firebase.messaging();
console.log('Firebase Messaging 초기화됨');

// 백그라운드 메시지 핸들러
messaging.onBackgroundMessage((payload) => {
    console.log('[firebase-messaging-sw.js] 백그라운드 메시지 수신:', payload);
    
    // 알림 데이터 추출
    const notificationTitle = payload.notification.title;
    const notificationOptions = {
        body: payload.notification.body,
        icon: '/images/notification-icon.png',
        badge: '/images/notification-badge.png',
        timestamp: Date.now()
    };
    
    // 알림 표시
    return self.registration.showNotification(notificationTitle, notificationOptions);
});

// 알림 클릭 이벤트 처리
self.addEventListener('notificationclick', (event) => {
    console.log('[firebase-messaging-sw.js] 알림 클릭 처리');
    
    event.notification.close();
    
    // 알림 클릭시 앱 열기
    event.waitUntil(
        clients.openWindow('/')
    );
}); 