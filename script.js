// Emoji mapping for different expressions
const emojis = {
    veryHappy: "😄", // 80-100
    happy: "🙂",     // 60-79
    neutral: "😐",   // 40-59
    sad: "🙁",       // 20-39
    verySad: "😣"    // 0-19
};

// DOM elements
const videoElement = document.getElementById('video');
const canvasElement = document.getElementById('canvas');
const ctx = canvasElement.getContext('2d');
const startButton = document.getElementById('startButton');
const resetButton = document.getElementById('resetButton');
const statusElement = document.getElementById('status');
const scoreElement = document.getElementById('score');
const emojiElement = document.getElementById('emoji');
const messageElement = document.getElementById('message');
const calibrationElement = document.getElementById('calibration');

// App state
let net;
let video;
let expressionState = {
    calibrated: false,
    baselineEyeDistance: 0,
    baselineMouthHeight: 0,
    baselineMouthWidth: 0,
    currentScore: 88  // Start at neutral
};

// Initialize the application
async function init() {
    try {
        net = await posenet.load({
            architecture: 'MobileNetV1',
            outputStride: 16,
            inputResolution: { width: 640, height: 480 },
            multiplier: 0.75
        });
        
        statusElement.textContent = "모델 로딩 완료! 카메라를 시작해주세요.";
        startButton.disabled = false;
    } catch (error) {
        console.error('PoseNet 모델을 불러오는데 실패했습니다:', error);
        statusElement.textContent = "오류: 모델을 불러오는데 실패했습니다.";
    }
}

// Start video capture
startButton.addEventListener('click', async () => {
    try {
        video = await setupCamera();
        video.play();
        startButton.classList.add('hidden');
        resetButton.classList.remove('hidden');
        statusElement.classList.add('hidden');
        videoElement.style.display = 'block';
        
        // Set canvas dimensions to match video
        canvasElement.width = video.videoWidth;
        canvasElement.height = video.videoHeight;
        
        // Start calibration
        startCalibration();
        
        // Start pose detection
        detectPoseInRealTime();
    } catch (error) {
        console.error('카메라를 설정하는데 실패했습니다:', error);
        statusElement.textContent = "오류: 카메라에 접근할 수 없습니다.";
        statusElement.classList.remove('hidden');
    }
});

// 다시 하기 버튼 이벤트 처리
resetButton.addEventListener('click', resetApp);

// Set up the camera
async function setupCamera() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('getUserMedia를 지원하지 않는 브라우저입니다');
    }
    
    const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
            facingMode: 'user',
            width: { ideal: 640 },
            height: { ideal: 480 }
        }
    });
    
    videoElement.srcObject = stream;
    
    return new Promise((resolve) => {
        videoElement.onloadedmetadata = () => {
            resolve(videoElement);
        };
    });
}

// Start calibration process
function startCalibration() {
    calibrationElement.classList.add('active');
    messageElement.textContent = "캘리브레이션 중... 정면을 바라보고 자연스러운 표정을 유지해주세요.";
    
    let calibrationFrames = 0;
    let eyeDistanceSum = 0;
    let mouthHeightSum = 0;
    let mouthWidthSum = 0;
    
    // Collect data for 3 seconds (assuming 60fps, so ~180 frames)
    const calibrationInterval = setInterval(async () => {
        const pose = await detectPose();
        
        if (pose) {
            const { leftEye, rightEye, leftMouth, rightMouth, topMouth, bottomMouth } = extractFacialKeypoints(pose);
            
            if (leftEye && rightEye && leftMouth && rightMouth && topMouth && bottomMouth) {
                // Calculate eye distance
                const eyeDistance = Math.sqrt(
                    Math.pow(leftEye.position.x - rightEye.position.x, 2) + 
                    Math.pow(leftEye.position.y - rightEye.position.y, 2)
                );
                
                // Calculate mouth height
                const mouthHeight = Math.sqrt(
                    Math.pow(topMouth.position.x - bottomMouth.position.x, 2) + 
                    Math.pow(topMouth.position.y - bottomMouth.position.y, 2)
                );
                
                // Calculate mouth width
                const mouthWidth = Math.sqrt(
                    Math.pow(leftMouth.position.x - rightMouth.position.x, 2) + 
                    Math.pow(leftMouth.position.y - rightMouth.position.y, 2)
                );
                
                eyeDistanceSum += eyeDistance;
                mouthHeightSum += mouthHeight;
                mouthWidthSum += mouthWidth;
                calibrationFrames++;
            }
        }
        
        // After 3 seconds, calculate average values
        if (calibrationFrames >= 60) {
            clearInterval(calibrationInterval);
            expressionState.baselineEyeDistance = eyeDistanceSum / calibrationFrames;
            expressionState.baselineMouthHeight = mouthHeightSum / calibrationFrames;
            expressionState.baselineMouthWidth = mouthWidthSum / calibrationFrames;
            expressionState.calibrated = true;
            
            calibrationElement.classList.remove('active');
            messageElement.textContent = "캘리브레이션 완료! 이제 다양한 표정을 지어보세요.";
            
            // 초기 점수를 80점(보통)으로 설정
            updateScore(80);
        }
    }, 50);
}

