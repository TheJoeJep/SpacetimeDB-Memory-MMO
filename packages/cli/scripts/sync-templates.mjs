// Copies the spacetime-module package source into packages/cli/templates/spacetime-module
// so the CLI can bundle the module for users who install via npx.
import { cpSync, rmSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = resolve(__dirname, '..', '..', 'spacetime-module');
const dst = resolve(__dirname, '..', 'templates', 'spacetime-module');

rmSync(dst, { recursive: true, force: true });
mkdirSync(dirname(dst), { recursive: true });
cpSync(src, dst, {
  recursive: true,
  filter: (s) => !s.includes('node_modules') && !s.includes('dist'),
});
console.log(`Synced ${src} -> ${dst}`);
