// DOM 요소
const video = document.getElementById('video');
const canvas = document.getElementById('face-points');
const ctx = canvas.getContext('2d');
const scoreValue = document.getElementById('score-value');
const message = document.getElementById('message');
const videoWrapper = document.getElementById('video-wrapper');

// 앱 상태 변수
let isRunning = false;
let currentScore = 80; // 기본 점수
let isMobile = window.innerWidth <= 480; // 모바일 기기 여부

// 창 크기 변경 감지
window.addEventListener('resize', () => {
    isMobile = window.innerWidth <= 480;
    if (video.videoWidth > 0) {
        // 비디오가 로드된 상태에서만 캔버스 크기 조정
        resizeCanvas();
    }
});

// 캔버스 크기 조정 함수
function resizeCanvas() {
    const videoEl = video;
    const wrapperWidth = videoWrapper.clientWidth;
    const wrapperHeight = videoWrapper.clientHeight;
    
    // 비디오 요소와 캔버스의 크기를 wrapper에 맞춤
    canvas.width = wrapperWidth;
    canvas.height = wrapperHeight;
    
    console.log(`캔버스 크기 조정: ${canvas.width} x ${canvas.height}`);
}

// Face-API.js 모델 로드 및 앱 초기화
async function init() {
    message.innerText = '모델을 로딩하는 중...';
    
    try {
        // 모델 경로 설정 - CDN에서 직접 로드
        const MODEL_URL = 'https://justadudewhohacks.github.io/face-api.js/models';
        
        // Face-API.js 모델 로드 - CDN 경로 직접 지정
        await Promise.all([
            faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
            faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL)
        ]);
        
        message.innerText = '모델 로딩 완료, 카메라 시작 중...';
        
        // 카메라 시작
        await setupCamera();
        message.innerText = '얼굴을 카메라에 맞춰주세요';
        
        // 얼굴 감지 시작
        startFaceDetection();
    } catch (error) {
        console.error('초기화 실패:', error);
        message.innerText = '카메라 접근에 실패했습니다: ' + error.message;
    }
}

// 카메라 설정
async function setupCamera() {
    try {
        // 카메라 액세스 시도
        console.log("카메라 액세스 요청 중...");
        
        // 세로 화면에 최적화된 비디오 설정
        let constraints = {
            video: {
                facingMode: { ideal: 'user' },
                width: { ideal: isMobile ? 480 : 640 },
                height: { ideal: isMobile ? 640 : 720 } // 세로 비율 높임
            },
            audio: false
        };
        
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        
        console.log("카메라 액세스 성공!");
        
        // 비디오 소스 설정
        video.srcObject = stream;
        
        return new Promise((resolve) => {
            video.onloadedmetadata = () => {
                // 비디오 요소에 크기가 설정된 후 캔버스 크기도 설정
                console.log("비디오 메타데이터 로드됨, 크기:", video.videoWidth, "x", video.videoHeight);
                
                // 캔버스 크기 조정
                resizeCanvas();
                
                // 비디오가 준비되면 재생 시작
                video.play().then(() => {
                    console.log("비디오 재생 시작");
                    resolve();
                }).catch(err => {
                    console.error("비디오 재생 실패:", err);
                    resolve(); // 재생에 실패해도 진행
                });
            };
            
            // 오류 처리
            video.onerror = (err) => {
                console.error("비디오 요소 오류:", err);
                message.innerText = "비디오 로드 중 오류가 발생했습니다";
                resolve(); // 오류가 발생해도 진행
            };
        });
    } catch (error) {
        console.error("카메라 액세스 오류:", error);
        // 더 자세한 오류 메시지 표시
        if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
            throw new Error('카메라 권한이 거부되었습니다. 브라우저 설정에서 카메라 접근을 허용해주세요.');
        } else if (error.name === 'NotFoundError') {
            throw new Error('카메라를 찾을 수 없습니다. 카메라가 연결되어 있는지 확인해주세요.');
        } else {
            throw new Error(`카메라에 접근할 수 없습니다: ${error.message}`);
        }
    }
}

// 얼굴 감지 및 표정 분석 시작
function startFaceDetection() {
    isRunning = true;
    detectFace();
}

