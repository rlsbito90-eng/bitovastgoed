import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { valideerBriefcontract, valideerGeadresseerdeSnapshot } from '@/lib/offMarket/acquisitie/productiekernContract';
import { bouwProductiekernSnapshotsUitLegacyBrief } from '@/lib/offMarket/acquisitie/bestaandConceptNaarProductie';

const migration=fs.readFileSync(path.join(process.cwd(),'supabase/migrations/20260824090000_pandenverkenner_productiekern_bronidentiteit.sql'),'utf8');
const bulkKadaster=fs.readFileSync(path.join(process.cwd(),'src/components/acquisitie/PandenverkennerBulkKadasterDialog.tsx'),'utf8');

describe('Pandenverkenner productiekernbron',()=>{
  const basis={id:'b1',briefnummer:null,selectieId:'s1',objectId:null,relatieId:null,actieveVersie:null,status:'concept' as const,vervangingVanBriefId:null,definitiefOp:null,vergrendeldOp:null,annuleringsreden:null};
  it('accepteert exact één Vastgoedkans als dossierbron',()=>{expect(valideerBriefcontract({...basis,signaalId:null,vastgoedkansId:'k1'})).toEqual([])});
  it('weigert twee of nul dossierbronnen',()=>{expect(valideerBriefcontract({...basis,signaalId:'sig',vastgoedkansId:'k1'})).toEqual(expect.arrayContaining([expect.stringMatching(/Exact één dossierbron/)]));expect(valideerBriefcontract({...basis,signaalId:null,vastgoedkansId:null})).toEqual(expect.arrayContaining([expect.stringMatching(/Exact één dossierbron/)]))});
  it('accepteert eigenaar-objectadres zonder verzonnen eigenaarnaam',()=>{expect(valideerGeadresseerdeSnapshot({naam:null,bedrijfsnaam:null,geadresseerdeLabel:'Aan de eigenaar van',adresseerwijze:'eigenaar_objectadres',aanhef:'Geachte heer/mevrouw,',straatHuisnummer:'Straat 1',postcode:'1000 AA',plaats:'Amsterdam',land:'Nederland',bron:'objectadres',verificatiestatus:'onbekend',relatieId:null})).toEqual([])});
  it('bouwt objectpostsnapshot uit bestaand Pandenverkenner-concept',()=>{const x=bouwProductiekernSnapshotsUitLegacyBrief({id:'b1',status:'concept',kanaal:'post',eigenaar_naam:null,eigenaar_bedrijfsnaam:null,geadresseerde_label:'Aan de eigenaar van',adresseerwijze:'eigenaar_objectadres',verzendadres:'Straat 1\n1000 AA Amsterdam',brieftekst:'Tekst'});expect(x.geadresseerde.naam).toBeNull();expect(x.geadresseerde.geadresseerdeLabel).toBe('Aan de eigenaar van');expect(x.geadresseerde.adresseerwijze).toBe('eigenaar_objectadres')});
});

describe('batch- en Kadasterveiligheid',()=>{
  it('verbiedt gemengde Radar/Pandenverkenner-batches in SQL',()=>{expect(migration).toContain('gemengde_bronnen_in_batch_niet_toegestaan');expect(migration).toContain("bron_type in ('off_market_radar', 'pandenverkenner')")});
  it('legt Vastgoedkansbron vast in productie-events',()=>{expect(migration).toContain('vastgoedkans_id');expect(migration).toContain("'pandenverkenner'")});
  it('bulk Kadaster vereist aparte kostenbevestiging en vraagt alleen Rechten',()=>{expect(bulkKadaster).toContain('Kosten bevestigen & aanvragen');expect(bulkKadaster).toContain("producten:['rechten']");expect(bulkKadaster).toContain('setBevestig(true)')});
});
