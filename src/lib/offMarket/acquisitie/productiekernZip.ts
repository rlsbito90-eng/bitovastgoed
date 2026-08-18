export interface ProductiekernZipBestand {
  naam: string;
  bytes: Uint8Array;
}

const encoder = new TextEncoder();

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function dosDatumTijd(datum: Date): { tijd: number; dag: number } {
  const jaar = Math.max(1980, datum.getFullYear());
  return {
    tijd: (datum.getHours() << 11) | (datum.getMinutes() << 5) | Math.floor(datum.getSeconds() / 2),
    dag: ((jaar - 1980) << 9) | ((datum.getMonth() + 1) << 5) | datum.getDate(),
  };
}

function schrijfU16(view: DataView, offset: number, waarde: number): void {
  view.setUint16(offset, waarde & 0xffff, true);
}

function schrijfU32(view: DataView, offset: number, waarde: number): void {
  view.setUint32(offset, waarde >>> 0, true);
}

/**
 * Maakt een standaards ZIP met store-methode (geen compressie). De bestanden
 * zijn al PDF/CSV en meestal nauwelijks verder comprimeerbaar; store houdt de
 * implementatie klein, deterministisch en dependency-vrij.
 */
export function bouwProductiekernZip(
  bestanden: readonly ProductiekernZipBestand[],
  datum: Date = new Date(),
): Blob {
  if (bestanden.length === 0) throw new Error('ZIP vereist minimaal één bestand.');
  if (bestanden.length > 1000) throw new Error('ZIP bevat te veel bestanden.');

  const namen = new Set<string>();
  const voorbereid = bestanden.map((bestand) => {
    const naam = bestand.naam.trim();
    if (!naam || naam.includes('..') || naam.startsWith('/') || naam.includes('\\')) {
      throw new Error('ZIP bevat een ongeldige bestandsnaam.');
    }
    if (namen.has(naam)) throw new Error(`ZIP bevat dubbele bestandsnaam: ${naam}.`);
    namen.add(naam);
    const naamBytes = encoder.encode(naam);
    if (naamBytes.length > 0xffff) throw new Error('ZIP-bestandsnaam is te lang.');
    return {
      naamBytes,
      bytes: bestand.bytes,
      crc: crc32(bestand.bytes),
    };
  });

  const { tijd, dag } = dosDatumTijd(datum);
  const lokaalTotaal = voorbereid.reduce((som, b) => som + 30 + b.naamBytes.length + b.bytes.length, 0);
  const centraalTotaal = voorbereid.reduce((som, b) => som + 46 + b.naamBytes.length, 0);
  const totaal = lokaalTotaal + centraalTotaal + 22;
  const output = new Uint8Array(totaal);
  const view = new DataView(output.buffer);

  const offsets: number[] = [];
  let cursor = 0;
  for (const bestand of voorbereid) {
    offsets.push(cursor);
    schrijfU32(view, cursor, 0x04034b50);
    schrijfU16(view, cursor + 4, 20);
    schrijfU16(view, cursor + 6, 0x0800); // UTF-8 bestandsnamen
    schrijfU16(view, cursor + 8, 0); // store
    schrijfU16(view, cursor + 10, tijd);
    schrijfU16(view, cursor + 12, dag);
    schrijfU32(view, cursor + 14, bestand.crc);
    schrijfU32(view, cursor + 18, bestand.bytes.length);
    schrijfU32(view, cursor + 22, bestand.bytes.length);
    schrijfU16(view, cursor + 26, bestand.naamBytes.length);
    schrijfU16(view, cursor + 28, 0);
    cursor += 30;
    output.set(bestand.naamBytes, cursor);
    cursor += bestand.naamBytes.length;
    output.set(bestand.bytes, cursor);
    cursor += bestand.bytes.length;
  }

  const centraalStart = cursor;
  voorbereid.forEach((bestand, index) => {
    schrijfU32(view, cursor, 0x02014b50);
    schrijfU16(view, cursor + 4, 20);
    schrijfU16(view, cursor + 6, 20);
    schrijfU16(view, cursor + 8, 0x0800);
    schrijfU16(view, cursor + 10, 0);
    schrijfU16(view, cursor + 12, tijd);
    schrijfU16(view, cursor + 14, dag);
    schrijfU32(view, cursor + 16, bestand.crc);
    schrijfU32(view, cursor + 20, bestand.bytes.length);
    schrijfU32(view, cursor + 24, bestand.bytes.length);
    schrijfU16(view, cursor + 28, bestand.naamBytes.length);
    schrijfU16(view, cursor + 30, 0);
    schrijfU16(view, cursor + 32, 0);
    schrijfU16(view, cursor + 34, 0);
    schrijfU16(view, cursor + 36, 0);
    schrijfU32(view, cursor + 38, 0);
    schrijfU32(view, cursor + 42, offsets[index]);
    cursor += 46;
    output.set(bestand.naamBytes, cursor);
    cursor += bestand.naamBytes.length;
  });

  const centraalLengte = cursor - centraalStart;
  schrijfU32(view, cursor, 0x06054b50);
  schrijfU16(view, cursor + 4, 0);
  schrijfU16(view, cursor + 6, 0);
  schrijfU16(view, cursor + 8, voorbereid.length);
  schrijfU16(view, cursor + 10, voorbereid.length);
  schrijfU32(view, cursor + 12, centraalLengte);
  schrijfU32(view, cursor + 16, centraalStart);
  schrijfU16(view, cursor + 20, 0);

  return new Blob([output.buffer], { type: 'application/zip' });
}
