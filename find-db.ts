import fs from 'fs';
import path from 'path';

function findDBFiles(dir: string) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory() && file !== 'node_modules' && file !== '.git') {
      findDBFiles(fullPath);
    } else if (file.endsWith('.db')) {
      console.log(`${fullPath} - size: ${stat.size} bytes`);
    }
  }
}

findDBFiles('/app/applet');