// Update score and emoji display
function updateScore(newScore) {
    // Ensure score is between 0 and 100
    newScore = Math.max(66, Math.min(100, newScore));
    expressionState.currentScore = newScore;
    
    // Update score display
    scoreElement.textContent = Math.round(newScore);
    
    // Update emoji based on score
    let emoji, message;
    
    if (newScore >= 99) {
        emoji = emojis.veryHappy;
        message = "환한 미소가 아름다워요! 최고의 웃음이네요!";
    } else if (newScore >= 95) {
        emoji = emojis.happy;
        message = "기분 좋은 미소를 짓고 계시네요!";
    } else if (newScore >= 88) {
        emoji = emojis.neutral;
        message = "자연스러운 표정입니다. 미소를 지어보세요!";
    } else if (newScore >= 77) {
        emoji = emojis.sad;
        message = "조금 찡그린 표정이에요. 기분이 안 좋으신가요?";
    } else {
        emoji = emojis.verySad;
        message = "많이 찡그리고 계세요! 힘내세요!";
    }
    
    emojiElement.textContent = emoji;
    messageElement.textContent = message;
}

// Extract facial keypoints from pose
function extractFacialKeypoints(pose) {
    const keypoints = pose.keypoints;
    const leftEye = keypoints.find(k => k.part === 'leftEye');
    const rightEye = keypoints.find(k => k.part === 'rightEye');
    const nose = keypoints.find(k => k.part === 'nose');
    
    // PoseNet doesn't provide mouth keypoints directly, so we'll estimate them
    // based on nose and eye positions
    let leftMouth, rightMouth, topMouth, bottomMouth;
    
    if (leftEye && rightEye && nose) {
        const eyeMidpointX = (leftEye.position.x + rightEye.position.x) / 2;
        const eyeMidpointY = (leftEye.position.y + rightEye.position.y) / 2;
        
        // Estimate mouth position based on the eyes and nose
        const mouthCenterX = nose.position.x;
        const mouthCenterY = nose.position.y + (nose.position.y - eyeMidpointY) * 0.7;
        
        const eyeDistance = Math.sqrt(
            Math.pow(leftEye.position.x - rightEye.position.x, 2) + 
            Math.pow(leftEye.position.y - rightEye.position.y, 2)
        );
        
        const mouthWidth = eyeDistance * 0.8;
        const mouthHeight = eyeDistance * 0.3;
        
        leftMouth = {
            part: 'leftMouth',
            position: {
                x: mouthCenterX - mouthWidth / 2,
                y: mouthCenterY
            }
        };
        
        rightMouth = {
            part: 'rightMouth',
            position: {
                x: mouthCenterX + mouthWidth / 2,
                y: mouthCenterY
            }
        };
        
        topMouth = {
            part: 'topMouth',
            position: {
                x: mouthCenterX,
                y: mouthCenterY - mouthHeight / 2
            }
        };
        
        bottomMouth = {
            part: 'bottomMouth',
            position: {
                x: mouthCenterX,
                y: mouthCenterY + mouthHeight / 2
            }
        };
    }
    
    return { leftEye, rightEye, nose, leftMouth, rightMouth, topMouth, bottomMouth };
}

// Detect pose from video frame
async function detectPose() {
    if (!video) return null;
    
    const pose = await net.estimateSinglePose(video, {
        flipHorizontal: false
    });
    
    return pose;
}

// Detect pose in real-time
async function detectPoseInRealTime() {
    async function frameLoop() {
        // Draw video frame on canvas
        ctx.clearRect(0, 0, canvasElement.width, canvasElement.height);
        ctx.drawImage(video, 0, 0, canvasElement.width, canvasElement.height);
        
        // Detect pose
        const pose = await detectPose();
        
        if (pose) {
            drawKeypoints(pose);
            
            // If calibration is complete, analyze expression
            if (expressionState.calibrated) {
                analyzeExpression(pose);
            }
        }
        
        requestAnimationFrame(frameLoop);
    }
    
    frameLoop();
}

