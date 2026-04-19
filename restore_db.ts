import * as fs from 'fs';
import * as path from 'path';

async function restoreLatest() {
    const prismaDir = path.join(process.cwd(), 'prisma');
    const files = fs.readdirSync(prismaDir);
    const backups = files.filter(f => f.startsWith('backup-') && f.endsWith('.db')).sort().reverse();

    if (backups.length === 0) {
        console.error('No backups found.');
        return;
    }

    const latestBackup = backups[0];
    const latestBackupPath = path.join(prismaDir, latestBackup);
    const dbPath = path.join(prismaDir, 'dev.db');

    console.log(`Restoring from ${latestBackup}...`);

    try {
        // Move current to .old
        if (fs.existsSync(dbPath)) {
            fs.renameSync(dbPath, dbPath + '.old');
            if (fs.existsSync(dbPath + '-wal')) fs.renameSync(dbPath + '-wal', dbPath + '-wal.old');
            if (fs.existsSync(dbPath + '-shm')) fs.renameSync(dbPath + '-shm', dbPath + '-shm.old');
        }

        fs.copyFileSync(latestBackupPath, dbPath);
        if (fs.existsSync(latestBackupPath + '-wal')) fs.copyFileSync(latestBackupPath + '-wal', dbPath + '-wal');
        if (fs.existsSync(latestBackupPath + '-shm')) fs.copyFileSync(latestBackupPath + '-shm', dbPath + '-shm');

        console.log('✅ Restoration complete. Please restart the server.');
    } catch (err) {
        console.error('❌ Restoration failed:', err);
    }
}

restoreLatest();
