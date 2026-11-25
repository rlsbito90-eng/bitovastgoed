import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (path: string) => readFileSync(resolve(process.cwd(),path),'utf8');
describe('Biedformulier en gedeelde kiezer: vaste mobiele scrollstructuur',()=>{
  const offer=read('src/components/biedingen/OfferFormDialog.tsx');
  const picker=read('src/components/forms/EntityPicker.tsx');
  const follow=read('src/components/biedingen/BiedboekOpvolgingDialog.tsx');
  it('uses the established iOS scroll containment hook for all three scroll regions',()=>{
    for(const source of [offer,picker,follow]){
      expect(source).toContain('useModalScrollContainment(scrollBodyRef,');
      expect(source).toContain('ref={scrollBodyRef}');
      expect(source).toContain('overflow-x-hidden overflow-y-auto overscroll-none touch-pan-y');
      expect(source).toContain('overflow-hidden overscroll-none');
    }
  });
  it('keeps the offer header and footer outside the only scroll body',()=>{
    expect(offer).toContain('h-[min(92svh,800px)]');
    expect(offer).toContain('shrink-0 touch-none');
    expect(offer).toContain('flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden');
    expect(offer).toContain('z-10 flex min-w-0 shrink-0');
    expect(offer).toContain('className="min-w-0 max-w-full" type="date"');
    expect(offer).toContain('w-full table-fixed break-words');
  });
  it('keeps required inputs visible and places financial analysis immediately beside the amount',()=>{
    const amount=offer.indexOf('id="bedrag"');
    const analysis=offer.indexOf('aria-label="Biedingsanalyse"');
    const date=offer.indexOf('id="bieddatum"');
    const character=offer.indexOf('Karakter van het bod');
    const secondary=offer.indexOf('Overige boddetails');
    expect(amount).toBeGreaterThan(0);
    expect(analysis).toBeGreaterThan(amount);
    expect(date).toBeGreaterThan(analysis);
    expect(character).toBeGreaterThan(date);
    expect(secondary).toBeGreaterThan(character);
  });
});