// 실시간 얼굴 감지 및 분석
async function detectFace() {
    if (!isRunning) return;
    
    try {
        // 얼굴 및 랜드마크 감지
        const detections = await faceapi.detectSingleFace(
            video, 
            new faceapi.TinyFaceDetectorOptions()
        ).withFaceLandmarks();
        
        // 캔버스 초기화
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // 얼굴이 감지되면 표정 분석
        if (detections) {
            // 크기 조정 (비디오 크기와 캔버스 크기가 다를 경우)
            const displaySize = { width: canvas.width, height: canvas.height };
            const resizedDetections = faceapi.resizeResults(detections, displaySize);
            
            // 랜드마크 그리기 (시각화)
            drawLandmarks(resizedDetections);
            
            // 웃음/찡그림 분석
            analyzeSmile(resizedDetections);
        }
        
        // 다음 프레임 감지
        requestAnimationFrame(detectFace);
    } catch (error) {
        console.error('얼굴 감지 오류:', error);
        message.innerText = '얼굴 감지 중 오류가 발생했습니다';
        setTimeout(() => {
            if (isRunning) detectFace();
        }, 1000);
    }
}

// 얼굴 랜드마크 그리기
function drawLandmarks(detections) {
    // 얼굴 윤곽선 그리기
    ctx.beginPath();
    ctx.strokeStyle = '#3498db';
    ctx.lineWidth = 2;
    
    // 입 부분만 강조해서 그리기
    const mouth = detections.landmarks.getMouth();
    ctx.moveTo(mouth[0].x, mouth[0].y);
    for (let i = 1; i < mouth.length; i++) {
        ctx.lineTo(mouth[i].x, mouth[i].y);
    }
    ctx.closePath();
    ctx.stroke();
    
    // 눈썹과 눈도 간단히 표시
    const leftEye = detections.landmarks.getLeftEye();
    const rightEye = detections.landmarks.getRightEye();
    const leftEyebrow = detections.landmarks.getLeftEyeBrow();
    const rightEyebrow = detections.landmarks.getRightEyeBrow();
    
    drawPoints(leftEye, 2, '#3498db');
    drawPoints(rightEye, 2, '#3498db');
    drawPoints(leftEyebrow, 2, '#3498db');
    drawPoints(rightEyebrow, 2, '#3498db');
}

// 점 그리기 헬퍼 함수
function drawPoints(points, radius, color) {
    ctx.fillStyle = color;
    for (let i = 0; i < points.length; i++) {
        ctx.beginPath();
        ctx.arc(points[i].x, points[i].y, radius, 0, 2 * Math.PI);
        ctx.fill();
    }
}

// 웃음/찡그림 분석하기
function analyzeSmile(detections) {
    const mouth = detections.landmarks.getMouth();
    
    // 입 모양 분석을 위한 주요 포인트
    const topLip = mouth[14]; // 윗입술 중앙
    const bottomLip = mouth[18]; // 아랫입술 중앙
    const leftCorner = mouth[0]; // 왼쪽 입꼬리
    const rightCorner = mouth[6]; // 오른쪽 입꼬리
    
    // 입 높이와 너비 계산
    const mouthHeight = Math.abs(bottomLip.y - topLip.y);
    const mouthWidth = Math.abs(rightCorner.x - leftCorner.x);
    
    // 입꼬리 위치 분석 (윗입술 높이 대비)
    const leftCornerHeight = topLip.y - leftCorner.y;
    const rightCornerHeight = topLip.y - rightCorner.y;
    
    // 입 모양 분석: U 모양 (웃음) vs 역 U 모양 (찡그림)
    const cornerAvgHeight = (leftCornerHeight + rightCornerHeight) / 2;
    
    // 미소 지수 계산 (양수: 웃음, 음수: 찡그림)
    const smileIndex = cornerAvgHeight / mouthHeight * 3; // 배율 조정
    
    // 점수 계산 (범위: 60-95)
    let newScore = 80; // 기본 점수
    
    if (smileIndex > 0) {
        // 웃는 얼굴 (80 이상)
        newScore = 80 + smileIndex * 15;
        if (newScore > 95) newScore = 95; // 최대 95점
    } else {
        // 찡그린 얼굴 (80 이하)
        newScore = 80 + smileIndex * 20;
        if (newScore < 60) newScore = 60; // 최소 60점
    }
    
    // 점수 부드럽게 변경
    currentScore = currentScore * 0.7 + newScore * 0.3;
    scoreValue.innerText = Math.round(currentScore);
    
    // 메시지 업데이트
    updateMessage(currentScore);
}

// 점수에 따른 메시지 업데이트
function updateMessage(score) {
    if (score >= 95) {
        message.innerText = '환한 미소가 아름다워요!';
    } else if (score >= 90) {
        message.innerText = '기분 좋은 미소네요!';
    } else if (score >= 85) {
        message.innerText = '살짝 웃고 있네요!';
    } else if (score >= 75) {
        message.innerText = '자연스러운 표정입니다.';
    } else if (score >= 70) {
        message.innerText = '조금 찡그리고 있어요.';
    } else {
        message.innerText = '많이 찡그리고 있어요. 힘내세요!';
    }
}

// 브라우저가 로드되면 앱 초기화
window.addEventListener('load', init); 