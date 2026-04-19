import * as fs from 'fs';
import * as path from 'path';

const dbPath = path.join(process.cwd(), 'prisma', 'dev.db');
const badPath = path.join(process.cwd(), 'prisma', 'dev.db.bad');

if (fs.existsSync(dbPath)) {
  fs.renameSync(dbPath, badPath);
  console.log('Renamed dev.db to dev.db.bad');
} else {
  console.log('dev.db not found');
}
