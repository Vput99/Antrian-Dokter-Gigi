const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'klinik_gigi.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Gagal koneksi ke SQLite:', err.message);
    } else {
        console.log('Berhasil terhubung ke database SQLite lokal.');
    }
});

db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS patients (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        nik_phone TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS queues (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        queue_number TEXT NOT NULL,
        patient_id INTEGER,
        poli TEXT DEFAULT 'Poli Gigi & Mulut',
        status TEXT DEFAULT 'waiting',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(patient_id) REFERENCES patients(id)
    )`);

    // Migrasi: tambah kolom jika belum ada (untuk database versi lama)
    db.run(`ALTER TABLE queues ADD COLUMN patient_id INTEGER`, (err) => {
        if (err && !err.message.includes('duplicate column')) {
            // Kolom sudah ada, abaikan error ini
        }
    });

    db.run(`ALTER TABLE queues ADD COLUMN poli TEXT DEFAULT 'Poli Gigi & Mulut'`, (err) => {
        if (err && !err.message.includes('duplicate column')) {
            // Kolom sudah ada, abaikan error ini
        }
    });
});

module.exports = db;