const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./lms.db', (err) => {
    if(err){
        console.error('Failed to Connect to Database:', err.message);
    } else{
        console.log('Connected to SQLite Database.');
    }
});

db.serialize(() => {
    db.run('PRAGMA journal_mode = WAL;');
    db.run('PRAGMA busy_timeout = 5000;');  // wait 5 seconds if DB is locked
    // Create tables if they don't exist
  db.run(`CREATE TABLE IF NOT EXISTS employees (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    department TEXT,
    joining_date TEXT NOT NULL
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS leave_balances (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id INTEGER NOT NULL,
    year INTEGER NOT NULL,
    entitlement REAL NOT NULL,
    used REAL DEFAULT 0
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS leaves (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id INTEGER NOT NULL,
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    days REAL NOT NULL,
    status TEXT DEFAULT 'PENDING',
    reason TEXT,
    applied_at TEXT DEFAULT CURRENT_TIMESTAMP,
    approved_by INTEGER,
    approved_at TEXT,
    approval_comment TEXT
  )`);
});

module.exports = db;