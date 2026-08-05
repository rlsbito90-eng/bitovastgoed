import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const SCRIPT = resolve(__dirname, '../../../scripts/bag/extract-amsterdam-full-subset.py');

function pandXml(identificatie: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<sl:standBestand xmlns:sl="http://x" xmlns:o="http://y">
  <sl:stand>
    <o:Pand>
      <o:identificatie>${identificatie}</o:identificatie>
      <o:voorkomen><o:voorkomenidentificatie>1</o:voorkomenidentificatie></o:voorkomen>
    </o:Pand>
  </sl:stand>
</sl:standBestand>`;
}

interface Opzet {
  identificaties: string[];
  selectie: string[];
  verwachteRecords?: number;
  hashOverschrijven?: string;
  ongeldigeXml?: boolean;
}

function draai(opzet: Opzet) {
  const map = mkdtempSync(join(tmpdir(), 'amsterdam-subset-'));
  const bronnen: string[] = [];
  opzet.identificaties.forEach((id, index) => {
    const path = join(map, `pand-${index}.xml`);
    writeFileSync(path, pandXml(id), 'utf-8');
    bronnen.push(path);
  });
  if (opzet.ongeldigeXml) {
    const path = join(map, 'stuk.xml');
    writeFileSync(path, '<sl:stand><o:Pand>', 'utf-8');
    bronnen.push(path);
  }

  const bronbestand = join(map, 'bron.zip');
  execFileSync('python3', [
    '-c',
    'import sys,zipfile; z=zipfile.ZipFile(sys.argv[1],"w",zipfile.ZIP_DEFLATED); [z.write(p,p.rsplit("/",1)[-1]) for p in sys.argv[2:]]; z.close()',
    bronbestand,
    ...bronnen,
  ]);
  const echteHash = createHash('sha256').update(readFileSync(bronbestand)).digest('hex');

  const selectie = [...opzet.selectie].sort();
  const selectiePad = join(map, 'selectie.txt');
  writeFileSync(selectiePad, `${selectie.join('\n')}\n`, 'utf-8');
  const selectieChecksum = createHash('sha256').update(selectie.join('\n'), 'utf-8').digest('hex');
  const closure = join(map, 'closure.json');
  writeFileSync(
    closure,
    JSON.stringify({
      status: 'closure_validated',
      geselecteerdeRecords: opzet.verwachteRecords ?? selectie.length,
      selectieChecksum,
    }),
    'utf-8',
  );

  const output = join(map, 'full-subset.ndjson');
  let exitCode = 0;
  try {
    execFileSync(
      'python3',
      [SCRIPT, bronbestand, selectiePad, closure, output, '--verwachte-hash', opzet.hashOverschrijven ?? echteHash],
      { stdio: 'pipe' },
    );
  } catch (error) {
    exitCode = (error as { status?: number }).status ?? 1;
  }
  const bewijsPad = output.replace(/\.ndjson$/, '.bewijs.json');
  const bewijs = existsSync(bewijsPad) ? JSON.parse(readFileSync(bewijsPad, 'utf-8')) : null;
  const ndjson = existsSync(output) ? readFileSync(output, 'utf-8') : '';
  return { exitCode, bewijs, ndjson };
}

describe('Amsterdam full-subset extractor', () => {
  it('schrijft uitsluitend geselecteerde records met bronpad en volledige XML', () => {
    const resultaat = draai({
      identificaties: ['0363100000000001', '0106100000000001'],
      selectie: ['0363100000000001'],
    });
    expect(resultaat.exitCode).toBe(0);
    expect(resultaat.bewijs.status).toBe('full_subset_validated');
    expect(resultaat.bewijs.records_geschreven).toBe(1);
    expect(resultaat.bewijs.objecttypen).toEqual({ Pand: 1 });
    expect(resultaat.bewijs.prefixverdeling).toEqual({ '0363': 1 });
    expect(resultaat.bewijs.output_sha256).toMatch(/^[0-9a-f]{64}$/);
    const regel = JSON.parse(resultaat.ndjson.trim());
    expect(regel.bronpad).toBe('pand-0.xml');
    expect(regel.xml).toContain('0363100000000001');
  });

  it('stopt bij bronhashdrift', () => {
    const resultaat = draai({
      identificaties: ['0363100000000001'],
      selectie: ['0363100000000001'],
      hashOverschrijven: 'a'.repeat(64),
    });
    expect(resultaat.exitCode).toBe(1);
    expect(resultaat.bewijs.code).toBe('bron_hash_drift');
  });

  it('stopt bij 0 Amsterdamrecords', () => {
    const resultaat = draai({
      identificaties: ['0106100000000001'],
      selectie: ['0363100000000001'],
      verwachteRecords: 1,
    });
    expect(resultaat.exitCode).toBe(1);
    expect(resultaat.bewijs.code).toBe('geen_amsterdamrecords');
  });

  it('stopt bij een parsefout', () => {
    const resultaat = draai({
      identificaties: ['0363100000000001'],
      selectie: ['0363100000000001'],
      ongeldigeXml: true,
    });
    expect(resultaat.exitCode).toBe(1);
    expect(resultaat.bewijs.code).toBe('parsefout');
  });
});
