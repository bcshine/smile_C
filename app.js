// DOM 요소
const video = document.getElementById('video');
const canvas = document.getElementById('face-points');
const ctx = canvas.getContext('2d');
const scoreValue = document.getElementById('score-value');
const message = document.getElementById('message');
const videoWrapper = document.getElementById('video-wrapper');

// 앱 상태 변수
let currentScore = 80;
let isVideoReady = false;
let currentZoom = 1.0;
let videoTrack = null;

// 디버깅을 위한 로그 함수
function debugLog(message) {
    console.log(`[DEBUG] ${message}`);
    document.getElementById('message').textContent = message;
}

// Face-API.js 모델 로드
async function loadModels() {
    try {
        debugLog('얼굴 인식 모델을 로드하는 중...');
        
        // CDN에서 직접 모델 로드
        const MODEL_URL = 'https://justadudewhohacks.github.io/face-api.js/models';
        
        await Promise.all([
            faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
            faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
            faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL)
        ]);
        
        debugLog('모델 로드 완료');
        return true;
    } catch (error) {
        debugLog('모델 로드 실패: ' + error.message);
        return false;
    }
}

// 비디오 크기 설정 함수
function setVideoSize() {
    if (video.videoWidth && video.videoHeight) {
        // 모바일 기기 감지
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        
        if (isMobile) {
            // 모바일에서는 화면 크기에 맞춤
            const containerWidth = window.innerWidth;
            const containerHeight = window.innerHeight;
            
            // 비디오 비율 계산
            const videoRatio = video.videoWidth / video.videoHeight;
            const containerRatio = containerWidth / containerHeight;
            
            if (videoRatio > containerRatio) {
                // 비디오가 가로로 더 길 경우
                canvas.width = containerWidth;
                canvas.height = containerWidth / videoRatio;
            } else {
                // 비디오가 세로로 더 길 경우
                canvas.height = containerHeight;
                canvas.width = containerHeight * videoRatio;
            }
            
            // 캔버스 중앙 정렬
            canvas.style.position = 'absolute';
            canvas.style.left = (containerWidth - canvas.width) / 2 + 'px';
            canvas.style.top = (containerHeight - canvas.height) / 2 + 'px';
        } else {
            // 데스크톱에서는 원본 크기 유지
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            canvas.style.position = 'static';
        }
        
        debugLog(`비디오 크기: ${video.videoWidth}x${video.videoHeight}`);
        debugLog(`캔버스 크기: ${canvas.width}x${canvas.height}`);
        isVideoReady = true;
    }
}

// 카메라 초기화
async function initCamera() {
    try {
        debugLog('카메라 초기화 중...');
        
        // 모바일 기기 감지
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        
        // 카메라 제약 조건 설정
        const constraints = {
            video: {
                width: isMobile ? { ideal: window.innerWidth } : { ideal: 640 },
                height: isMobile ? { ideal: window.innerHeight } : { ideal: 480 },
                facingMode: "user",
                aspectRatio: isMobile ? window.innerWidth / window.innerHeight : 4/3
            }
        };

        // 카메라 스트림 가져오기
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        debugLog('카메라 스트림 획득 성공');

        // 비디오 트랙 저장
        videoTrack = stream.getVideoTracks()[0];

        // 비디오 요소 설정
        video.srcObject = stream;
        
        // 비디오 메타데이터 로드 대기
        await new Promise((resolve) => {
            video.onloadedmetadata = () => {
                setVideoSize();
                resolve();
            };
        });

        // 비디오 크기 변경 감지
        video.addEventListener('resize', setVideoSize);

        // 화면 방향 변경 감지
        window.addEventListener('orientationchange', () => {
            setTimeout(setVideoSize, 100);
        });

        // 비디오 재생
        await video.play();
        debugLog('비디오 재생 시작');

        // 줌 버튼 이벤트 리스너 추가
        document.getElementById('zoom-in').addEventListener('click', () => adjustZoom(0.1));
        document.getElementById('zoom-out').addEventListener('click', () => adjustZoom(-0.1));

        return true;
    } catch (error) {
        debugLog('카메라 초기화 실패: ' + error.message);
        return false;
    }
}

// 줌 조정 함수
function adjustZoom(delta) {
    if (!videoTrack) return;
    
    try {
        const capabilities = videoTrack.getCapabilities();
        if (capabilities.zoom) {
            currentZoom = Math.max(1.0, Math.min(5.0, currentZoom + delta));
            videoTrack.applyConstraints({
                advanced: [{ zoom: currentZoom }]
            });
            debugLog(`줌 레벨: ${currentZoom.toFixed(1)}`);
        }
    } catch (error) {
        console.error('줌 조정 실패:', error);
    }
}

