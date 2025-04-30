// DOM 요소
const video = document.getElementById('video');
const canvas = document.getElementById('face-points');
const ctx = canvas.getContext('2d');
const scoreValue = document.getElementById('score-value');
const message = document.getElementById('message');
const videoWrapper = document.getElementById('video-wrapper');

// 앱 상태 변수
let isRunning = false;
let currentScore = 80;
let isMobile = window.innerWidth <= 480;

// 창 크기 변경 감지
window.addEventListener('resize', () => {
    isMobile = window.innerWidth <= 480;
    if (video.videoWidth > 0) {
        resizeCanvas();
    }
});

// 캔버스 크기 조정 함수
function resizeCanvas() {
    const wrapperWidth = videoWrapper.clientWidth;
    const wrapperHeight = videoWrapper.clientHeight;
    
    // 비디오 비율 계산
    const videoRatio = video.videoWidth / video.videoHeight;
    const wrapperRatio = wrapperWidth / wrapperHeight;
    
    let canvasWidth, canvasHeight;
    
    if (videoRatio > wrapperRatio) {
        // 비디오가 더 넓은 경우
        canvasHeight = wrapperHeight;
        canvasWidth = wrapperHeight * videoRatio;
    } else {
        // 비디오가 더 좁은 경우
        canvasWidth = wrapperWidth;
        canvasHeight = wrapperWidth / videoRatio;
    }
    
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    
    // 캔버스 위치 조정 (중앙 정렬)
    canvas.style.left = `${(wrapperWidth - canvasWidth) / 2}px`;
    canvas.style.top = `${(wrapperHeight - canvasHeight) / 2}px`;
    
    console.log(`캔버스 크기 조정: ${canvasWidth} x ${canvasHeight}`);
}

// Face-API.js 모델 로드 및 앱 초기화
async function init() {
    try {
        message.innerText = '모델을 로딩하는 중...';
        
        const MODEL_URL = 'https://justadudewhohacks.github.io/face-api.js/models';
        
        // 모델 로드
        await Promise.all([
            faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
            faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL)
        ]);
        
        message.innerText = '카메라 시작 중...';
        
        // 카메라 초기화
        await setupCamera();
        
        // 얼굴 감지 시작
        isRunning = true;
        startFaceDetection();
        
        message.innerText = '얼굴을 카메라에 맞춰주세요';
    } catch (error) {
        console.error('초기화 실패:', error);
        message.innerText = '카메라 접근에 실패했습니다: ' + error.message;
    }
}

