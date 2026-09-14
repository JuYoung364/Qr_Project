const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// SQLite DB 연결
const dbPath = path.resolve(__dirname, 'orders.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('DB 연결 실패:', err.message);
    } else {
        console.log('SQLite DB 연결 성공');
    }
});

// 테이블 생성 및 새 컬럼 추가 안전 보장
db.serialize(() => {
    // 1. 기본 테이블 생성
    db.run(`
        CREATE TABLE IF NOT EXISTS orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            fries INTEGER DEFAULT 0,
            drink INTEGER DEFAULT 0,
            set_menu INTEGER DEFAULT 0,
            total_price INTEGER NOT NULL,
            status TEXT DEFAULT '조리중',
            customer_name TEXT,
            phone TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // 2. 기존 DB에 customer_name, phone 컬럼이 없는 경우를 대비해 컬럼 유무 확인 후 안전하게 추가
    db.all("PRAGMA table_info(orders)", [], (err, rows) => {
        if (!err && rows) {
            const hasName = rows.some(col => col.name === 'customer_name');
            const hasPhone = rows.some(col => col.name === 'phone');

            if (!hasName) {
                db.run(`ALTER TABLE orders ADD COLUMN customer_name TEXT`, (err) => {
                    if (err) console.error('customer_name 컬럼 추가 실패:', err.message);
                    else console.log('customer_name 컬럼 추가 성공');
                });
            }
            if (!hasPhone) {
                db.run(`ALTER TABLE orders ADD COLUMN phone TEXT`, (err) => {
                    if (err) console.error('phone 컬럼 추가 실패:', err.message);
                    else console.log('phone 컬럼 추가 성공');
                });
            }
        }
    });
});

// [POST] 주문 접수 API
app.post('/api/orders', (req, res) => {
    // 프론트엔드 호환성을 위해 customerName/customer_name, phone 호환 처리
    const fries = Number(req.body.fries) || 0;
    const drink = Number(req.body.drink) || 0;
    const set_menu = Number(req.body.set_menu || req.body.setMenu) || 0;
    const totalPrice = Number(req.body.totalPrice || req.body.total_price) || 0;
    
    const customerName = req.body.customerName || req.body.customer_name || '';
    const phone = req.body.phone || '';

    if (!totalPrice || totalPrice <= 0) {
        return res.status(400).json({ error: '유효하지 않은 주문 금액입니다.' });
    }

    const sql = `INSERT INTO orders (fries, drink, set_menu, total_price, customer_name, phone) VALUES (?, ?, ?, ?, ?, ?)`;
    db.run(sql, [fries, drink, set_menu, totalPrice, customerName, phone], function (err) {
        if (err) {
            console.error('주문 저장 실패:', err.message);
            return res.status(500).json({ error: '주문 저장 실패' });
        }
        res.json({ message: '주문 접수 완료', orderId: this.lastID });
    });
});

// [GET] 주문 목록 조회 API
app.get('/api/orders', (req, res) => {
    const sql = `SELECT * FROM orders ORDER BY id DESC`;
    db.all(sql, [], (err, rows) => {
        if (err) {
            console.error('주문 조회 실패:', err.message);
            return res.status(500).json({ error: '주문 조회 실패' });
        }
        res.json(rows);
    });
});

// [PATCH] 주문 상태 변경 API
app.patch('/api/orders/:id', (req, res) => {
    const { id } = req.params;
    const { status } = req.body;

    const sql = `UPDATE orders SET status = ? WHERE id = ?`;
    db.run(sql, [status, id], function (err) {
        if (err) {
            console.error('상태 변경 실패:', err.message);
            return res.status(500).json({ error: '상태 변경 실패' });
        }
        res.json({ message: '상태 변경 완료' });
    });
});

app.listen(PORT, () => {
    console.log(`서버가 포트 ${PORT}에서 실행 중입니다.`);
});