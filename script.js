let video = document.getElementById('video');
let canvas = document.getElementById('canvas');
let scoreElement = document.getElementById('score');
let messageElement = document.getElementById('message');
let net;
let isModelLoaded = false;

// PoseNet 모델 로드
async function loadPoseNet() {
    try {
        messageElement.textContent = '모델을 로딩하는 중...';
        console.log('PoseNet 모델 로드 시작');
        
        // 모델 로드 전에 TensorFlow.js가 준비되었는지 확인
        if (!window.tf) {
            throw new Error('TensorFlow.js가 로드되지 않았습니다.');
        }
        if (!window.posenet) {
            throw new Error('PoseNet이 로드되지 않았습니다.');
        }
        
        console.log('TensorFlow.js와 PoseNet 확인 완료');
        
        // 모델 로드 시도
        console.log('PoseNet 모델 로드 시도...');
        net = await posenet.load({
            architecture: 'MobileNetV1',
            outputStride: 16,
            inputResolution: { width: 640, height: 480 },
            multiplier: 0.75,
            quantBytes: 2
        });
        
        isModelLoaded = true;
        messageElement.textContent = '모델 로딩 완료!';
        console.log('PoseNet 모델 로드 완료');
        
        // 모델 로드 후 포즈 감지 시작
        if (video.readyState >= 2) { // HAVE_CURRENT_DATA
            console.log('비디오가 준비되었으므로 포즈 감지 시작');
            detectPose();
        }
    } catch (error) {
        console.error('모델 로딩 오류:', error);
        messageElement.textContent = '모델 로딩에 실패했습니다.';
    }
}

// 카메라 시작
async function startVideo() {
    try {
        messageElement.textContent = '카메라를 시작하는 중...';
        console.log('카메라 스트림 요청 시작');
        
        const constraints = {
            video: {
                width: { ideal: 640 },
                height: { ideal: 480 },
                facingMode: 'user',
                frameRate: { ideal: 30 }
            }
        };
        
        console.log('카메라 제약 조건:', constraints);
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        
        console.log('카메라 스트림 획득 성공');
        video.srcObject = stream;
        
        video.width = 640;
        video.height = 480;
        
        video.onloadedmetadata = () => {
            console.log('비디오 메타데이터 로드 완료');
            console.log('비디오 크기:', video.videoWidth, 'x', video.videoHeight);
            
            if (video.paused) {
                console.log('비디오가 일시정지 상태입니다. 재생을 시작합니다.');
                video.play().then(() => {
                    console.log('비디오 재생 시작 성공');
                    canvas.width = video.videoWidth;
                    canvas.height = video.videoHeight;
                    messageElement.textContent = '카메라가 준비되었습니다!';
                    
                    // 모델 로드 시작
                    console.log('모델 로드 시작');
                    loadPoseNet();
                }).catch(err => {
                    console.error('비디오 재생 실패:', err);
                    messageElement.textContent = '비디오 재생에 실패했습니다.';
                });
            }
        };

        video.onplay = () => {
            console.log('비디오 재생 시작');
            if (isModelLoaded) {
                console.log('모델이 이미 로드되었으므로 포즈 감지 시작');
                detectPose();
            } else {
                console.log('모델이 아직 로드되지 않았습니다.');
                // 모델 로드 재시도
                loadPoseNet();
            }
        };

        video.onerror = (error) => {
            console.error('비디오 오류:', error);
            messageElement.textContent = '비디오 재생 중 오류가 발생했습니다.';
        };
    } catch (err) {
        console.error('카메라 접근 오류:', err);
        if (err.name === 'NotAllowedError') {
            messageElement.textContent = '카메라 접근 권한이 거부되었습니다.';
        } else if (err.name === 'NotFoundError') {
            messageElement.textContent = '카메라를 찾을 수 없습니다.';
        } else {
            messageElement.textContent = '카메라 오류가 발생했습니다.';
        }
    }
}

// 포즈 감지 및 웃음 분석
async function detectPose() {
    console.log('포즈 감지 시작');
    const ctx = canvas.getContext('2d');
    
    setInterval(async () => {
        try {
            if (!isModelLoaded || !net) {
                console.log('PoseNet 모델이 아직 로드되지 않았습니다.');
                return;
            }
            
            // 포즈 감지 옵션
            const poseEstimationConfig = {
                flipHorizontal: true,
                maxDetections: 1,
                scoreThreshold: 0.5,
                nmsRadius: 20
            };
            
            const pose = await net.estimateSinglePose(video, poseEstimationConfig);
            console.log('포즈 감지 결과:', pose);

            if (pose && pose.keypoints) {
                // 모든 키포인트 확인
                console.log('감지된 키포인트:', pose.keypoints);
                
                // 눈과 코 포인트 찾기 (입꼬리 대신)
                const leftEye = pose.keypoints.find(k => k.part === 'leftEye');
                const rightEye = pose.keypoints.find(k => k.part === 'rightEye');
                const nose = pose.keypoints.find(k => k.part === 'nose');
                
                if (leftEye && rightEye && nose && leftEye.score > 0.5 && rightEye.score > 0.5 && nose.score > 0.5) {
                    // 눈과 코 사이의 거리로 웃음 점수 계산
                    const eyeDistance = Math.sqrt(
                        Math.pow(rightEye.position.x - leftEye.position.x, 2) +
                        Math.pow(rightEye.position.y - leftEye.position.y, 2)
                    );
                    
                    const noseMidEyeY = Math.abs(
                        nose.position.y - (leftEye.position.y + rightEye.position.y) / 2
                    );
                    
                    // 얼굴 비율을 사용한 웃음 점수 계산
                    // 웃을 때는 눈이 작아지고, 코와 눈 사이의 거리가 줄어듦
                    const smileScore = Math.min(100, Math.max(0, 
                        Math.round(60 + (eyeDistance / noseMidEyeY - 1.5) * 40)
                    ));
                    
                    console.log('계산된 웃음 점수:', smileScore);
                    console.log('눈 사이 거리:', eyeDistance);
                    console.log('코-눈 중심 거리:', noseMidEyeY);
                    
                    scoreElement.textContent = smileScore;
                    
                    // 웃음 점수에 따른 메시지
                    if (smileScore >= 80) {
                        messageElement.textContent = '환한 미소예요!';
                    } else if (smileScore >= 60) {
                        messageElement.textContent = '좋은 미소네요!';
                    } else if (smileScore >= 40) {
                        messageElement.textContent = '조금 더 웃어볼까요?';
                    } else {
                        messageElement.textContent = '웃음을 더 넓혀보세요!';
                    }
                } else {
                    messageElement.textContent = '얼굴을 정면으로 보여주세요.';
                }
            } else {
                messageElement.textContent = '얼굴이 인식되지 않았습니다.';
            }
        } catch (error) {
            console.error('포즈 감지 오류:', error);
            messageElement.textContent = '포즈 감지 중 오류가 발생했습니다.';
        }
    }, 500); // 프레임 레이트 낮춤
}

// 페이지 로드 시 시작
window.addEventListener('load', () => {
    console.log('페이지 로드 완료');
    startVideo();
}); 