// 카메라 설정
async function setupCamera() {
    try {
        // iOS Safari 및 Chrome에서 카메라 접근을 위한 추가 설정
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
        console.log("디바이스 감지:", isIOS ? "iOS 기기" : "iOS 기기 아님");
        
        // iOS 기기를 위한 특별한 제약 조건
        let constraints = {
            video: {
                facingMode: 'user', // 항상 전면 카메라 사용
                width: { ideal: isMobile ? 480 : 640 },
                height: { ideal: isMobile ? 640 : 480 }
            },
            audio: false
        };
        
        // iOS Chrome에서는 추가 설정 필요
        if (isIOS && /CriOS|Chrome/.test(navigator.userAgent)) {
            console.log("iOS Chrome 감지됨, 특수 설정 적용");
            constraints.video = {
                facingMode: 'user',
                width: { min: 320, ideal: 640, max: 1280 },
                height: { min: 240, ideal: 480, max: 720 }
            };
        }
        
        console.log("적용된 카메라 제약 조건:", JSON.stringify(constraints));
        message.innerText = '카메라 권한을 허용해주세요...';
        
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        video.srcObject = stream;
        
        // iOS에서의 추가 설정
        video.setAttribute('playsinline', true); // iOS에서 인라인 재생 허용
        video.setAttribute('autoplay', true);    // 자동 재생 활성화
        video.muted = true;                      // 음소거 (자동 재생 요구사항)
        
        // 비디오 스타일 설정
        video.style.width = '100%';
        video.style.height = '100%';
        video.style.objectFit = 'cover';
        
        // 비디오 wrapper 스타일 설정
        videoWrapper.style.width = isMobile ? '100%' : '640px';
        videoWrapper.style.height = isMobile ? '100%' : '480px';
        videoWrapper.style.position = 'relative';
        videoWrapper.style.overflow = 'hidden';
        videoWrapper.style.margin = '0 auto';
        
        // 캔버스 스타일 설정
        canvas.style.position = 'absolute';
        canvas.style.top = '0';
        canvas.style.left = '0';
        canvas.style.width = '100%';
        canvas.style.height = '100%';
        
        return new Promise((resolve) => {
            video.onloadedmetadata = () => {
                console.log("비디오 메타데이터 로드됨, 크기:", video.videoWidth, "x", video.videoHeight);
                resizeCanvas();
                
                // iOS 디바이스에서 비디오 재생 처리를 다르게 함
                if (isIOS) {
                    console.log("iOS 디바이스에서 비디오 재생 시도");
                    video.play()
                        .then(() => {
                            console.log("iOS에서 비디오 재생 성공");
                            // iOS에서 비디오가 정상적으로 재생되는지 확인
                            setTimeout(() => {
                                if (video.paused) {
                                    console.warn("iOS 비디오가 자동으로 일시 중지됨, 다시 재생 시도");
                                    video.play()
                                        .then(() => resolve())
                                        .catch(e => {
                                            console.error("iOS 재재생 실패:", e);
                                            message.innerText = "iOS에서 비디오 재생에 실패했습니다. 페이지를 새로고침해주세요.";
                                            resolve();
                                        });
                                } else {
                                    resolve();
                                }
                            }, 1000);
                        })
                        .catch(err => {
                            console.error("iOS 비디오 재생 실패:", err);
                            message.innerText = "iOS에서 카메라 재생에 실패했습니다. 설정에서 카메라 접근을 허용해주세요.";
                            resolve();
                        });
                } else {
                    // 다른 디바이스에서는 기존 방식으로 처리
                    video.play()
                        .then(() => {
                            console.log("비디오 재생 시작");
                            resolve();
                        })
                        .catch(err => {
                            console.error("비디오 재생 실패:", err);
                            message.innerText = "비디오 재생에 실패했습니다. 카메라 권한을 확인해주세요.";
                            resolve();
                        });
                }
            };
            
            video.onerror = (err) => {
                console.error("비디오 요소 오류:", err);
                message.innerText = "비디오 로드 중 오류가 발생했습니다";
                resolve();
            };
        });
    } catch (error) {
        console.error("카메라 액세스 오류:", error);
        if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
            throw new Error('카메라 권한이 거부되었습니다. 브라우저 설정에서 카메라 접근을 허용해주세요.');
        } else if (error.name === 'NotFoundError') {
            throw new Error('카메라를 찾을 수 없습니다. 카메라가 연결되어 있는지 확인해주세요.');
        } else if (error.name === 'NotSupportedError') {
            throw new Error('브라우저가 미디어 장치 기능을 지원하지 않습니다. 다른 브라우저를 사용해보세요.');
        } else if (error.name === 'AbortError') {
            throw new Error('카메라 시작이 중단되었습니다. 다시 시도해주세요.');
        } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
            throw new Error('카메라에 접근할 수 없습니다. 다른 앱이 카메라를 사용 중일 수 있습니다.');
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
        const detections = await faceapi.detectSingleFace(
            video, 
            new faceapi.TinyFaceDetectorOptions({
                inputSize: isMobile ? 224 : 320,
                scoreThreshold: 0.5
            })
        ).withFaceLandmarks();
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        if (detections) {
            const displaySize = { width: canvas.width, height: canvas.height };
            const resizedDetections = faceapi.resizeResults(detections, displaySize);
            
            analyzeSmile(resizedDetections);
        } else {
            message.innerText = '얼굴이 감지되지 않았습니다';
        }
        
        requestAnimationFrame(detectFace);
    } catch (error) {
        console.error('얼굴 감지 오류:', error);
        message.innerText = '얼굴 감지 중 오류가 발생했습니다';
        setTimeout(() => {
            if (isRunning) detectFace();
        }, 2000); // 에러 발생 시 2초 후 재시도
    }
}

// 얼굴 랜드마크 그리기 - 현재 사용하지 않음.
// function drawLandmarks(detections) {
//     // 얼굴 윤곽선 그리기
//     ctx.beginPath();
//     ctx.strokeStyle = '#3498db';
//     ctx.lineWidth = 2;
    
//     // 입 부분만 강조해서 그리기
//     const mouth = detections.landmarks.getMouth();
//     ctx.moveTo(mouth[0].x, mouth[0].y);
//     for (let i = 1; i < mouth.length; i++) {
//         ctx.lineTo(mouth[i].x, mouth[i].y);
//     }
//     ctx.closePath();
//     ctx.stroke();
    
//     // 눈썹과 눈도 간단히 표시
//     const leftEye = detections.landmarks.getLeftEye();
//     const rightEye = detections.landmarks.getRightEye();
//     const leftEyebrow = detections.landmarks.getLeftEyeBrow();
//     const rightEyebrow = detections.landmarks.getRightEyeBrow();
    
