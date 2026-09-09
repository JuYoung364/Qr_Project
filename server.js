const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');

const app = express();

// CORS 전체 허용
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type']
}));

app.use(express.json());

// SQLite DB 연결
const db = new sqlite3.Database('./orders.db', (err) => {
    if (err) {
        console.error('DB 연결 실패:', err.message);
    } else {
        console.log('SQLite DB 연결 성공');
    }
});

// 테이블 생성 및 자동 컬럼 추가 (안전 모드)
db.serialize(() => {
    // 1. 기본 테이블 생성
    db.run(`
        CREATE TABLE IF NOT EXISTS orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            fries INTEGER DEFAULT 0,
            drink INTEGER DEFAULT 0,
            total_price INTEGER,
            status TEXT DEFAULT '접수대기',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // 2. set_menu 컬럼이 없으면 자동으로 강제 추가
    db.run(`ALTER TABLE orders ADD COLUMN set_menu INTEGER DEFAULT 0`, (err) => {
        // 이미 컬럼이 존재하면 에러가 나는데, 정상적인 현상이므로 무시합니다.
        if (err && !err.message.includes('duplicate column name')) {
            console.error('컬럼 추가 체크 중 오류:', err.message);
        } else {
            console.log('DB 테이블 및 컬럼 검증 완료');
        }
    });
});

// 1. [POST] 주문 생성 API
app.post('/api/orders', (req, res) => {
    const { fries, drink, set_menu, totalPrice } = req.body;
    const sql = `INSERT INTO orders (fries, drink, set_menu, total_price) VALUES (?, ?, ?, ?)`;

    db.run(sql, [fries || 0, drink || 0, set_menu || 0, totalPrice], function(err) {
        if (err) {
            console.error('주문 저장 실패:', err.message);
            return res.status(500).json({ error: err.message });
        }
        res.json({ message: '주문 성공', orderId: this.lastID });
    });
});

// 2. [GET] 주문 목록 조회 API
app.get('/api/orders', (req, res) => {
    const sql = `SELECT * FROM orders ORDER BY id DESC`;
    db.all(sql, [], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json(rows);
    });
});

// 3. [PATCH] 주문 상태 변경 API
app.patch('/api/orders/:id', (req, res) => {
    const { status } = req.body;
    const { id } = req.params;
    const sql = `UPDATE orders SET status = ? WHERE id = ?`;

    db.run(sql, [status, id], function(err) {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json({ message: '상태 변경 완료' });
    });
});

// 4. [DELETE] 주문 삭제 API
app.delete('/api/orders/:id', (req, res) => {
    const { id } = req.params;
    const sql = `DELETE FROM orders WHERE id = ?`;

    db.run(sql, [id], function(err) {
        if (err) {
            console.error('주문 삭제 실패:', err.message);
            return res.status(500).json({ error: err.message });
        }
        res.json({ message: '주문 삭제 완료' });
    });
});

// 서버 실행
const PORT = 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`서버가 정상 실행 중입니다: http://127.0.0.1:${PORT}`);
});