// Analyze facial expression to determine score
function analyzeExpression(pose) {
    const { leftEye, rightEye, leftMouth, rightMouth, topMouth, bottomMouth } = extractFacialKeypoints(pose);
    
    if (leftEye && rightEye && leftMouth && rightMouth && topMouth && bottomMouth) {
        // Current measurements
        const currentEyeDistance = Math.sqrt(
            Math.pow(leftEye.position.x - rightEye.position.x, 2) + 
            Math.pow(leftEye.position.y - rightEye.position.y, 2)
        );
        
        const currentMouthHeight = Math.sqrt(
            Math.pow(topMouth.position.x - bottomMouth.position.x, 2) + 
            Math.pow(topMouth.position.y - bottomMouth.position.y, 2)
        );
        
        const currentMouthWidth = Math.sqrt(
            Math.pow(leftMouth.position.x - rightMouth.position.x, 2) + 
            Math.pow(leftMouth.position.y - rightMouth.position.y, 2)
        );
        
        // 값이 유효한지 확인
        if (currentEyeDistance <= 0 || 
            expressionState.baselineEyeDistance <= 0 || 
            currentMouthHeight <= 0 || 
            expressionState.baselineMouthHeight <= 0 ||
            currentMouthWidth <= 0 ||
            expressionState.baselineMouthWidth <= 0) {
            console.log("유효하지 않은 측정값 감지됨:", {
                currentEyeDistance,
                baselineEyeDistance: expressionState.baselineEyeDistance,
                currentMouthHeight,
                baselineMouthHeight: expressionState.baselineMouthHeight,
                currentMouthWidth,
                baselineMouthWidth: expressionState.baselineMouthWidth
            });
            return; // 유효하지 않은 값이 있으면 계산하지 않음
        }
        
        // Normalize by eye distance to account for different face sizes and distances
        const normalizedBaseMouthHeight = expressionState.baselineMouthHeight / expressionState.baselineEyeDistance;
        const normalizedBaseMouthWidth = expressionState.baselineMouthWidth / expressionState.baselineEyeDistance;
        
        const normalizedCurrentMouthHeight = currentMouthHeight / currentEyeDistance;
        const normalizedCurrentMouthWidth = currentMouthWidth / currentEyeDistance;
        
        // 개선된 미소 감지 알고리즘
        const widthFactor = normalizedCurrentMouthWidth / normalizedBaseMouthWidth;
        const heightFactor = normalizedCurrentMouthHeight / normalizedBaseMouthHeight;
        
        // console로 값 확인
        console.log("표정 분석 값:", {
            widthFactor,
            heightFactor,
            normalizedBaseMouthWidth,
            normalizedCurrentMouthWidth,
            normalizedBaseMouthHeight,
            normalizedCurrentMouthHeight
        });
        
        // 점수 계산 - 새로운 점수 체계 적용 (기본값 88점, 10% 증가)
        let newScore = 88; // 기본 점수 - 평균적인 표정 (80 + 10% = 88)
        
        if (!isNaN(widthFactor) && !isNaN(heightFactor)) {
            // 웃는 정도 계산 (미소 지수)
            let smileIndex = 0;
            
            // 입 너비 변화로 미소 감지 (가장 중요한 요소)
            if (widthFactor > 1.05) {
                // 입이 크게 벌어지면 활짝 웃는 것으로 간주
                smileIndex += (widthFactor - 1.0) * 22; // 20 + 10%
            } else if (widthFactor < 0.95) {
                // 입이 좁아지면 찡그린 것으로 간주
                smileIndex -= (1.0 - widthFactor) * 16.5; // 15 + 10%
            }
            
            // 입 높이 변화로 보조 판단
            // 웃을 때는 일반적으로 입 높이가 낮아짐
            if (heightFactor < 0.95 && widthFactor > 1.0) {
                // 입 너비는 넓어지고 높이가 낮아지면 웃는 것
                smileIndex += (1.0 - heightFactor) * 11; // 10 + 10%
            } else if (heightFactor > 1.1 && widthFactor < 1.0) {
                // 입 너비는 좁아지고 높이가 높아지면 찡그린 것
                smileIndex -= (heightFactor - 1.0) * 5.5; // 5 + 10%
            }
            
            // 최종 점수 계산
            if (smileIndex > 0) {
                // 웃는 표정 (88점 이상)
                // 활짝 웃는 경우 (smileIndex > 1.5) 99점 이상
                // 조금 웃는 경우 (smileIndex > 0.5) 99점까지
                if (smileIndex > 1.5) {
                    newScore = Math.min(100, 99 + Math.min(1, smileIndex - 1.5));
                } else if (smileIndex > 0.5) {
                    newScore = 99 * Math.min(1, (smileIndex - 0.5) * 0.2);
                } else {
                    newScore = 88 + smileIndex * 22; // 20 + 10%
                }
            } else if (smileIndex < 0) {
                // 찡그린 표정 (88점 미만)
                // 조금 찡그린 경우 77점 (70 + 10%)
                // 많이 찡그린 경우 66점 (60 + 10%)
                if (smileIndex < -1.0) {
                    newScore = 66;
                } else {
                    newScore = 88 + smileIndex * 11; // -1.0이면 77점
                }
            }
            
            // 점수 범위 제한 (66-100)
            newScore = Math.max(66, Math.min(100, newScore));
            
            // 부드러운 변화를 위한 스무딩
            const smoothingFactor = 0.25; // 더 빠르게 반응하도록 추가 조정
            const smoothedScore = expressionState.currentScore * (1 - smoothingFactor) + newScore * smoothingFactor;
            
            updateScore(smoothedScore);
        } else {
            console.error("유효하지 않은 계산 결과:", { widthFactor, heightFactor });
        }
    }
}

