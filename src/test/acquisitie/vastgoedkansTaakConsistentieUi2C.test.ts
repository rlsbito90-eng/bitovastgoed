import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const pagina = fs.readFileSync(path.join(process.cwd(), 'src/pages/VastgoedkansenPage.tsx'), 'utf8');

describe('BUILD 2.0C — taak/werkbak consistentie in lijst', () => {
  it('toont prioriteit van de leidende centrale taak', () => {
    expect(pagina).toContain('VASTGOEDKANS_TAAK_PRIORITEIT_LABEL[leidendeTaak.prioriteit]');
    expect(pagina).toContain('Prioriteit {VASTGOEDKANS_TAAK_PRIORITEIT_LABEL[leidendeTaak.prioriteit]}');
  });

  it('maakt inconsistenties vindbaar via een aparte Controle nodig-filter met telling', () => {
    expect(pagina).toContain('data-testid="vastgoedkansen-controle-nodig-filter"');
    expect(pagina).toContain('Controle nodig {controleNodigIds.size}');
    expect(pagina).toContain('basisList.filter((kans) => controleNodigIds.has(kans.id))');
    expect(pagina).toContain('Geen open taken op afgesloten dossiers. Er is nu niets te controleren.');
  });

  it('houdt Controle nodig exclusief ten opzichte van de gewone werkbakken', () => {
    expect(pagina).toContain('setAlleenControleNodig(false)');
    expect(pagina).toContain("setWerkbakState('alles')");
    expect(pagina).toContain('werkbak === status && !alleenControleNodig');
  });

  it('toont een read-only waarschuwing voor een inconsistent afgesloten dossier', () => {
    expect(pagina).toContain('bepaalVastgoedkansTaakConsistentie(kans, leidendeTaak)');
    expect(pagina).toContain('data-testid="vastgoedkans-taak-consistentie-waarschuwing"');
    expect(pagina).toContain('controleer of de taak nog nodig is');
  });
});
