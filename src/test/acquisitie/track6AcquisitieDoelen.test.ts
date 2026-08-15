import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  berekenAcquisitieJaarActuals,
  type AcquisitieMaandKpiRij,
} from '@/hooks/useAcquisitieTrackingPrestaties';

const rij = (partial: Partial<AcquisitieMaandKpiRij>): AcquisitieMaandKpiRij => ({
  maand: '2026-01-01',
  acquisitie_bron: 'vastgoedkansen',
  kadaster_aanvragen: 0,
  kadaster_leveringen: 0,
  kadaster_werkelijke_kosten: 0,
  kadaster_kosten_beste_beschikbaar: 0,
  verzonden_communicaties: 0,
  reacties: 0,
  positieve_reacties: 0,
  retourpost: 0,
  opvolging_aangemaakt: 0,
  opvolging_afgerond: 0,
  definitieve_brieven: 0,
  geprinte_batches: 0,
  ...partial,
});

describe('TRACK-6 — acquisitiedoelen versus actuals', () => {
  it('sommeert beide acquisitiebronnen per jaar en berekent percentages opnieuw uit totalen', () => {
    const actuals = berekenAcquisitieJaarActuals([
      rij({ maand: '2026-01-01', acquisitie_bron: 'vastgoedkansen', verzonden_communicaties: 10, reacties: 5, positieve_reacties: 2, kadaster_aanvragen: 3, kadaster_kosten_beste_beschikbaar: 15 }),
      rij({ maand: '2026-02-01', acquisitie_bron: 'off_market_radar', verzonden_communicaties: 90, reacties: 9, positieve_reacties: 3, kadaster_aanvragen: 7, kadaster_kosten_beste_beschikbaar: 35 }),
      rij({ maand: '2025-12-01', verzonden_communicaties: 999, reacties: 999, positieve_reacties: 999 }),
    ], 2026);

    expect(actuals.verzondenCommunicaties).toBe(100);
    expect(actuals.reacties).toBe(14);
    expect(actuals.positieveReacties).toBe(5);
    expect(actuals.responspercentage).toBe(14);
    expect(actuals.positieveResponspercentage).toBe(5);
    expect(actuals.kadasterAanvragen).toBe(10);
    expect(actuals.kadasterKostenBesteBeschikbaar).toBe(50);
  });

  it('breidt het bestaande jaar_doelen-model additief uit en maakt geen parallelle doeltabel', () => {
    const migration = fs.readFileSync(
      path.join(process.cwd(), 'supabase/migrations/20260815214500_track_6_acquisitie_doelen.sql'),
      'utf8',
    );

    expect(migration).toContain('ALTER TABLE public.jaar_doelen');
    expect(migration).toContain('acquisitie_brieven_doel');
    expect(migration).toContain('acquisitie_responspercentage_doel');
    expect(migration).toContain('acquisitie_kadaster_budget_doel');
    expect(migration).not.toMatch(/create\s+table\s+public\.acquisitie_.*doel/i);
    expect(migration).not.toMatch(/drop\s+table/i);
    expect(migration).not.toMatch(/delete\s+from/i);
    expect(migration).not.toMatch(/update\s+public\./i);
  });

  it('doel-UI schrijft alleen jaar_doelen en start nooit een Kadasteraanvraag', () => {
    const component = fs.readFileSync(
      path.join(process.cwd(), 'src/components/acquisitie/AcquisitieJaarDoelen.tsx'),
      'utf8',
    );

    expect(component).toContain(".from('jaar_doelen')");
    expect(component).toContain('Actuals komen automatisch uit de acquisitie-meetlaag');
    expect(component).not.toContain('kadaster-objectinformatie');
    expect(component).not.toContain('functions.invoke');
  });
});