//     drawPoints(leftEye, 2, '#3498db');
//     drawPoints(rightEye, 2, '#3498db');
//     drawPoints(leftEyebrow, 2, '#3498db');
//     drawPoints(rightEyebrow, 2, '#3498db');
// }

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
    const topLip = mouth[14];    // 윗입술 중앙
    const bottomLip = mouth[18]; // 아랫입술 중앙
    const leftCorner = mouth[0]; // 왼쪽 입꼬리
    const rightCorner = mouth[6];// 오른쪽 입꼬리
    
    // 입 크기 계산
    const mouthHeight = Math.abs(bottomLip.y - topLip.y);
    const mouthWidth = Math.abs(rightCorner.x - leftCorner.x);
    const mouthRatio = mouthWidth / mouthHeight;
    
    // 입꼬리 위치 분석 (U자형 vs 역U자형)
    const lipCenter = (topLip.y + bottomLip.y) / 2;
    const cornerHeight = (leftCorner.y + rightCorner.y) / 2;
    const lipCurve = (lipCenter - cornerHeight) / mouthHeight; // 정규화된 곡률

    // 입술 두께 변화 감지 (찡그림 시 입술이 얇아짐)
    const lipThickness = mouthHeight / mouthWidth;

    // 디버깅 정보 출력
    console.log('입 비율:', mouthRatio.toFixed(2));
    console.log('입꼬리 곡률:', lipCurve.toFixed(2));
    console.log('입술 두께:', lipThickness.toFixed(2));

    // 점수 계산
    let baseScore = 80; // 기본 점수
    let smileScore = baseScore;
    let scoreAdjustment = 0;

    // 웃는 표정 (U자형, 입꼬리가 올라감)
    if (lipCurve > 0) {
        if (lipCurve > 0.4 && mouthRatio > 2.0) {
            scoreAdjustment = 15; // 활짝 웃는 얼굴 (95점)
        }
        else if (lipCurve > 0.25 && mouthRatio > 1.7) {
            scoreAdjustment = 10; // 기분 좋게 웃는 얼굴 (90점)
        }
        else if (lipCurve > 0.1) {
            scoreAdjustment = 5;  // 살짝 웃는 얼굴 (85점)
        }
    }
    // 찡그린 표정 (역U자형, 입꼬리가 내려감)
    else {
        if (lipCurve < -0.2 && (mouthRatio < 1.3 || lipThickness < 0.3)) {
            scoreAdjustment = -20; // 많이 찡그린 얼굴 (60점)
        }
        else if (lipCurve < -0.15 && mouthRatio < 1.5) {
            scoreAdjustment = -15; // 조금 찡그린 얼굴 (65점)
        }
        else if (lipCurve < -0.1) {
            scoreAdjustment = -10; // 살짝 찡그린 얼굴 (70점)
        }
        else if (lipCurve < -0.05) {
            scoreAdjustment = -5;  // 아주 살짝 찡그린 얼굴 (75점)
        }
    }

    // 최종 점수 계산
    smileScore = Math.max(60, Math.min(95, baseScore + scoreAdjustment));

    // 점수 변화를 더 민감하게 조정 (이전 가중치 조정)
    currentScore = currentScore * 0.5 + smileScore * 0.5;
    
    // 점수 표시 업데이트
    scoreValue.style.fontWeight = 'bold';
    scoreValue.style.color = '#3498db';  // 항상 파란색으로 표시
    scoreValue.innerText = Math.round(currentScore);
    
    // 메시지 업데이트
    updateMessage(currentScore);
}

// 점수에 따른 메시지 업데이트
function updateMessage(score) {
    const roundedScore = Math.round(score);
    message.style.fontWeight = 'bold';
    message.style.color = '#3498db';  // 메시지도 파란색으로 통일
    
    if (roundedScore >= 95) {
        message.innerText = '활짝 웃는 얼굴이에요! 😊';
    } else if (roundedScore >= 90) {
        message.innerText = '기분 좋게 웃고 있어요! 😄';
    } else if (roundedScore >= 85) {
        message.innerText = '살짝 웃고 있네요! 🙂';
    } else if (roundedScore >= 80) {
        message.innerText = '자연스러운 표정이에요. 😌';
    } else if (roundedScore >= 75) {
        message.innerText = '살짝 찡그리고 있어요. 😕';
    } else if (roundedScore >= 70) {
        message.innerText = '조금 찡그리고 있어요. 😣';
    } else if (roundedScore >= 65) {
        message.innerText = '많이 찡그리고 있어요. 😖';
    } else {
        message.innerText = '너무 찡그리고 있어요! 힘내세요! 😫';
    }
}

// 브라우저가 로드되면 앱 초기화
window.addEventListener('load', init); 