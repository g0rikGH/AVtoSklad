import * as fs from 'fs';
import * as path from 'path';

const dbPath = path.join(process.cwd(), 'prisma', 'dev.db');
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupPath = path.join(process.cwd(), 'prisma', `backup-${timestamp}.db`);

if (fs.existsSync(dbPath)) {
  try {
    fs.copyFileSync(dbPath, backupPath);
    console.log(`✅ Database backup created: ${backupPath}`);
    
    // Also backup WAL files if they exist (though copying the main DB is usually enough if it's idle)
    const walPath = dbPath + '-wal';
    if (fs.existsSync(walPath)) {
        fs.copyFileSync(walPath, backupPath + '-wal');
        console.log(`✅ WAL backup created: ${backupPath}-wal`);
    }
    const shmPath = dbPath + '-shm';
    if (fs.existsSync(shmPath)) {
        fs.copyFileSync(shmPath, backupPath + '-shm');
        console.log(`✅ SHM backup created: ${backupPath}-shm`);
    }
  } catch (err) {
    console.error('❌ Backup failed:', err);
  }
} else {
  console.error('❌ dev.db not found');
}
