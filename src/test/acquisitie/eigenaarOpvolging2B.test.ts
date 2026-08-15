import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const migration = fs.readFileSync(path.join(process.cwd(), 'supabase/migration-archive/pre-baseline-snapshot/20260814220500_eigenaar_vastgoedkans_activiteit.sql'), 'utf8');
const hook = fs.readFileSync(path.join(process.cwd(), 'src/hooks/useVastgoedkansEigenaarActiviteit.tsx'), 'utf8');
const kaart = fs.readFileSync(path.join(process.cwd(), 'src/components/acquisitie/VastgoedkansEigenaarActiviteitKaart.tsx'), 'utf8');
const eigenaarKaart = fs.readFileSync(path.join(process.cwd(), 'src/components/acquisitie/VastgoedkansEigenaarRelatieKaart.tsx'), 'utf8');

describe('BUILD 2.0B — eigenaaropvolging zonder verplichte CRM-relatie', () => {
  it('hergebruikt contact_moments en taken met eigenaar- en Vastgoedkans-koppelingen', () => {
    expect(migration).toContain('alter table public.contact_moments');
    expect(migration).toContain('add column if not exists eigenaar_id uuid references public.eigenaren(id)');
    expect(migration).toContain('add column if not exists vastgoedkans_id uuid references public.vastgoedkansen(id)');
    expect(migration).toContain('alter table public.taken');
    expect(migration).not.toContain('create table public.eigenaar_contact');
  });

  it('schrijft eigenaar_id en vastgoedkans_id zonder dat relatie_id verplicht is', () => {
    expect(hook).toContain(".from('contact_moments')");
    expect(hook).toContain(".from('taken')");
    expect(hook).toContain('eigenaar_id: input.eigenaarId');
    expect(hook).toContain('vastgoedkans_id: input.vastgoedkansId');
    expect(hook).toContain('relatie_id: input.relatieId || null');
  });

  it('laat bij één eigenaar direct opvolgen en kiest bij meerdere nooit automatisch', () => {
    expect(kaart).toContain('if (eigenaren.length === 1) setEigenaarId(eigenaren[0].id)');
    expect(kaart).toContain('Kies bewust een eigenaar');
    expect(kaart).toContain('Bij meerdere rechthebbenden wordt geen eigenaar automatisch gekozen');
    expect(kaart).toContain('Een CRM-relatie is niet vereist');
  });

  it('kan contactmoment plus vervolgtaak in dezelfde eigenaarcontext registreren', () => {
    expect(kaart).toContain('Direct een vervolgtaak aanmaken');
    expect(kaart).toContain('await activiteit.voegContactToe.mutateAsync');
    expect(kaart).toContain('await activiteit.voegTaak.mutateAsync');
    expect(kaart).toContain("type: 'Follow-up'");
  });

  it('toont eigenaaropvolging onafhankelijk van een CRM-koppeling', () => {
    expect(eigenaarKaart).toContain('<VastgoedkansEigenaarActiviteitKaart');
    expect(eigenaarKaart).toContain('eigenaren={centraleEigenaren}');
    expect(eigenaarKaart).toContain('Nog geen bestaande CRM-relatie aan een eigenaar gekoppeld');
    expect(eigenaarKaart).not.toContain('{gekoppeld && (');
  });
});
