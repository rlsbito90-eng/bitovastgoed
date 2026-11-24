import { describe, expect, it } from 'vitest';
import { compareConditions } from './compareConditions';
import type { Bieding, ExtraVoorwaarde } from './types';

const offer = (patch: Partial<Bieding> = {}): Bieding => ({
  id: 'test', objectId: 'object', relatieId: 'koper', currency: 'EUR',
  bieddatum: '2026-11-24', status: 'ontvangen', offerType: 'schriftelijk',
  financieringsvoorbehoud: 'onbekend', ddVoorbehoud: 'onbekend',
  richting: 'van_koper', isBestOffer: false, isFinalOffer: false,
  createdAt: '2026-11-24', updatedAt: '2026-11-24', ...patch,
});
const viewing: ExtraVoorwaarde = {type:'bezichtiging',karakter:'voorbehoud',toelichting:'Positieve bezichtiging',deadline:null};
const tax: ExtraVoorwaarde = {type:'taxatie',karakter:'voorbehoud',toelichting:'',deadline:null};
const find = (a: Partial<Bieding>,b: Partial<Bieding>,label: string) => compareConditions(offer(a),offer(b)).find(r=>r.label===label);
describe('compareConditions',()=>{
  it('detects explicit financing differences',()=>expect(find({financieringsvoorbehoud:'ja'},{financieringsvoorbehoud:'geen'},'Financiering')?.status).toBe('verschillend'));
  it('does not equate unknown to a waiver',()=>expect(find({extraVoorwaarden:[viewing]},{extraVoorwaarden:null},'Aanvullende voorwaarden')?.status).toBe('onbekend'));
  it('distinguishes explicit absence from an existing condition',()=>expect(find({extraVoorwaarden:[viewing]},{extraVoorwaarden:[]},'Aanvullende voorwaarden')?.status).toBe('verschillend'));
  it('ignores reordering of otherwise identical conditions',()=>expect(find({extraVoorwaarden:[viewing,tax]},{extraVoorwaarden:[tax,viewing]},'Aanvullende voorwaarden')?.status).toBe('gelijk'));
  it('detects changed deadlines',()=>expect(find({extraVoorwaarden:[viewing]},{extraVoorwaarden:[{...viewing,deadline:'2026-11-27'}]},'Aanvullende voorwaarden')?.status).toBe('verschillend'));
  it('does not treat missing free text as removed',()=>expect(find({voorwaarden:'Bezichtiging'},{voorwaarden:null},'Vrije tekstvoorwaarden')?.status).toBe('onbekend'));
});
