const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./database');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// ============================================================
// GET /api/settings — Ambil pengaturan nama klinik & running text
// ============================================================
app.get('/api/settings', (req, res) => {
    db.get(`SELECT * FROM settings WHERE id = 1`, [], (err, row) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ data: row || {} });
    });
});

// ============================================================
// PUT /api/settings — Update pengaturan nama klinik & running text
// ============================================================
app.put('/api/settings', (req, res) => {
    const { clinic_name, subtitle, address, phone, running_text } = req.body;
    db.run(
        `UPDATE settings SET
            clinic_name = COALESCE(?, clinic_name),
            subtitle = COALESCE(?, subtitle),
            address = COALESCE(?, address),
            phone = COALESCE(?, phone),
            running_text = COALESCE(?, running_text)
         WHERE id = 1`,
        [clinic_name, subtitle, address, phone, running_text],
        function (err) {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            res.json({ message: 'Pengaturan berhasil diperbarui' });
        }
    );
});

// ============================================================
// GET /api/queues/export — Export data antrian ke CSV
// ============================================================
app.get('/api/queues/export', (req, res) => {
    db.all(
        `SELECT q.id, q.queue_number, COALESCE(p.name, 'Pasien Umum') as name, COALESCE(p.nik_phone, '-') as nik_phone, q.poli, q.status, q.created_at
         FROM queues q
         LEFT JOIN patients p ON q.patient_id = p.id
         ORDER BY q.id ASC`,
        [],
        (err, rows) => {
            if (err) {
                res.status(500).send('Error export data');
                return;
            }

            let csv = 'ID,No Tiket,Nama Pasien,NIK/Phone,Poli,Status,Tanggal\n';
            rows.forEach(r => {
                csv += `"${r.id}","${r.queue_number}","${r.name}","${r.nik_phone}","${r.poli}","${r.status}","${r.created_at}"\n`;
            });

            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', 'attachment; filename="Laporan_Antrian_Klinik.csv"');
            res.status(200).send(csv);
        }
    );
});

// ============================================================
// GET /api/queues — Ambil semua antrian hari ini
// ============================================================
app.get('/api/queues', (req, res) => {
    db.all(
        `SELECT q.*, COALESCE(p.name, 'Pasien Umum') as name, COALESCE(p.nik_phone, '-') as nik_phone 
         FROM queues q 
         LEFT JOIN patients p ON q.patient_id = p.id 
         WHERE DATE(q.created_at) = DATE('now','localtime')
         ORDER BY q.id ASC`,
        [],
        (err, rows) => {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            res.json({ data: rows });
        }
    );
});

// ============================================================
// GET /api/queues/stats — Statistik antrian hari ini
// ============================================================
app.get('/api/queues/stats', (req, res) => {
    db.all(
        `SELECT 
            COUNT(*) as total,
            SUM(CASE WHEN status = 'waiting' THEN 1 ELSE 0 END) as waiting,
            SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress,
            SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) as done,
            SUM(CASE WHEN status = 'skipped' THEN 1 ELSE 0 END) as skipped
         FROM queues 
         WHERE DATE(created_at) = DATE('now','localtime')`,
        [],
        (err, rows) => {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            res.json({ data: rows[0] });
        }
    );
});

// ============================================================
// POST /api/queues — Tambah pasien baru ke antrian
// ============================================================
app.post('/api/queues', (req, res) => {
    const { name, nik_phone, queue_number, poli } = req.body;

    db.run(
        `INSERT INTO patients (name, nik_phone) VALUES (?, ?)`,
        [name, nik_phone],
        function (err) {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            const patientId = this.lastID;

            db.run(
                `INSERT INTO queues (queue_number, patient_id, poli, status) VALUES (?, ?, ?, 'waiting')`,
                [queue_number, patientId, poli || 'Poli Gigi & Mulut'],
                function (err) {
                    if (err) {
                        res.status(500).json({ error: err.message });
                        return;
                    }
                    res.json({ message: 'Antrian berhasil ditambahkan', queueId: this.lastID });
                }
            );
        }
    );
});

// ============================================================
// PUT /api/queues/:id/status — Update status antrian
// Status: waiting | in_progress | done | skipped
// ============================================================
app.put('/api/queues/:id/status', (req, res) => {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['waiting', 'in_progress', 'done', 'skipped'];
    if (!validStatuses.includes(status)) {
        res.status(400).json({ error: 'Status tidak valid. Gunakan: waiting, in_progress, done, skipped' });
        return;
    }

    db.run(
        `UPDATE queues SET status = ? WHERE id = ?`,
        [status, id],
        function (err) {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            if (this.changes === 0) {
                res.status(404).json({ error: 'Antrian tidak ditemukan' });
                return;
            }
            res.json({ message: 'Status berhasil diupdate', changes: this.changes });
        }
    );
});

// ============================================================
// PUT /api/queues/call-next — Panggil pasien berikutnya
// Set pasien in_progress sekarang jadi done, lalu set waiting pertama jadi in_progress
// ============================================================
app.put('/api/queues/call-next', (req, res) => {
    db.run(
        `UPDATE queues SET status = 'done' 
         WHERE status = 'in_progress' AND DATE(created_at) = DATE('now','localtime')`,
        [],
        function (err) {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }

            db.get(
                `SELECT q.*, COALESCE(p.name, 'Pasien Umum') as name, COALESCE(p.nik_phone, '-') as nik_phone 
                 FROM queues q 
                 LEFT JOIN patients p ON q.patient_id = p.id 
                 WHERE q.status = 'waiting' AND DATE(q.created_at) = DATE('now','localtime')
                 ORDER BY q.id ASC 
                 LIMIT 1`,
                [],
                (err, row) => {
                    if (err) {
                        res.status(500).json({ error: err.message });
                        return;
                    }
                    if (!row) {
                        res.json({ message: 'Tidak ada antrian menunggu', data: null });
                        return;
                    }

                    db.run(
                        `UPDATE queues SET status = 'in_progress' WHERE id = ?`,
                        [row.id],
                        function (err) {
                            if (err) {
                                res.status(500).json({ error: err.message });
                                return;
                            }
                            row.status = 'in_progress';
                            res.json({ message: 'Pasien dipanggil', data: row });
                        }
                    );
                }
            );
        }
    );
});

// ============================================================
// DELETE /api/queues/reset/today — Reset semua antrian hari ini
// ============================================================
app.delete('/api/queues/reset/today', (req, res) => {
    db.run(
        `DELETE FROM queues WHERE DATE(created_at) = DATE('now','localtime')`,
        [],
        function (err) {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            res.json({ message: 'Semua antrian hari ini berhasil direset', changes: this.changes });
        }
    );
});

// ============================================================
// DELETE /api/queues/:id — Hapus satu antrian
// ============================================================
app.delete('/api/queues/:id', (req, res) => {
    const { id } = req.params;

    db.run(`DELETE FROM queues WHERE id = ?`, [id], function (err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        if (this.changes === 0) {
            res.status(404).json({ error: 'Antrian tidak ditemukan' });
            return;
        }
        res.json({ message: 'Antrian berhasil dihapus', changes: this.changes });
    });
});

const PORT = 5000;
app.listen(PORT, () => {
    console.log(`Server lokal Klinik jalan di http://localhost:${PORT}`);
});
