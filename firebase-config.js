// Firebase configuration and authentication utilities
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-analytics.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyCwx7sfeHtmqxb3D-CkyB4DBtFFEpG0ADw",
    authDomain: "smile-c-b8074.firebaseapp.com",
    projectId: "smile-c-b8074",
    storageBucket: "smile-c-b8074.firebasestorage.app",
    messagingSenderId: "747999033560",
    appId: "1:747999033560:web:53d62a80b2086bc3f1ffad",
    measurementId: "G-TK56LG30CK"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
export const auth = getAuth(app);

// Error messages mapping
const errorMessages = {
    'auth/user-not-found': '등록되지 않은 이메일입니다.',
    'auth/wrong-password': '비밀번호가 일치하지 않습니다.',
    'auth/invalid-email': '올바른 이메일 형식을 입력해주세요.',
    'default': '로그인에 실패했습니다. 다시 시도해주세요.'
};

// Auto login utilities
export const autoLogin = {
    save: (email, password) => {
        localStorage.setItem('autoLoginEmail', email);
        localStorage.setItem('autoLoginPassword', password);
    },
    clear: () => {
        localStorage.removeItem('autoLoginEmail');
        localStorage.removeItem('autoLoginPassword');
    },
    tryLogin: async () => {
        const email = localStorage.getItem('autoLoginEmail');
        const password = localStorage.getItem('autoLoginPassword');
        
        if (email && password) {
            try {
                await signInWithEmailAndPassword(auth, email, password);
                return true;
            } catch (error) {
                autoLogin.clear();
                return false;
            }
        }
        return false;
    }
};

// Authentication utilities
export const authUtils = {
    getErrorMessage: (errorCode) => {
        return errorMessages[errorCode] || errorMessages.default;
    },
    
    handleAuthStateChange: (callback) => {
        return onAuthStateChanged(auth, callback);
    }
}; 