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

    db.run(`CREATE TABLE IF NOT EXISTS settings (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        clinic_name TEXT DEFAULT 'Klinik Sehat',
        subtitle TEXT DEFAULT 'Sistem Antrian Terpadu',
        address TEXT DEFAULT 'Jl. Kesehatan No. 123, Jakarta',
        phone TEXT DEFAULT '021-5551234',
        running_text TEXT DEFAULT 'Selamat datang di Klinik Sehat. Utamakan keselamatan dan kesehatan Anda. Harap menunggu nomor antrian dipanggil.'
    )`);

    // Insert default setting row if empty
    db.run(`INSERT OR IGNORE INTO settings (id, clinic_name, subtitle, address, phone, running_text)
            VALUES (1, 'Klinik Sehat', 'Sistem Antrian Terpadu', 'Jl. Kesehatan No. 123, Jakarta', '021-5551234', 'Selamat datang di Klinik Sehat. Utamakan keselamatan dan kesehatan Anda. Harap menunggu nomor antrian dipanggil.')`);

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
