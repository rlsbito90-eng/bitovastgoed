import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const bron = fs.readFileSync(path.resolve('src/components/acquisitie/VastgoedkansEigenaarRelatieKaart.tsx'), 'utf8');
const activiteitBron = fs.readFileSync(path.resolve('src/components/acquisitie/VastgoedkansEigenaarActiviteitKaart.tsx'), 'utf8');
const crmHook = fs.readFileSync(path.resolve('src/hooks/useEigenaarCrmKoppeling.tsx'), 'utf8');
const brievenBron = fs.readFileSync(path.resolve('src/components/acquisitie/VastgoedkansConceptbriefKaart.tsx'), 'utf8');

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

describe('BUILD 2.0C.5 — expliciete vervolgtaak na Brief 1', () => {
  it('biedt de bestaande taakdialoog pas na geregistreerde verzending aan', () => {
    expect(brievenBron).toContain("brief1?.status === 'verstuurd'");
    expect(brievenBron).toContain('Vervolgtaak aanmaken');
    expect(brievenBron).toContain('onClick={() => setTaakOpen(true)}');
    expect(brievenBron).toContain("import TaakFormDialog from '@/components/forms/TaakFormDialog'");
  });

  it('prefillt relatie, object, opvolgdatum en Vastgoedkans-context zonder automatische taak', () => {
    expect(brievenBron).toContain('defaultRelatieId={kans?.eigenaarRelatieId ?? undefined}');
    expect(brievenBron).toContain('defaultObjectId={kans?.objectId ?? undefined}');
    expect(brievenBron).toContain('defaultDeadline={brief1?.opvolgdatum ?? undefined}');
    expect(brievenBron).toContain('defaultType="Follow-up"');
    expect(brievenBron).not.toContain('addTaak(');
    expect(brievenBron).not.toContain('updateKans(');
    expect(brievenBron).toContain('Er wordt nooit automatisch een taak of commerciële status aangemaakt.');
  });
});
