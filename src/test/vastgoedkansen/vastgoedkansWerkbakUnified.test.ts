import { describe, expect, it } from 'vitest';
import type { Vastgoedkans } from '@/lib/vastgoedkansen';
import { bepaalVastgoedkansWerkbakContext, vastgoedkansPastInView } from '@/lib/acquisitie/vastgoedkansWerkbak';

const basis = (patch: Partial<Vastgoedkans> = {}): Vastgoedkans => ({
  id:'vk-1', kansnummer:'VK-1', adres:'Singel 1', postcode:'1012AA', plaats:'Amsterdam', provincie:'Noord-Holland',
  typeVastgoed:'Gemengd pand', korteOmschrijving:null, herkomst:'bag_selectie', herkomstReferentie:null,
  selectieprofielId:null, selectierunId:null, bagPandId:null, bagVerblijfsobjectId:null, algoritmeScore:80,
  scoreUitleg:null, status:'te_beoordelen', prioriteit:3, eigenaarStatus:'niet_gestart', eigenaarNaam:null,
  eigenaarBron:null, eigenaarRelatieId:null, eigenaarLaatstGecontroleerdOp:null, kadasterStatus:'niet_gestart',
  kadastraleAanduiding:null, kadasterLaatstGecontroleerdOp:null, onderzoeksnotities:null, briefStatus:'niet_gestart',
  briefGeadresseerde:null, briefVerzendwijze:null, briefVerzondenOp:null, briefKenmerk:null, opvolgdatum:null,
  opvolgactie:null, reactieStatus:'geen_reactie', reactieOntvangenOp:null, reactieKanaal:null, reactieSamenvatting:null,
  reactieUitkomst:null, volgendeActieDatum:null, volgendeActieOmschrijving:null, redenInteressant:null, notities:null,
  objectId:null, archivedAt:null, archivedBy:null, archivedReason:null, createdAt:'2026-08-24T10:00:00Z', updatedAt:'2026-08-24T10:00:00Z',
  ...patch,
});

describe('Pandenverkenner sluit aan op bestaande Acquisitieselectie-werkbakken', () => {
  it('zet te beoordelen onder Onderzoeken zonder Kadaster verplicht te maken', () => {
    const ctx=bepaalVastgoedkansWerkbakContext(basis());
    expect(ctx.werkbak).toBe('actie');
    expect(ctx.actieSubfilter).toBe('onderzoeken');
  });
  it('zet briefvoorbereiding in dezelfde Brief voorbereiden-groep', () => {
    const ctx=bepaalVastgoedkansWerkbakContext(basis({status:'brief_voorbereiden'}));
    expect(ctx.actieSubfilter).toBe('brief_voorbereiden');
    expect(vastgoedkansPastInView(ctx,'actie','brief_voorbereiden','te_printen')).toBe(true);
  });
  it('zet een klare brief in Printen & posten', () => {
    const ctx=bepaalVastgoedkansWerkbakContext(basis({briefStatus:'klaar'}));
    expect(ctx.actieSubfilter).toBe('printen_posten');
    expect(ctx.actieCategorie).toBe('gereed_voor_print');
  });
  it('zet afgevallen/gepromoveerd onder Afgehandeld', () => {
    expect(bepaalVastgoedkansWerkbakContext(basis({status:'afgevallen'})).werkbak).toBe('afgehandeld');
    expect(bepaalVastgoedkansWerkbakContext(basis({status:'gepromoveerd'})).werkbak).toBe('afgehandeld');
  });
});