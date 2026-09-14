const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const dbPath = path.resolve(__dirname, 'orders.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) console.error('DB 연결 실패:', err.message);
    else console.log('SQLite DB 연결 성공');
});

db.serialize(() => {
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
            order_token TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    db.all("PRAGMA table_info(orders)", [], (err, rows) => {
        if (!err && rows) {
            const hasToken = rows.some(col => col.name === 'order_token');
            if (!hasToken) {
                db.run(`ALTER TABLE orders ADD COLUMN order_token TEXT`, () => {});
            }
        }
    });
});

app.post('/api/orders', (req, res) => {
    const fries = Number(req.body.fries) || 0;
    const drink = Number(req.body.drink) || 0;
    const set_menu = Number(req.body.set_menu || req.body.setMenu) || 0;
    const totalPrice = Number(req.body.totalPrice || req.body.total_price) || 0;
    
    const customerName = req.body.customerName || req.body.customer_name || '';
    const phone = req.body.phone || '';
    const orderToken = req.body.orderToken || '';

    if (!totalPrice || totalPrice <= 0) {
        return res.status(400).json({ error: '유효하지 않은 주문 금액입니다.' });
    }

    const sql = `INSERT INTO orders (fries, drink, set_menu, total_price, customer_name, phone, order_token) VALUES (?, ?, ?, ?, ?, ?, ?)`;
    db.run(sql, [fries, drink, set_menu, totalPrice, customerName, phone, orderToken], function (err) {
        if (err) {
            console.error('주문 저장 실패:', err.message);
            return res.status(500).json({ error: '주문 저장 실패' });
        }
        res.json({ message: '주문 접수 완료', orderId: this.lastID });
    });
});

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

app.delete('/api/orders/:id', (req, res) => {
    const { id } = req.params;
    const sql = `DELETE FROM orders WHERE id = ?`;
    db.run(sql, [id], function (err) {
        if (err) {
            console.error('주문 삭제 실패:', err.message);
            return res.status(500).json({ error: '주문 삭제 실패' });
        }
        res.json({ message: '주문 삭제 완료' });
    });
});

app.listen(PORT, () => {
    console.log(`서버가 포트 ${PORT}에서 실행 중입니다.`);
});