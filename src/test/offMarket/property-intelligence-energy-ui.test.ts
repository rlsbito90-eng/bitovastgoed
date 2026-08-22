import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const hook = fs.readFileSync(path.join(root, 'src/hooks/useVastgoedEnergie.ts'), 'utf8');
const card = fs.readFileSync(path.join(root, 'src/components/offmarket/bag/EnergiePrestatieKaart.tsx'), 'utf8');
const bag = fs.readFileSync(path.join(root, 'src/components/offmarket/bag/BagOverzichtKaart.tsx'), 'utf8');

describe('Vastgoed Intelligence energie-UI', () => {
  it('leest snapshots zonder automatisch EP-Online aan te roepen', () => {
    expect(hook).toContain("from('vastgoed_energielabel_snapshots')");
    expect(hook).toContain("supabase.functions.invoke('vastgoed-energy-verrijk'");
    expect(card).toContain('Energielabel ophalen');
    expect(card).toContain('Ophalen gebeurt alleen na een expliciete klik.');
  });

  it('koppelt energie aan het geselecteerde BAG-doelobject', () => {
    expect(bag).toContain('bagVboId={gekozenVboId}');
    expect(bag).toContain('bagNummeraanduidingId={gekozenNaId}');
    expect(card).toContain('gekoppeld via BAG-VBO');
  });

  it('bevat geen automatische Kadasteractie', () => {
    expect(hook).not.toMatch(/off-market-kadaster|kadaster-ophalen|kadaster-data/i);
    expect(card).not.toMatch(/off-market-kadaster|kadaster-ophalen|kadaster-data/i);
  });
});
