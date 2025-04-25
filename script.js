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
    currentScore: 50  // Start at neutral
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
            
            // Set initial score to neutral
            updateScore(50);
        }
    }, 50);
}

// Update score and emoji display
function updateScore(newScore) {
    // Ensure score is between 0 and 100
    newScore = Math.max(0, Math.min(100, newScore));
    expressionState.currentScore = newScore;
    
    // Update score display
    scoreElement.textContent = Math.round(newScore);
    
    // Update emoji based on score
    let emoji, message;
    
    if (newScore >= 80) {
        emoji = emojis.veryHappy;
        message = "환한 미소가 아름다워요! 최고의 웃음이네요!";
    } else if (newScore >= 60) {
        emoji = emojis.happy;
        message = "기분 좋은 미소를 짓고 계시네요!";
    } else if (newScore >= 40) {
        emoji = emojis.neutral;
        message = "자연스러운 표정입니다. 미소를 지어보세요!";
    } else if (newScore >= 20) {
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
        
        // Normalize by eye distance to account for different face sizes and distances
        const normalizedBaseMouthHeight = expressionState.baselineMouthHeight / expressionState.baselineEyeDistance;
        const normalizedBaseMouthWidth = expressionState.baselineMouthWidth / expressionState.baselineEyeDistance;
        
        const normalizedCurrentMouthHeight = currentMouthHeight / currentEyeDistance;
        const normalizedCurrentMouthWidth = currentMouthWidth / currentEyeDistance;
        
        // 개선된 미소 감지 알고리즘
        // 웃을 때는 입 너비가 증가하고 높이는 감소하는 경향이 있음
        const widthFactor = normalizedCurrentMouthWidth / normalizedBaseMouthWidth;
        // 높이 요소 계산 방법 개선 - 찡그림과 웃음을 구별하기 위해 수정
        const heightFactor = normalizedBaseMouthHeight / normalizedCurrentMouthHeight;
        
        // 미소 계수 계산 방법 개선
        // 웃을 때는 widthFactor > 1.0, heightFactor > 1.0 임
        const smileFactor = Math.pow(widthFactor, 0.8) * Math.pow(heightFactor, 0.5);
        
        // 점수 변환 방식 개선
        let newScore;
        if (smileFactor > 1.0) {
            // 웃는 표정: 1.0-1.5 범위를 50-100으로 매핑
            // 더 민감하게 감지하도록 계수 조정
            newScore = 50 + (smileFactor - 1.0) * 120;
        } else {
            // 찡그린 표정: 1.0-0.5 범위를 50-0으로 매핑
            // 찡그림 감지에 덜 민감하게 조정
            newScore = 50 - (1.0 - smileFactor) * 80;
        }
        
        // 점수 변화를 더 부드럽게 함
        const smoothingFactor = 0.15;
        const smoothedScore = expressionState.currentScore * (1 - smoothingFactor) + newScore * smoothingFactor;
        
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

// Initialize the app when the page loads
window.addEventListener('load', init); 