// Checks the front-end's dependency rule (README, "Source layout"): each folder of src/ may only
// import the folders listed for it. `npm run check:layers`; exits 1 and lists the offending imports.
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), '../src');

// What each layer may import (besides itself and npm packages).
const ALLOWED = {
  core: [],
  lib: ['core'],
  domain: ['core', 'lib'],
  services: ['core', 'lib', 'domain'],
  hooks: ['core', 'lib', 'domain', 'services', 'providers'],
  providers: ['core', 'lib', 'domain', 'services', 'hooks'],
  components: ['core', 'lib', 'domain'],
  'apps/portal': ['core', 'lib', 'domain', 'services', 'hooks', 'providers', 'components'],
  'apps/desk': ['core', 'lib', 'domain', 'services', 'hooks', 'providers', 'components'],
};

const layerOf = (file) => {
  const parts = relative(SRC, file).split(sep);
  return parts[0] === 'apps' ? `apps/${parts[1]}` : parts[0];
};

const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]));

const problems = [];
for (const file of walk(SRC).filter((f) => /\.(ts|tsx)$/.test(f))) {
  const from = layerOf(file);
  if (!(from in ALLOWED)) continue;
  for (const [, spec] of readFileSync(file, 'utf8').matchAll(/from '(\.[^']+)'/g)) {
    const to = layerOf(resolve(dirname(file), spec));
    if (to !== from && !ALLOWED[from].includes(to)) problems.push(`${relative(SRC, file)}: ${from} → ${to} (${spec})`);
  }
}

if (problems.length) {
  console.error(`Layer rule broken ${problems.length} time(s):\n  ${problems.join('\n  ')}`);
  process.exit(1);
}
console.log('Layers OK: every import follows the dependency rule.');
