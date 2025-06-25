// backend/server.js

import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import pool from './config/db.js';
import authRoutes from './routes/auth.js'; // 인증 라우트 임포트

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

// 미들웨어 설정
// CORS 설정: 개발 환경에서 모든 출처 허용 및 필요한 헤더/메서드 허용
app.use(cors({
  origin: '*', // 모든 출처 허용 (개발 환경에서만 사용!)
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'], // 허용할 HTTP 메서드
  allowedHeaders: ['Content-Type', 'Authorization'], // 허용할 요청 헤더
  credentials: true // 자격 증명(쿠키 등)을 요청에 포함할 수 있도록 허용
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 라우트 설정
app.use('/api/auth', authRoutes); // 인증 관련 라우트 연결

// 기본 라우트
app.get('/', (req, res) => {
  res.send('백엔드 서버가 정상적으로 실행 중입니다!');
});

// 서버 시작
app.listen(port, '0.0.0.0', () => {
  console.log(`서버가 http://localhost:${port} 에서 실행 중입니다.`);
  console.log(`환경: ${process.env.NODE_ENV || 'development'}`);
});