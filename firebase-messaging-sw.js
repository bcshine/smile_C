importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

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

// FCM 인스턴스 가져오기
const messaging = firebase.messaging();

// 백그라운드 메시지 핸들링
messaging.onBackgroundMessage((payload) => {
    console.log('백그라운드 메시지 수신:', payload);

    const notificationTitle = payload.notification.title;
    const notificationOptions = {
        body: payload.notification.body,
        icon: '/images/notification-icon.png',
        badge: '/images/notification-badge.png',
        timestamp: Date.now(),
        data: payload.data
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
}); 