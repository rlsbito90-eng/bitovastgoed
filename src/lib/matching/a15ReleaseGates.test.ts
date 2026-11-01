import {describe,it,expect} from 'vitest';
import {beoordeelA15Vrijgave} from './a15ReleaseGates';
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
  it('archiveerde relaties tellen niet als te classificeren actieve relaties',()=>{
    const r=beoordeelA15Vrijgave(impact(),[
      {partijprofiel:null,softDeletedAt:'2026-10-01'},
      {partijprofiel:null},
    ]);
    expect(r.controles.find(x=>x.id==='classificatie')?.aantal).toBe(1);
  });
});
