// backend/config/db.js

import mysql from 'mysql2/promise'; // Promise 기반으로 사용하기 위해 'mysql2/promise'를 임포트합니다.
import dotenv from 'dotenv';

dotenv.config(); // .env 파일의 환경 변수 로드

const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',  // MySQL 서버 주소 (WSL2에서 XAMPP 사용 시 localhost)
    user: process.env.DB_USER || 'root',      // MySQL 사용자 이름
    password: process.env.DB_PASSWORD || '',  // MySQL 비밀번호 (XAMPP 기본 root는 비밀번호 없음)
    database: process.env.DB_NAME || 'smart_carwash_db', // 사용할 데이터베이스 이름
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// 데이터베이스 연결 테스트 함수
async function testDbConnection() {
    try {
        const connection = await pool.getConnection();
        console.log('MySQL 데이터베이스에 성공적으로 연결되었습니다!');
        connection.release(); // 연결 해제
    } catch (error) {
        console.error('MySQL 데이터베이스 연결 실패:', error.message);
        // process.exit(1); // 연결 실패 시 서버 종료 (선택 사항)
    }
}

// 서버 시작 시 연결 테스트 실행
testDbConnection(); // <--- 이 부분이 파일 하단에 꼭 있어야 합니다!

export default pool; // 다른 파일에서 사용할 수 있도록 pool 객체를 내보냅니다.