import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const SOURCE_ROOT = join(process.cwd(), 'src');
const CLEARABLE_TYPES = 'date|time|datetime-local|month|week';
const rawDateTimeInput = new RegExp(
  `<input\\b(?:(?!\\/?>)[\\s\\S])*?\\btype\\s*=\\s*["'](?:${CLEARABLE_TYPES})["']`,
);

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\\.(tsx|jsx)$/.test(name) ? [path] : [];
  });
}

describe('Datum- en tijdvelden — app-brede wisactie', () => {
  it('gebruikt geen ongedekte native datum/tijd-inputs buiten de bewuste quick-capture picker', () => {
    const allowedRawInputs = new Set([
      'components/tasks/QuickTaskCapture.tsx',
    ]);

    const violations = sourceFiles(SOURCE_ROOT).flatMap((file) => {
      const localPath = relative(SOURCE_ROOT, file).replaceAll('\\', '/');
      if (allowedRawInputs.has(localPath)) return [];
      const source = readFileSync(file, 'utf8');
      return rawDateTimeInput.test(source) ? [localPath] : [];
    });

    expect(violations).toEqual([]);
  });
});
