const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { zipSync } = require('fflate');

const EXPORT_MANIFEST_FILE = 'export-manifest.json';

const backendRoot = path.resolve(__dirname, '..');
const workspaceRoot = path.resolve(backendRoot, '..', '..');
const runtimeRoot = path.resolve(
  process.env.VFD_RUNTIME_DIST_DIR || path.join(workspaceRoot, 'packages', 'vfd', 'dist'),
);
const outputZipPath = path.resolve(
  process.env.VFD_BASE_RUNTIME_ZIP || path.join(backendRoot, 'runtime', 'vfd-base-runtime.zip'),
);
const outputMetaPath = outputZipPath.replace(/\.zip$/i, '.meta.json');

function normalizeManifestPath(filePath) {
  const normalized = String(filePath || '').replace(/\\/g, '/');
  if (!normalized || normalized.startsWith('/') || normalized.includes('..')) {
    throw new Error(`Illegal runtime path: ${filePath}`);
  }
  return normalized;
}

function resolveSafePath(root, relativePath) {
  const rootPath = path.resolve(root);
  const resolvedPath = path.resolve(rootPath, relativePath);
  if (!resolvedPath.startsWith(rootPath + path.sep) && resolvedPath !== rootPath) {
    throw new Error(`Path escapes runtime root: ${relativePath}`);
  }
  return resolvedPath;
}

function addRuntimeFile(zipFiles, filePath) {
  const manifestPath = normalizeManifestPath(filePath);
  if (manifestPath.endsWith('.gz')) return;

  const absolutePath = resolveSafePath(runtimeRoot, manifestPath);
  if (!fs.existsSync(absolutePath) || !fs.statSync(absolutePath).isFile()) {
    throw new Error(`Runtime file missing: ${manifestPath}`);
  }

  zipFiles[manifestPath] = new Uint8Array(fs.readFileSync(absolutePath));
}

const manifestPath = path.join(runtimeRoot, EXPORT_MANIFEST_FILE);
if (!fs.existsSync(manifestPath)) {
  throw new Error(`Runtime manifest missing. Build packages/vfd first: ${manifestPath}`);
}

const manifestText = fs.readFileSync(manifestPath, 'utf8');
const manifest = JSON.parse(manifestText);
const zipFiles = {};

addRuntimeFile(zipFiles, 'index.html');
zipFiles[EXPORT_MANIFEST_FILE] = new Uint8Array(Buffer.from(manifestText));

(manifest.files || []).forEach((file) => {
  addRuntimeFile(zipFiles, file.path);
});

const zipBuffer = Buffer.from(zipSync(zipFiles, {
  level: 6,
  mtime: new Date(),
}));
const totalBytes = Object.values(zipFiles).reduce((sum, file) => sum + file.byteLength, 0);

fs.mkdirSync(path.dirname(outputZipPath), { recursive: true });
fs.writeFileSync(outputZipPath, zipBuffer);
fs.writeFileSync(outputMetaPath, JSON.stringify({
  generatedAt: new Date().toISOString(),
  sourceRuntimeRoot: runtimeRoot,
  sourceManifestGeneratedAt: manifest.generatedAt,
  fileCount: Object.keys(zipFiles).length,
  totalBytes,
  zipBytes: zipBuffer.byteLength,
  sha256: createHash('sha256').update(zipBuffer).digest('hex'),
}, null, 2));

console.log(`Base runtime package written: ${outputZipPath}`);
