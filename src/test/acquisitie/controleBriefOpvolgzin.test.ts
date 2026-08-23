import { describe, expect, it } from 'vitest';
import { bouwBriefTekst } from '@/lib/offMarket/brief';

describe('controlebrief opvolglogica', () => {
  it('houdt ruimte voor een latere opvolging en sluit het contact niet af', () => {
    const tekst = bouwBriefTekst({
      aanhef: 'Geachte heer/mevrouw,',
      objectadres: 'Voorbeeldstraat 10 te Amsterdam',
    });

    expect(tekst).toContain('Indien verkoop op dit moment niet speelt, is dat uiteraard geen probleem.');
    expect(tekst).toContain('kom eventueel op een later moment nog eens bij u terug');
    expect(tekst).not.toContain('als niet verzonden beschouwen');
  });
});
