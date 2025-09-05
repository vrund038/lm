import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Add shebang to index.js
const indexPath = path.join(__dirname, 'dist', 'index.js');
const content = fs.readFileSync(indexPath, 'utf8');

if (!content.startsWith('#!/usr/bin/env node')) {
  fs.writeFileSync(indexPath, '#!/usr/bin/env node\n' + content);
  console.log('Added shebang to dist/index.js');
} else {
  console.log('Shebang already present in dist/index.js');
}
