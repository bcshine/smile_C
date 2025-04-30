// 간단한 HTTP 서버 스크립트
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;

const MIME_TYPES = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.gif': 'image/gif',
    '.ico': 'image/x-icon',
};

const server = http.createServer((req, res) => {
    console.log(`요청: ${req.method} ${req.url}`);
    
    // URL에서 쿼리 파라미터 제거
    let filePath = '.' + req.url.split('?')[0];
    
    // 루트 경로인 경우 기본 페이지로 설정
    if (filePath === './') {
        filePath = './fcm-test.html';
    }
    
    // 파일 확장자 가져오기
    const extname = String(path.extname(filePath)).toLowerCase();
    const contentType = MIME_TYPES[extname] || 'application/octet-stream';
    
    // 파일 읽기
    fs.readFile(filePath, (error, content) => {
        if (error) {
            if (error.code === 'ENOENT') {
                // 파일이 없는 경우
                res.writeHead(404);
                res.end(`파일을 찾을 수 없습니다: ${filePath}`);
            } else {
                // 서버 오류
                res.writeHead(500);
                res.end(`서버 오류: ${error.code}`);
            }
        } else {
            // 성공
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
});

server.listen(PORT, () => {
    console.log(`서버가 포트 ${PORT}에서 실행 중입니다.`);
    console.log(`웹 브라우저에서 http://localhost:${PORT}/ 주소로 접속하세요.`);
}); 