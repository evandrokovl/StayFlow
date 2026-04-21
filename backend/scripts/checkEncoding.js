const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..', '..');
const scanRoots = [
  path.join(projectRoot, 'backend', 'src'),
  path.join(projectRoot, 'backend', 'test'),
  path.join(projectRoot, 'backend', 'scripts'),
  path.join(projectRoot, 'frontend')
];

const ignoredDirectories = new Set([
  'node_modules',
  '.git'
]);

const checkedExtensions = new Set([
  '.js',
  '.json',
  '.html',
  '.css',
  '.md',
  '.env',
  '.example',
  ''
]);

const mojibakePattern = new RegExp(
  `(?:${String.fromCharCode(0x00c3)}.|${String.fromCharCode(0x00c2)}.|${String.fromCharCode(0x00f0)}${String.fromCharCode(0x0178)}.|${String.fromCharCode(0xfffd)})`,
  'u'
);
const failures = [];

function isTextFile(filePath) {
  const basename = path.basename(filePath);
  const extension = path.extname(filePath);

  if (basename.startsWith('.env')) return true;
  return checkedExtensions.has(extension);
}

function walk(directory) {
  if (!fs.existsSync(directory)) return;

  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (ignoredDirectories.has(entry.name)) continue;

    const fullPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      walk(fullPath);
      continue;
    }

    if (!entry.isFile() || !isTextFile(fullPath)) continue;

    checkFile(fullPath);
  }
}

function checkFile(filePath) {
  const buffer = fs.readFileSync(filePath);
  const decoded = buffer.toString('utf8');
  const encodedAgain = Buffer.from(decoded, 'utf8');
  const relativePath = path.relative(projectRoot, filePath);

  if (!buffer.equals(encodedAgain)) {
    failures.push(`${relativePath}: arquivo nao esta em UTF-8 valido`);
    return;
  }

  const lines = decoded.split(/\r?\n/);

  lines.forEach((line, index) => {
    if (mojibakePattern.test(line)) {
      failures.push(`${relativePath}:${index + 1}: possivel texto com encoding quebrado`);
    }
  });
}

for (const root of scanRoots) {
  walk(root);
}

if (failures.length > 0) {
  console.error('Falha na checagem de encoding:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log('Encoding OK: arquivos UTF-8 sem sinais de mojibake.');
