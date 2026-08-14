import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const bron = fs.readFileSync(path.resolve('src/components/acquisitie/VastgoedkansEigenaarRelatieKaart.tsx'), 'utf8');
const activiteitBron = fs.readFileSync(path.resolve('src/components/acquisitie/VastgoedkansEigenaarActiviteitKaart.tsx'), 'utf8');
const crmHook = fs.readFileSync(path.resolve('src/hooks/useEigenaarCrmKoppeling.tsx'), 'utf8');
const brievenBron = fs.readFileSync(path.resolve('src/components/acquisitie/VastgoedkansConceptbriefKaart.tsx'), 'utf8');
const briefTaakBron = fs.readFileSync(path.resolve('src/components/acquisitie/VastgoedkansBriefOpvolgTaak.tsx'), 'utf8');
const briefMatchBron = fs.readFileSync(path.resolve('src/lib/acquisitie/briefEigenaarMatch.ts'), 'utf8');

describe('BUILD 2.0B.3 — eigenaar-specifieke CRM-koppeling', () => {
  it('schrijft CRM-koppelingen op eigenaren en niet als nieuwe dossierkoppeling', () => {
    expect(crmHook).toContain(".from('eigenaren')");
    expect(crmHook).toContain('.update({ crm_relatie_id: relatieId })');
    expect(bron).toContain('useEigenaarCrmKoppeling');
    expect(bron).not.toContain('await updateEigenaarRelatie(vastgoedkansId, relatie.id)');
  });

  it('maakt iedere voorgestelde match expliciet eigenaar-specifiek', () => {
    expect(bron).toContain('Koppel aan eigenaar');
    expect(bron).toContain('CRM-relatie van deze eigenaar');
    expect(bron).toContain('crm_relatie_id');
    expect(bron).toContain('vindCrmMatches(voorstel, relaties)');
  });

  it('houdt oude dossierkoppelingen zichtbaar en migreert ze alleen bewust', () => {
    expect(bron).toContain('Oude dossierniveau CRM-koppeling');
    expect(bron).toContain('Overzetten naar');
    expect(bron).toContain('await updateEigenaarRelatie(vastgoedkansId, null)');
    expect(bron).not.toContain('automatisch overgezet');
  });

  it('laat acquisitie-opvolging eigenaargebonden en zonder verplichte CRM-relatie bestaan', () => {
    expect(bron).toContain('VastgoedkansEigenaarActiviteitKaart');
    expect(activiteitBron).toContain('relatieId: eigenaar.crm_relatie_id');
    expect(activiteitBron).toContain('Een CRM-relatie is niet vereist');
    expect(bron).not.toContain('<QuickCreateRelationDialog');
    expect(bron).not.toContain('addRelatie(');
  });
});

describe('BUILD 2.0C.5 — eigenaargebonden vervolgtaak na Brief 1', () => {
  it('biedt eigenaaropvolging pas na geregistreerde verzending van Brief 1 aan', () => {
    expect(brievenBron).toContain("brief1?.status === 'verstuurd'");
    expect(brievenBron).toContain('VastgoedkansBriefOpvolgTaak');
    expect(brievenBron).not.toContain("import TaakFormDialog from '@/components/forms/TaakFormDialog'");
    expect(briefTaakBron).toContain('Vervolgtaak aanmaken');
  });

  it('koppelt de taak aan eigenaar en Vastgoedkans en neemt CRM alleen eigenaar-specifiek mee', () => {
    expect(briefTaakBron).toContain('eigenaarId: eigenaar.id');
    expect(briefTaakBron).toContain('vastgoedkansId');
    expect(briefTaakBron).toContain('relatieId: eigenaar.crmRelatieId');
    expect(briefTaakBron).toContain("type: 'Follow-up'");
    expect(briefTaakBron).toContain('brief.opvolgdatum');
    expect(briefTaakBron).not.toContain('eigenaarRelatieId');
  });

  it('herkent alleen een unieke briefgeadresseerde en kiest anders bewust', () => {
    expect(briefTaakBron).toContain("from '@/lib/acquisitie/briefEigenaarMatch'");
    expect(briefMatchBron).toContain('export function vindBriefEigenaar');
    expect(briefMatchBron).toContain('if (exact.length === 1) return exact[0]');
    expect(briefMatchBron).toContain('return naamMatches.length === 1 ? naamMatches[0] : null');
    expect(briefTaakBron).toContain('Kies bewust de geadresseerde eigenaar');
  });

  it('verstuurt niets en verandert geen commerciële status bij taakcreatie', () => {
    expect(briefTaakBron).toContain('er wordt niets verzonden en geen commerciële status gewijzigd');
    expect(briefTaakBron).not.toContain('updateKans(');
    expect(briefTaakBron).not.toContain('useKadasterObjectinformatie');
  });
});
