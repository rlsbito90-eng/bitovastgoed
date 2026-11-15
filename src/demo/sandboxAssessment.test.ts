import { describe, expect, it } from 'vitest';
import { beoordeelSandboxBelegger, controleerDemoBron } from './sandboxAssessment';
import { nieuweDemoStaat } from './sandboxModel';

describe('Eén bron per fictief object, meerdere beleggers',()=>{
  it('beoordeelt bedrijfscomplex 75/25 als passend voor bedrijfsruimte, woningprofiel als controle nodig',()=>{
    const s=nieuweDemoStaat();
    expect(beoordeelSandboxBelegger(s,s.beleggers[0]).statusLabel).toBe('Voldoet');
    expect(beoordeelSandboxBelegger(s,s.beleggers[1]).statusLabel).toBe('Controle nodig');
  });
  it('65/25/10 valt bij harde 70%-eis af; de andere functies tellen samen mee',()=>{
    const s=nieuweDemoStaat();s.scenario='gemengd';
    const x=beoordeelSandboxBelegger(s,s.beleggers[0]);
    expect(x.beoordeling.hardeAfwijzing).toBe(true);
    expect(x.aandeel).toBe(65);
  });
  it('geuzenweg levert 100% wonen GBO, maar geen fictief VVO-bewijs',()=>{
    const s=nieuweDemoStaat();s.scenario='geuzenweg';
    expect(beoordeelSandboxBelegger(s,s.beleggers[1]).statusLabel).toBe('Voldoet');
    expect(beoordeelSandboxBelegger(s,s.beleggers[0]).statusLabel).toBe('Controle nodig');
  });
  it('wijzigingen in oppervlakte vragen automatisch controle bij verschil met objecttotaal',()=>{
    const s=nieuweDemoStaat();
    s.onderdelen.bedrijfscomplex[0].oppervlakte='650';
    expect(beoordeelSandboxBelegger(s,s.beleggers[0]).statusLabel).toBe('Controle nodig');
    s.onderdelen.bedrijfscomplex[1].oppervlakte='350';
    expect(beoordeelSandboxBelegger(s,s.beleggers[0]).statusLabel).toBe('Afgevallen — harde eis');
  });
  it('verkeerd meetbasis, lege m2, niet-afgebakende bron en leeg dossier geven controle nodig',()=>{
    const s=nieuweDemoStaat();
    s.onderdelen.bedrijfscomplex[0].meetbasis='gbo';
    expect(controleerDemoBron('bedrijfscomplex',s.onderdelen.bedrijfscomplex).status).toBe('controle_nodig');
    s.onderdelen.bedrijfscomplex[0].meetbasis='vvo';
    s.onderdelen.bedrijfscomplex[0].oppervlakte='';
    expect(controleerDemoBron('bedrijfscomplex',s.onderdelen.bedrijfscomplex).status).toBe('controle_nodig');
    expect(controleerDemoBron('onbekend',s.onderdelen.onbekend).status).toBe('controle_nodig');
    expect(controleerDemoBron('bedrijfscomplex',[]).status).toBe('controle_nodig');
  });
  it('een voorkeur wordt niet onterecht een harde afwijzing',()=>{
    const s=nieuweDemoStaat();s.scenario='gemengd';s.beleggers[0].sterkte='voorkeur';
    const x=beoordeelSandboxBelegger(s,s.beleggers[0]);
    expect(x.beoordeling.hardeAfwijzing).toBe(false);
    expect(x.statusLabel).toBe('Afwijkende voorkeur');
  });
  it('onbekende eis is nooit automatisch 0%',()=>{
    const s=nieuweDemoStaat();s.beleggers[0].percentage='';
    expect(beoordeelSandboxBelegger(s,s.beleggers[0]).statusLabel).toBe('Controle nodig');
  });
});
