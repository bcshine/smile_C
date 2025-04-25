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
    currentScore: 98  // Start at neutral
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
            
            // 초기 점수를 98점(보통)으로 설정
            updateScore(98);
        }
    }, 50);
}

// Update score and emoji display
function updateScore(newScore) {
    // Ensure score is between 0 and 100
    newScore = Math.max(76, Math.min(100, newScore));
    expressionState.currentScore = newScore;
    
    // Update score display
    scoreElement.textContent = Math.round(newScore);
    
    // Update emoji based on score
    let emoji, message;
    
    if (newScore >= 95) {
        emoji = emojis.veryHappy;
        message = "환한 미소가 아름다워요! 최고의 웃음이네요!";
    } else if (newScore >= 90) {
        emoji = emojis.happy;
        message = "기분 좋은 미소를 짓고 계시네요!";
    } else if (newScore >= 85) {
        emoji = emojis.neutral;
        message = "자연스러운 표정입니다. 미소를 지어보세요!";
    } else if (newScore >= 80) {
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
        
        // 찡그림과 웃음 감지 알고리즘 재설계
        const widthFactor = normalizedCurrentMouthWidth / normalizedBaseMouthWidth;
        const heightFactor = normalizedCurrentMouthHeight / normalizedBaseMouthHeight;
        
        // 디버깅: 모든 값을 콘솔에 출력
        console.log("표정 분석 원시값:", {
            widthFactor,
            heightFactor,
            normalizedBaseMouthWidth,
            normalizedCurrentMouthWidth,
            normalizedBaseMouthHeight,
            normalizedCurrentMouthHeight
        });
        
        // 찡그림/웃음 감지를 위한 보정된 수치 계산
        // 찡그림: 입 너비 감소 + 입 높이 증가 = 음수 값
        // 웃음: 입 너비 증가 + 입 높이 감소 = 양수 값
        const expressionValue = 2.0 * (widthFactor - 1.0) - 1.0 * (heightFactor - 1.0);
        console.log("표정 계수: ", expressionValue);
        
        // 강제로 입력값을 증폭시켜 작은 변화도 점수에 큰 영향을 미치게 함
        const amplifiedExpression = Math.sign(expressionValue) * Math.pow(Math.abs(expressionValue), 2) * 50;
        console.log("증폭된 표정 계수: ", amplifiedExpression);
        
        // 점수 계산 (기본 85점에 표정 계수 적용)
        let newScore = 85 + amplifiedExpression;
        
        // 찡그림 감지 강화
        if (expressionValue < -0.01) {  // 매우 작은 음수도 찡그림으로 인식
            // 찡그림 정도에 따라 점수 감소 (최대 20점 감소)
            const frownFactor = Math.abs(expressionValue) * 300;
            newScore = Math.max(76, 85 - frownFactor);
            console.log("찡그림 감지: ", frownFactor, "새 점수:", newScore);
        } 
        // 웃음 감지 강화
        else if (expressionValue > 0.01) {  // 매우 작은 양수도 웃음으로 인식
            // 웃는 정도에 따라 점수 증가 (최대 100점)
            const smileFactor = expressionValue * 150;
            newScore = Math.min(100, 90 + smileFactor);
            console.log("웃음 감지: ", smileFactor, "새 점수:", newScore);
        }
        else {
            // 중립 표정 (85-90점)
            newScore = 85;
            console.log("중립 표정 감지, 점수:", newScore);
        }
        
        // 점수 범위 제한
        newScore = Math.max(76, Math.min(100, newScore));
        
        // 즉각적인 반응을 위해 스무딩 최소화
        const smoothingFactor = 0.8; // 80% 즉시 반영
        const smoothedScore = expressionState.currentScore * (1 - smoothingFactor) + newScore * smoothingFactor;
        
        // 현재 점수와 새로운 점수를 출력하여 변화를 확인
        console.log("현재 점수:", expressionState.currentScore, "새 점수:", newScore, "보정된 점수:", smoothedScore);
        
        updateScore(smoothedScore);
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
        currentScore: 98  // 기본 점수로 초기화 (10점 상향)
    };
    
    // 버튼 및 메시지 상태 초기화
    startButton.disabled = false;
    startButton.classList.remove('hidden');
    resetButton.classList.add('hidden');
    statusElement.textContent = "모델 로딩 완료! 카메라를 시작해주세요.";
    statusElement.classList.remove('hidden');
    calibrationElement.classList.remove('active');
    
    // 점수와 이모지 초기화
    updateScore(98);
    messageElement.textContent = "시작 버튼을 눌러 측정을 시작하세요.";
}

// Initialize the app when the page loads
window.addEventListener('load', init); 