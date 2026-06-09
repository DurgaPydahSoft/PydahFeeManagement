import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcDir = path.join(__dirname, '..', 'src');

const walk = (dir, files = []) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else if (/\.(jsx?|tsx?)$/.test(entry.name) && !full.endsWith(`${path.sep}lib${path.sep}api.js`)) {
      files.push(full);
    }
  }
  return files;
};

const migrateFile = (filePath) => {
  let content = fs.readFileSync(filePath, 'utf8');
  if (!content.includes('axios') && !content.includes('VITE_API_URL') && !content.includes('API_URL')) {
    return false;
  }

  const relDir = path.relative(srcDir, path.dirname(filePath));
  const importPath = relDir ? `${'../'.repeat(relDir.split(path.sep).length)}lib/api` : './lib/api';

  content = content.replace(/import axios from ['"]axios['"];?\s*\n/g, `import api from '${importPath}';\n`);
  content = content.replace(/^const API_URL = import\.meta\.env\.VITE_API_URL;\s*\n/gm, '');
  content = content.replace(/\baxios\./g, 'api.');
  content = content.replace(/\$\{import\.meta\.env\.VITE_API_URL\}\/api/g, '');
  content = content.replace(/\$\{API_URL\}\/api/g, '');

  // Remove Authorization-only header blocks left after interceptor handles auth
  content = content.replace(
    /,\s*\{\s*headers:\s*\{\s*Authorization:\s*`Bearer \$\{localStorage\.getItem\('token'\)\}`\s*\}\s*\}/g,
    ''
  );
  content = content.replace(
    /\{\s*headers:\s*\{\s*Authorization:\s*`Bearer \$\{localStorage\.getItem\('token'\)\}`\s*\}\s*\}/g,
    '{}'
  );

  fs.writeFileSync(filePath, content);
  return true;
};

const files = walk(srcDir);
const updated = files.filter(migrateFile);
console.log(`Updated ${updated.length} files:`);
updated.forEach((f) => console.log(`  - ${path.relative(path.join(__dirname, '..'), f)}`));
