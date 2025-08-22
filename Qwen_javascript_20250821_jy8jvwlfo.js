const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const session = require('express-session');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Configuración de sesiones
app.use(session({
  secret: 'jireh-secret-key-2025', // Cambia esto en producción
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000 } // 1 día
}));

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Base de datos
const db = new sqlite3.Database('./data.db');
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS clients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      place TEXT NOT NULL,
      amount REAL NOT NULL,
      payment_date TEXT NOT NULL,
      paid BOOLEAN DEFAULT FALSE,
      created_month TEXT DEFAULT (strftime('%Y-%m', 'now'))
    )
  `);
});

// 🔐 Middleware para proteger rutas
function requireLogin(req, res, next) {
  if (req.session.loggedIn) {
    next();
  } else {
    res.status(401).json({ error: 'No autorizado' });
  }
}

// Ruta de login
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  // Usuario: admin | Contraseña: jireh2025 (puedes cambiarlo)
  if (username === 'admin' && password === 'jireh2025') {
    req.session.loggedIn = true;
    req.session.username = username;
    return res.json({ success: true });
  }
  res.status(401).json({ success: false, message: 'Credenciales inválidas' });
});

// Ruta de logout
app.post('/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

// Todas las rutas de API están protegidas
app.use('/api', requireLogin);

// === RUTAS PROTEGIDAS ===

app.get('/api/clients', (req, res) => {
  const currentMonth = new Date().toISOString().slice(0, 7);
  const sql = `SELECT * FROM clients WHERE created_month = ? ORDER BY name`;
  db.all(sql, [currentMonth], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/clients', (req, res) => {
  const { name, place, amount, payment_date } = req.body;
  const currentMonth = new Date().toISOString().slice(0, 7);
  const sql = `INSERT INTO clients (name, place, amount, payment_date, paid, created_month) VALUES (?, ?, ?, ?, 0, ?)`;
  db.run(sql, [name, place, amount, payment_date, currentMonth], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.status(201).json({ id: this.lastID, message: 'Cliente agregado' });
  });
});

app.patch('/api/clients/:id', (req, res) => {
  const { paid } = req.body;
  const sql = `UPDATE clients SET paid = ? WHERE id = ?`;
  db.run(sql, [paid ? 1 : 0, req.params.id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Estado actualizado', changes: this.changes });
  });
});

app.get('/api/summary', (req, res) => {
  const currentMonth = new Date().toISOString().slice(0, 7);
  const sql = `SELECT SUM(amount) as total_paid FROM clients WHERE paid = 1 AND created_month = ?`;
  db.get(sql, [currentMonth], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ total_paid: row.total_paid || 0 });
  });
});

// Ruta principal: redirige al login si no está logueado
app.get('/', (req, res) => {
  if (req.session.loggedIn) {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  } else {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
  }
});

app.listen(PORT, () => {
  console.log(`🟢 JIREH MANAGER corriendo en http://localhost:${PORT}`);
  console.log(`➡️  Usuario: admin | Contraseña: jireh2025`);
});