// Draw keypoints on canvas
function drawKeypoints(pose) {
    const keypoints = pose.keypoints;
    
    // Only draw facial keypoints
    const facialKeypoints = keypoints.filter(keypoint => 
        keypoint.part === 'nose' || 
        keypoint.part === 'leftEye' || 
        keypoint.part === 'rightEye' || 
        keypoint.part === 'leftEar' || 
        keypoint.part === 'rightEar'
    );
    
    // Set drawing style
    ctx.fillStyle = 'aqua';
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 2;
    
    // Draw each keypoint
    facialKeypoints.forEach(keypoint => {
        if (keypoint.score > 0.5) {
            ctx.beginPath();
            ctx.arc(keypoint.position.x, keypoint.position.y, 5, 0, 2 * Math.PI);
            ctx.fill();
            ctx.stroke();
        }
    });
    
    // Draw estimated mouth points
    const { leftMouth, rightMouth, topMouth, bottomMouth } = extractFacialKeypoints(pose);
    
    if (leftMouth && rightMouth && topMouth && bottomMouth) {
        ctx.fillStyle = 'yellow';
        
        // Draw mouth corners
        ctx.beginPath();
        ctx.arc(leftMouth.position.x, leftMouth.position.y, 3, 0, 2 * Math.PI);
        ctx.fill();
        ctx.stroke();
        
        ctx.beginPath();
        ctx.arc(rightMouth.position.x, rightMouth.position.y, 3, 0, 2 * Math.PI);
        ctx.fill();
        ctx.stroke();
        
        // Draw mouth top and bottom
        ctx.beginPath();
        ctx.arc(topMouth.position.x, topMouth.position.y, 3, 0, 2 * Math.PI);
        ctx.fill();
        ctx.stroke();
        
        ctx.beginPath();
        ctx.arc(bottomMouth.position.x, bottomMouth.position.y, 3, 0, 2 * Math.PI);
        ctx.fill();
        ctx.stroke();
        
        // Draw mouth outline
        ctx.beginPath();
        ctx.moveTo(leftMouth.position.x, leftMouth.position.y);
        ctx.quadraticCurveTo(
            (leftMouth.position.x + rightMouth.position.x) / 2,
            bottomMouth.position.y,
            rightMouth.position.x, rightMouth.position.y
        );
        ctx.quadraticCurveTo(
            (leftMouth.position.x + rightMouth.position.x) / 2,
            topMouth.position.y,
            leftMouth.position.x, leftMouth.position.y
        );
        ctx.stroke();
    }
}

// 앱 초기화 함수
function resetApp() {
    // 비디오 스트림 중지
    if (video && video.srcObject) {
        const tracks = video.srcObject.getTracks();
        tracks.forEach(track => track.stop());
    }
    
    // 화면 초기화
    videoElement.style.display = 'none';
    videoElement.srcObject = null;
    ctx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    
    // 상태 초기화
    expressionState = {
        calibrated: false,
        baselineEyeDistance: 0,
        baselineMouthHeight: 0,
        baselineMouthWidth: 0,
        currentScore: 88  // 기본 점수로 초기화
    };
    
    // 버튼 및 메시지 상태 초기화
    startButton.disabled = false;
    startButton.classList.remove('hidden');
    resetButton.classList.add('hidden');
    statusElement.textContent = "모델 로딩 완료! 카메라를 시작해주세요.";
    statusElement.classList.remove('hidden');
    calibrationElement.classList.remove('active');
    
    // 점수와 이모지 초기화
    updateScore(88);
    messageElement.textContent = "시작 버튼을 눌러 측정을 시작하세요.";
}

// Initialize the app when the page loads
window.addEventListener('load', init); 