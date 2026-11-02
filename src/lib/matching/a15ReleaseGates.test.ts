import {describe,it,expect} from 'vitest';
import {beoordeelA15Vrijgave,beoordeelA15UitrolFasen} from './a15ReleaseGates';
import type {A15Impact} from './a15ImpactPreview';

const impact=(overrides:Partial<A15Impact>={}):A15Impact=>({
  beschikbareObjecten:0,huidigeKandidaatKoppelingen:0,gesimuleerdeKandidaatKoppelingen:0,
  verdwenenKoppelingen:0,nieuweKoppelingen:0,objectenMetVerschil:0,
  veranderdeKoperidentiteiten:0,veranderdeBesteRoutes:0,
  veranderdeMatchkwalificaties:0,veranderdeBevestigingen:0,verschillen:[],
  lopendePipelineKoppelingen:0,relatiesMetLopendePipelineZonderProfiel:0,
  lopendePipelineBuitenVergelijking:0,lopendePipelineMetVerschil:0,
  pipelineZonderGegenereerdeMatch:0,pipelineWegvallendeRoutes:0,
  pipelineGewijzigdeKoperverwijzingen:0,pipelineTeBeoordelen:0,
  pipelineControles:[],...overrides,
});

describe('A15.6 veilige overgang zonder stilzwijgende vrijgave',()=>{
  it('blokkeert bij ontbrekende relatieclassificaties en belangrijke pipelineverschillen',()=>{
    const r=beoordeelA15Vrijgave(
      impact({pipelineTeBeoordelen:2,pipelineWegvallendeRoutes:1,
        veranderdeKoperidentiteiten:1,lopendePipelineBuitenVergelijking:0}),
      [{partijprofiel:null},{partijprofiel:'ontwikkelaar'}],
    );
    expect(r.veiligVoorAutomatischeOpschoning).toBe(false);
    expect(r.controles.find(x=>x.id==='classificatie')?.aantal).toBe(1);
    expect(r.controles.find(x=>x.id==='wegvallende_route')?.open).toBe(true);
    expect(r.controles.find(x=>x.id==='koperidentiteit')?.open).toBe(true);
  });
  it('geeft ook bij nul berekende dataverschillen geen automatische migratievrijgave',()=>{
    const r=beoordeelA15Vrijgave(impact(),[{partijprofiel:'belegger'}]);
    expect(r.openDatacontroles).toBe(0);
    expect(r.openHandmatigeControles).toBe(3);
    expect(r.veiligVoorAutomatischeOpschoning).toBe(false);
    expect(r.controles.find(x=>x.id==='fiat')?.open).toBe(true);
  });
  it('A15.12 blokkeert oude pipelinekoppelingen op gearchiveerde objecten',()=>{
    const vrijgave=beoordeelA15Vrijgave(impact(),[{partijprofiel:'belegger'}],{
      lopendePosities:5,positiesOpGearchiveerdeObjecten:2,
      positiesZonderGeladenObject:1,positiesZonderGeladenRelatie:0,
      positiesMetGearchiveerdeRelatie:0,teVerifiërenPosities:3,
    });
    expect(vrijgave.openDatacontroles).toBe(2);
    expect(vrijgave.controles.find(x=>x.id==='archief_object')).toMatchObject({
      aantal:2,open:true,
    });
    expect(vrijgave.controles.find(x=>x.id==='object_ontbreekt')).toMatchObject({
      aantal:1,open:true,
    });
    expect(vrijgave.veiligVoorAutomatischeOpschoning).toBe(false);
    expect(vrijgave.openHandmatigeControles).toBe(3);
  });
  it('A15.12 nul in referentie-audit maakt vrijgave nog niet automatisch veilig',()=>{
    const vrijgave=beoordeelA15Vrijgave(impact(),[{partijprofiel:'belegger'}],{
      lopendePosities:0,positiesOpGearchiveerdeObjecten:0,
      positiesZonderGeladenObject:0,positiesZonderGeladenRelatie:0,
      positiesMetGearchiveerdeRelatie:0,teVerifiërenPosities:0,
    });
    expect(vrijgave.openDatacontroles).toBe(0);
    expect(vrijgave.openHandmatigeControles).toBe(3);
    expect(vrijgave.veiligVoorAutomatischeOpschoning).toBe(false);
  });
  it('A15.13 registreert expliciet gewijzigde koperverwijzingen bij bestaande kandidaten',()=>{
    const vrijgave=beoordeelA15Vrijgave(
      impact({pipelineGewijzigdeKoperverwijzingen:2}),
      [{partijprofiel:'ontwikkelende_belegger'}],
    );
    expect(vrijgave.controles.find(c=>c.id==='pipeline_koperverwijzing'))
      .toMatchObject({aantal:2,open:true});
    expect(vrijgave.openDatacontroles).toBe(1);
    expect(beoordeelA15UitrolFasen(vrijgave).find(f=>f.id==='matching')?.status)
      .toBe('geblokkeerd');
  });
  it('A15.13 schema/feature uitrol blijft gescheiden van 92 te classificeren relaties',()=>{
    const vrijgave=beoordeelA15Vrijgave(impact(),[
      ...Array.from({length:92},()=>({partijprofiel:null})),
      {partijprofiel:'ontwikkelaar'},
    ]);
    const fasen=beoordeelA15UitrolFasen(vrijgave);
    expect(fasen.map(x=>x.status))
      .toEqual(['apart_goedkeuren','apart_goedkeuren','geblokkeerd','geblokkeerd']);
    expect(fasen[1].reden).toContain('bestaande matching blijft ongewijzigd');
    expect(fasen[2].reden).toContain('gegevenscontroles');
  });
  it('A15.13 zelfs nul open data is geen automatische toestemming voor matching of opschoning',()=>{
    const vrijgave=beoordeelA15Vrijgave(impact(),[{partijprofiel:'fonds'}]);
    const fasen=beoordeelA15UitrolFasen(vrijgave);
    expect(fasen[2].status).toBe('apart_goedkeuren');
    expect(fasen[3].status).toBe('geblokkeerd');
    expect(fasen.map(x=>x.status)).not.toContain('vrijgegeven');
  });
  it('archiveerde relaties tellen niet als te classificeren actieve relaties',()=>{
    const r=beoordeelA15Vrijgave(impact(),[
      {partijprofiel:null,softDeletedAt:'2026-10-01'},
      {partijprofiel:null},
    ]);
    expect(r.controles.find(x=>x.id==='classificatie')?.aantal).toBe(1);
  });
});
