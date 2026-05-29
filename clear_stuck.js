const db = require('better-sqlite3')('c:/Users/RUAN CPA/Documents/AI PROJECT OPERATING SYSTEM/apps/backend/data/aios.db');
const rows = db.prepare('SELECT status, COUNT(*) as c FROM qr_codes GROUP BY status').all();
console.log('QR codes:', rows);
const rows2 = db.prepare('SELECT status, COUNT(*) as c FROM payments GROUP BY status').all();
console.log('Payments:', rows2);
