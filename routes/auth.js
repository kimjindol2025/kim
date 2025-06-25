// backend/routes/auth.js

import express from 'express';
import bcrypt from 'bcryptjs'; // 비밀번호 암호화용
import jwt from 'jsonwebtoken'; // JWT 토큰 생성용
import pool from '../config/db.js'; // 데이터베이스 연결 풀 임포트 (상위 폴더의 config 폴더)
import nodemailer from 'nodemailer'; // 이메일 발송용

const router = express.Router(); // Express 라우터 생성

// 이메일 발송을 위한 Nodemailer 트랜스포터 설정 (실제 정보로 변경 필요!)
const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    secure: process.env.EMAIL_SECURE === 'true', // true for 465, false for other ports
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

// 환경 변수에서 JWT 비밀 키 로드
const jwtSecret = process.env.JWT_SECRET || 'your_jwt_secret_key'; // 실제 배포 시에는 반드시 강력한 키 사용!

// JWT 토큰 유효 기간 (예: 1시간)
const jwtExpiresIn = '1h';

// 회원가입 API 엔드포인트
router.post('/register', async (req, res) => {
    const { username, password, role, business_id, name, phone_number } = req.body; // 요청 본문에서 데이터 추출

    // 1단계: 필수 입력값 유효성 검사 (아주 기본적인 검사)
    if (!username || !password || !role) {
        return res.status(400).json({ message: '모든 필수 필드를 입력해주세요.' });
    }

    try {
        // 비밀번호 암호화 (해싱)
        const salt = await bcrypt.genSalt(10); // 솔트 생성 (보안 강화)
        const password_hash = await bcrypt.hash(password, salt); // 비밀번호 해싱

        let conn;
        try {
            conn = await pool.getConnection(); // DB 연결 가져오기
            await conn.beginTransaction(); // 트랜잭션 시작

            // 사용자 유형에 따른 데이터 유효성 및 저장 로직 (현재는 기본값, 나중에 상세화)
            let insertQuery = '';
            let insertValues = [];
            let businessUniqueNumber = null; // 사업주인 경우 고유 번호 저장

            if (role === 'admin') { // 사업주인 경우
                if (!business_id) { // business_id가 없으면 새로 생성해야 함
                    // 임시로 사업장 고유 넘버를 생성하거나, 별도 사업주 생성 로직을 먼저 거쳐야 합니다.
                    // 여기서는 일단 business_id를 외부에서 받는다고 가정하거나, 나중에 자동 생성 로직 추가.
                    // 지금은 테스트를 위해 business_id를 함께 보내는것으로 가정
                    // 실제로는 사업주 가입 시 사업장 정보 먼저 생성 후 business_id를 받아와야 합니다.
                    return res.status(400).json({ message: '사업주 회원가입 시 business_id가 필요합니다.' });
                }
                insertQuery = `INSERT INTO users (business_id, username, password_hash, role, status) VALUES (?, ?, ?, ?, 'pending')`;
                insertValues = [business_id, username, password_hash, role];

            } else if (role === 'customer') { // 고객인 경우
                // 고객은 특정 사업장에 소속되므로 business_id 필요
                if (!business_id) {
                     return res.status(400).json({ message: '고객 회원가입 시 business_id가 필요합니다.' });
                }
                insertQuery = `INSERT INTO users (business_id, username, password_hash, role, status, name, phone_number) VALUES (?, ?, ?, ?, 'pending', ?, ?)`;
                insertValues = [business_id, username, password_hash, role, name, phone_number];

            } else if (role === 'superadmin' || role === 'staff') { // 슈퍼관리자나 직원인 경우
                insertQuery = `INSERT INTO users (username, password_hash, role, status) VALUES (?, ?, ?, 'pending')`;
                insertValues = [username, password_hash, role];
            } else {
                return res.status(400).json({ message: '유효하지 않은 역할입니다.' });
            }


            const [result] = await conn.execute(insertQuery, insertValues);
            const userId = result.insertId;

            // 이메일 인증 토큰 생성 및 저장 (나중에 구현)
            // const verificationToken = jwt.sign({ id: userId, username: username }, jwtSecret, { expiresIn: '1d' });
            // await conn.execute(`UPDATE users SET email_verification_token = ? WHERE id = ?`, [verificationToken, userId]);

            // 이메일 발송 (나중에 구현)
            // const verificationLink = `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}`;
            // await transporter.sendMail({
            //     from: process.env.EMAIL_USER,
            //     to: username,
            //     subject: '회원가입 이메일 인증',
            //     html: `<p>회원가입을 완료하려면 다음 링크를 클릭하세요: <a href="${verificationLink}">${verificationLink}</a></p>`,
            // });

            await conn.commit(); // 트랜잭션 커밋

            res.status(201).json({ message: '회원가입 요청 성공. 이메일 인증을 완료해주세요.', userId: userId });

        } catch (error) {
            // 트랜잭션 롤백 (오류 발생 시)
            if (conn) await conn.rollback();
            // MySQL 에러 코드 1062는 UNIQUE 제약 조건 위반 (username 중복)
            if (error.code === 'ER_DUP_ENTRY') {
                return res.status(409).json({ message: '이미 존재하는 사용자 이름(이메일)입니다.' });
            }
            console.error('회원가입 중 오류 발생:', error);
            res.status(500).json({ message: '회원가입 중 서버 오류가 발생했습니다.' });
        } finally {
            if (conn) conn.release(); // 연결 풀에 반환
        }

    } catch (error) {
        console.error('암호화 또는 JWT 생성 중 오류 발생:', error);
        res.status(500).json({ message: '서버 오류가 발생했습니다.' });
    }
});

