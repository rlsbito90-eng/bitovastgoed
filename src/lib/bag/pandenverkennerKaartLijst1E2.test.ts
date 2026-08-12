import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const kaart = readFileSync(resolve(process.cwd(), 'src/components/bag/BagPandenKaart.tsx'), 'utf8');
const lijst = readFileSync(resolve(process.cwd(), 'src/components/bag/BagServicePandenlijst.tsx'), 'utf8');

describe('Pandenverkenner 1E.2 kaart-lijst synchronisatie', () => {
  it('laat de kaart een actief pand ontvangen en terugmelden', () => {
    expect(kaart).toContain('actiefPandId?: string | null');
    expect(kaart).toContain('onPandActief?: (bagPandId: string) => void');
    expect(kaart).toContain('onPandActief?.(pand.id)');
    expect(kaart).toContain('geojson.features.find(item => item.properties.id === actiefPandId)');
    expect(kaart).toContain('mapRef.current?.easeTo');
  });

  it('markeert en scrollt een kaartpand naar de geladen lijstpagina wanneer mogelijk', () => {
    expect(lijst).toContain('const [actiefKaartPandId, setActiefKaartPandId]');
    expect(lijst).toContain('pandRijRefs.current.get(bagPandId)?.scrollIntoView');
    expect(lijst).toContain('onPandActief={focusPandVanKaart}');
    expect(lijst).toContain('isKaartActief');
    expect(lijst).toContain('ring-1 ring-primary/40');
  });

  it('biedt vanuit ieder lijstresultaat een expliciete Toon op kaart-actie', () => {
    expect(lijst).toContain('Toon op kaart');
    expect(lijst).toContain('focusPandVanLijst(pand.bagPandId)');
    expect(lijst).toContain("document.getElementById('bag-panden-kaart')");
  });

  it('legt zichtbaar uit wanneer kaart en huidige lijstpagina niet overlappen', () => {
    expect(lijst).toContain('staat niet op de huidige geladen lijstpagina');
    expect(kaart).toContain('staat niet in het huidige geladen kaartgebied');
  });
});