// 스마일 점수 계산 함수
function calculateSmileScore(detection) {
    try {
        const mouth = detection.landmarks.getMouth();
        
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
        const smileIndex = cornerAvgHeight / mouthHeight * 3;
        
        // 점수 계산 (범위: 60-95)
        let score = 80; // 기본 점수
        
        if (smileIndex > 0) {
            // 웃는 얼굴 (80 이상)
            score = 80 + smileIndex * 15;
            if (score > 95) score = 95; // 최대 95점
        } else {
            // 찡그린 얼굴 (80 이하)
            score = 80 + smileIndex * 20;
            if (score < 60) score = 60; // 최소 60점
        }
        
        debugLog(`스마일 점수 계산: ${score} (smileIndex: ${smileIndex})`);
        return score;
    } catch (error) {
        console.error('스마일 점수 계산 오류:', error);
        return 80; // 오류 발생 시 기본 점수 반환
    }
}

// 점수 업데이트 함수
function updateScore(score) {
    // 점수 부드럽게 변경
    currentScore = currentScore * 0.7 + score * 0.3;
    scoreValue.textContent = Math.round(currentScore);
    
    // 메시지 업데이트
    if (currentScore >= 95) {
        message.textContent = '환한 미소가 아름다워요!';
    } else if (currentScore >= 90) {
        message.textContent = '기분 좋은 미소네요!';
    } else if (currentScore >= 85) {
        message.textContent = '살짝 웃고 있네요!';
    } else if (currentScore >= 75) {
        message.textContent = '자연스러운 표정입니다.';
    } else if (currentScore >= 70) {
        message.textContent = '조금 찡그리고 있어요.';
    } else {
        message.textContent = '많이 찡그리고 있어요. 힘내세요!';
    }
}

// 얼굴 감지 시작
async function startFaceDetection() {
    if (!isVideoReady) {
        debugLog('비디오가 준비되지 않았습니다. 대기 중...');
        setTimeout(startFaceDetection, 100);
        return;
    }

    try {
        const detections = await faceapi.detectAllFaces(video, new faceapi.TinyFaceDetectorOptions({
            inputSize: 320,
            scoreThreshold: 0.5
        }))
        .withFaceLandmarks()
        .withFaceExpressions();

        const displaySize = { width: video.videoWidth, height: video.videoHeight };
        const resizedDetections = faceapi.resizeResults(detections, displaySize);

        // 캔버스 초기화
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // 얼굴 감지 결과 그리기
        // faceapi.draw.drawDetections(canvas, resizedDetections);
        // faceapi.draw.drawFaceLandmarks(canvas, resizedDetections);

        if (detections.length > 0) {
            debugLog('얼굴 감지됨');
            const detection = detections[0];
            
            // 입 부분만 그리기
            const mouth = detection.landmarks.getMouth();
            ctx.beginPath();
            ctx.strokeStyle = '#3498db';
            ctx.lineWidth = 1.5;
            ctx.setLineDash([3, 3]); // 점선 패턴 설정
            ctx.moveTo(mouth[0].x, mouth[0].y);
            for (let i = 1; i < mouth.length; i++) {
                ctx.lineTo(mouth[i].x, mouth[i].y);
            }
            ctx.closePath();
            ctx.stroke();
            ctx.setLineDash([]); // 점선 패턴 초기화

            // 눈썹 부분만 그리기
            const leftEyebrow = detection.landmarks.getLeftEyeBrow();
            const rightEyebrow = detection.landmarks.getRightEyeBrow();
            
            // 왼쪽 눈썹
            ctx.beginPath();
            ctx.strokeStyle = '#3498db';
            ctx.lineWidth = 1.5;
            ctx.setLineDash([3, 3]); // 점선 패턴 설정
            ctx.moveTo(leftEyebrow[0].x, leftEyebrow[0].y);
            for (let i = 1; i < leftEyebrow.length; i++) {
                ctx.lineTo(leftEyebrow[i].x, leftEyebrow[i].y);
            }
            ctx.stroke();
            ctx.setLineDash([]); // 점선 패턴 초기화

            // 오른쪽 눈썹
            ctx.beginPath();
            ctx.strokeStyle = '#3498db';
            ctx.lineWidth = 1.5;
            ctx.setLineDash([3, 3]); // 점선 패턴 설정
            ctx.moveTo(rightEyebrow[0].x, rightEyebrow[0].y);
            for (let i = 1; i < rightEyebrow.length; i++) {
                ctx.lineTo(rightEyebrow[i].x, rightEyebrow[i].y);
            }
            ctx.stroke();
            ctx.setLineDash([]); // 점선 패턴 초기화

            const smileScore = calculateSmileScore(detection);
            updateScore(smileScore);
        } else {
            debugLog('얼굴이 감지되지 않음');
        }

        // 다음 프레임 처리
        requestAnimationFrame(startFaceDetection);
    } catch (error) {
        console.error('얼굴 감지 오류:', error);
        setTimeout(startFaceDetection, 100);
    }
}

// 앱 초기화
async function init() {
    // 모델 로드
    const modelsLoaded = await loadModels();
    if (!modelsLoaded) return;

    // 카메라 초기화
    const cameraInitialized = await initCamera();
    if (!cameraInitialized) return;

    // 얼굴 감지 시작
    startFaceDetection();
}

// 앱 시작
init();

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

// 브라우저가 로드되면 앱 초기화
window.addEventListener('load', init); 