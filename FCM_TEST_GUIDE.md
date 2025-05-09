# Firebase Cloud Messaging (FCM) 웹 푸시 테스트 가이드

이 가이드는 웹 애플리케이션에서 Firebase Cloud Messaging을 테스트하는 방법을 설명합니다.

## 사전 준비 사항

1. **Node.js 설치**
   - [Node.js 다운로드](https://nodejs.org/)에서 최신 LTS 버전 설치

2. **Firebase 프로젝트 설정 확인**
   - Firebase 콘솔에서 `웹 푸시 인증서(VAPID 키)` 설정 확인
   - 프로젝트 설정 → 클라우드 메시징 탭

## 테스트 서버 실행

1. 명령 프롬프트(CMD) 또는 PowerShell 열기
2. 프로젝트 폴더로 이동
3. 다음 명령어 중 하나를 실행:

```bash
# Node.js 서버 (추천)
node server.js

# 또는 Python 서버
python -m http.server

# 또는 npx http-server
npx http-server
```

4. 브라우저에서 다음 주소로 접속:
   - Node.js 서버: `http://localhost:3000/`
   - Python 서버: `http://localhost:8000/fcm-test.html`
   - http-server: `http://localhost:8080/fcm-test.html`

## 테스트 단계

### 1. 알림 권한 확인

1. "권한 확인" 버튼 클릭
2. 브라우저에서 알림 권한 요청 팝업이 나타나면 "허용" 선택
3. "현재 권한 상태: granted" 메시지가 표시되어야 함

### 2. 서비스 워커 확인

1. "서비스 워커 확인" 버튼 클릭
2. "등록된 서비스 워커:" 메시지와 함께 서비스 워커 정보가 표시되어야 함
3. 서비스 워커가 없으면 다음 단계에서 자동으로 등록됨

### 3. VAPID 키 확인

1. VAPID 키 입력 필드에 Firebase 콘솔에서 제공하는 키가 입력되어 있는지 확인
2. "VAPID 키 검증" 버튼 클릭
3. "VAPID 키 형식이 유효합니다" 메시지가 표시되어야 함

### 4. FCM 토큰 가져오기

1. "토큰 가져오기" 버튼 클릭
2. 다음 메시지가 순차적으로 표시됨:
   - "서비스 워커 등록 중..."
   - "서비스 워커 등록 완료, FCM 토큰 요청 중..."
   - "토큰이 성공적으로 생성되었습니다"
3. 텍스트 영역에 FCM 토큰이 표시됨

### 5. Firebase에 테스트 기기로 등록

1. "Firebase에 테스트 기기로 등록" 버튼 클릭
2. "테스트 기기로 성공적으로 등록되었습니다" 메시지 표시됨

### 6. 로컬 알림 테스트

1. "알림 보내기" 버튼 클릭
2. 브라우저에서 푸시 알림이 표시되는지 확인

## 문제 해결

### 서비스 워커 문제

- **서비스 워커 등록 오류**: 반드시 HTTPS 또는 localhost를 통해 접속해야 함
- **file:// 프로토콜 사용**: 서비스 워커는 file:// 프로토콜에서 작동하지 않음

### FCM 토큰 문제

- **알림 권한 거부**: 브라우저 설정에서 알림 권한 재설정
- **VAPID 키 오류**: Firebase 콘솔에서 올바른 키 확인
- **서비스 워커 활성화 안됨**: 브라우저 개발자 도구 → 애플리케이션 → 서비스 워커에서 상태 확인

### 콘솔 로그 확인

1. 브라우저에서 F12 키를 눌러 개발자 도구 열기
2. 콘솔 탭에서 오류 메시지 확인
3. 네트워크 탭에서 HTTP 요청 확인
4. 애플리케이션 탭 → 서비스 워커에서 상태 확인

## Firebase 콘솔에서 테스트

1. [Firebase 콘솔](https://console.firebase.google.com/) 접속
2. 프로젝트 선택
3. 왼쪽 메뉴에서 "Cloud Messaging" 선택
4. "테스트 메시지 보내기" 클릭
5. 방금 등록한 테스트 기기 선택
6. 메시지 입력 후 전송

## 알려진 문제

- **Chrome 브라우저 제한**: 같은 도메인에서 하나의 서비스 워커만 활성화 가능
- **HTTP vs HTTPS**: 실제 배포 환경에서는 HTTPS가 필요함
- **Firebase Admin SDK**: 서버에서 메시지를 보낼 때는 Admin SDK 사용 필요 