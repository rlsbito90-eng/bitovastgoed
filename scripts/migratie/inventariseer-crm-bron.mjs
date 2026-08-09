import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const migrationsDir = path.join(root, 'supabase', 'migrations');
const functionsDir = path.join(root, 'supabase', 'functions');

async function hashFile(filePath) {
  const data = await readFile(filePath);
  return createHash('sha256').update(data).digest('hex');
}

async function listFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await listFiles(full));
    else if (entry.isFile()) files.push(full);
  }
  return files.sort();
}

async function main() {
  const migrationFiles = (await listFiles(migrationsDir)).filter(file => file.endsWith('.sql'));
  const functionEntries = (await readdir(functionsDir, { withFileTypes: true }))
    .filter(entry => entry.isDirectory() && !entry.name.startsWith('_'))
    .map(entry => entry.name)
    .sort();

  const migrations = [];
  for (const file of migrationFiles) {
    migrations.push({
      file: path.relative(root, file).replaceAll(path.sep, '/'),
      sha256: await hashFile(file),
    });
  }

  const functions = [];
  for (const name of functionEntries) {
    const dir = path.join(functionsDir, name);
    const files = await listFiles(dir);
    const fileEntries = [];
    for (const file of files) {
      fileEntries.push({
        file: path.relative(root, file).replaceAll(path.sep, '/'),
        sha256: await hashFile(file),
      });
    }
    functions.push({ name, files: fileEntries });
  }

  const manifest = {
    schemaVersion: 1,
    generatedFrom: 'repository',
    counts: {
      migrations: migrations.length,
      edgeFunctions: functions.length,
    },
    migrations,
    functions,
  };

  process.stdout.write(`${JSON.stringify(manifest, null, 2)}\n`);
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