// 로그인 API 엔드포인트
router.post('/login', async (req, res) => {
    const { username, password, role_attempt } = req.body; // role_attempt: 사용자가 로그인 시도하는 역할 (admin, customer 등)

    if (!username || !password || !role_attempt) {
        return res.status(400).json({ message: '사용자 이름, 비밀번호, 로그인 유형을 입력해주세요.' });
    }

    let conn;
    try {
        conn = await pool.getConnection();

        // 사용자 이름으로 사용자 정보 조회
        const [users] = await conn.execute('SELECT * FROM users WHERE username = ?', [username]);

        const user = users[0];

        if (!user) {
            return res.status(401).json({ message: '잘못된 사용자 이름 또는 비밀번호입니다.' });
        }

        // 비밀번호 일치 여부 확인
        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            return res.status(401).json({ message: '잘못된 사용자 이름 또는 비밀번호입니다.' });
        }

        // 계정 상태 확인 (예: 'pending' 상태는 로그인 불가)
        if (user.status === 'pending') {
            return res.status(403).json({ message: '이메일 인증을 완료해주세요.' });
        }
        if (user.status === 'suspended') {
            return res.status(403).json({ message: '정지된 계정입니다. 관리자에게 문의하세요.' });
        }

        // 요청된 role_attempt와 실제 사용자의 role이 일치하는지 확인
        // 슈퍼바이저가 사업주의 로그인 가능 여부를 통제하는 부분 (구독 결제 시)
        // 실제로는 subscription 테이블과 business 테이블을 조인하여 active 상태인지 확인해야 합니다.
        if (user.role !== role_attempt) {
            return res.status(403).json({ message: '선택하신 로그인 유형과 계정 역할이 일치하지 않습니다.' });
        }
        
        // 사업주 계정의 구독 상태 확인 (role이 'admin'인 경우에만)
        if (user.role === 'admin' || user.role === 'staff') { // 사업주 또는 직원이 로그인 시도 시
            const [subscriptions] = await conn.execute(
                `SELECT s.status AS subscription_status
                 FROM subscriptions s
                 WHERE s.business_id = ? AND s.status = 'active'`,
                [user.business_id]
            );
            if (subscriptions.length === 0 || subscriptions[0].subscription_status !== 'active') {
                return res.status(403).json({ message: '구독 서비스가 활성화되어 있지 않습니다. 슈퍼바이저에게 문의하세요.' });
            }
        }


        // JWT 토큰 생성
        const token = jwt.sign(
            { id: user.id, username: user.username, role: user.role, business_id: user.business_id },
            jwtSecret,
            { expiresIn: jwtExpiresIn }
        );

        // 로그인 성공 시 응답
        res.status(200).json({
            message: '로그인 성공',
            token,
            user: {
                id: user.id,
                username: user.username,
                role: user.role,
                business_id: user.business_id,
                name: user.name,
                phone_number: user.phone_number
            }
        });

    } catch (error) {
        console.error('로그인 중 오류 발생:', error);
        res.status(500).json({ message: '로그인 중 서버 오류가 발생했습니다.' });
    } finally {
        if (conn) conn.release();
    }
});

export default router; // router 객체를 내보내어 server.js에서 사용하도록 함