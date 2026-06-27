// Tests voor SignaalOutreachInzicht — read-only paneel.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { maakTestSignaal } from '../mobile/_fixture';

let mockBrieven: any[] = [];
let mockEvents: any[] = [];
let mockTaken: any[] = [];
const updateMock = vi.fn();

vi.mock('@/hooks/useOffMarketBrieven', () => ({
  useOffMarketBrievenForSignaal: () => ({ data: mockBrieven, isLoading: false }),
}));
vi.mock('@/hooks/useBriefEvents', () => ({
  useBriefEventsForSignaal: () => ({ data: mockEvents, isLoading: false }),
}));
vi.mock('@/hooks/useDataStore', () => ({
  useDataStore: () => ({
    taken: mockTaken,
    contactMoments: [],
    getContactMomentsFor: () => [],
    addTaak: vi.fn(),
  }),
}));
vi.mock('@/hooks/useOffMarketSignalen', () => ({
  useUpdateOffMarketSignaal: () => ({ mutateAsync: updateMock, isPending: false }),
}));

import SignaalOutreachInzicht from '@/components/offmarket/SignaalOutreachInzicht';

function wrap(node: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <QueryClientProvider client={qc}>
      <MemoryRouter>{node}</MemoryRouter>
    </QueryClientProvider>
  );
}

function brief(over: any = {}): any {
  return {
    id: over.id ?? `b-${Math.random().toString(36).slice(2, 8)}`,
    signaal_id: 'sig-test-001',
    eigenaar_naam: null,
    eigenaar_bedrijfsnaam: null,
    verzendadres: 'Voorbeeldweg 1, 1000 AA Testdorp',
    objectadres: null,
    objectomschrijving: null,
    aanhef: null,
    onderwerp: null,
    brieftekst: 't',
    status: 'concept',
    verzonden_op: null,
    aangemaakt_door: null,
    created_at: '2026-06-10T10:00:00Z',
    updated_at: '2026-06-10T10:00:00Z',
    archived_at: null,
    archived_reason: null,
    kanaal: 'post',
    campagne_stap: 'brief_1',
    geadresseerde_key: 'g-1',
    verzendstatus: 'concept',
    opvolgdatum: null,
    responsstatus: null,
    ...over,
  };
}

function ev(over: any = {}): any {
  return {
    id: over.id ?? `e-${Math.random().toString(36).slice(2, 8)}`,
    signaal_id: 'sig-test-001',
    brief_id: null,
    geadresseerde_key: null,
    campagne_stap: null,
    kanaal: 'post',
    event_type: 'posted',
    event_date: '2026-06-12T10:00:00Z',
    status: null,
    metadata: {},
    created_at: '2026-06-12T10:00:00Z',
    created_by: null,
    ...over,
  };
}

beforeEach(() => {
  mockBrieven = [];
  mockEvents = [];
  mockTaken = [];
  updateMock.mockClear();
});

describe('SignaalOutreachInzicht', () => {
  it('lege staat — toont 0 geadresseerden en crasht niet', () => {
    const sig = maakTestSignaal();
    render(wrap(<SignaalOutreachInzicht signaal={sig} />));
    expect(screen.getByTestId('outreach-inzicht')).toBeInTheDocument();
    expect(screen.getByTestId('outreach-telling').textContent).toMatch(/0 geadresseerden, 0 benaderd/);
    expect(screen.getByTestId('outreach-geen-geadresseerden')).toBeInTheDocument();
    expect(screen.getByTestId('outreach-eerstvolgende-taak').textContent).toMatch(/Geen open opvolging/);
  });

  it('één geadresseerde — Brief 1 verstuurd + open opvolging', () => {
    const sig = maakTestSignaal();
    mockBrieven = [
      brief({
        id: 'b1', status: 'verstuurd',
        verzonden_op: '2026-06-12T10:00:00Z',
        postdatum: '2026-06-12',
        opvolgdatum: '2099-12-31',
        verzendstatus: 'gepost',
        eigenaar_naam: 'Voorbeeld Persoon',
        geadresseerde_key: 'g-1',
      }),
    ];
    render(wrap(<SignaalOutreachInzicht signaal={sig} />));
    expect(screen.getByTestId('outreach-telling').textContent).toMatch(/1 geadresseerden, 1 benaderd/);
    const rij = screen.getByTestId('outreach-geadresseerde-g-1');
    expect(within(rij).getByText(/Voorbeeld Persoon/)).toBeInTheDocument();
    expect(within(rij).getByText(/Laatst verzonden/)).toBeInTheDocument();
    expect(within(rij).getByText(/dagen geleden|dag geleden/)).toBeInTheDocument();
    expect(screen.getByTestId('outreach-opvolging-g-1').textContent).toMatch(/Opvolgen op/);
  });

  it('meerdere geadresseerden — gemengd post/e-mail; benaderd-telling correct', () => {
    const sig = maakTestSignaal();
    mockBrieven = [
      // g-1: post verstuurd
      brief({ id: 'b1', status: 'verstuurd', verzonden_op: '2026-06-12T10:00:00Z',
        verzendstatus: 'gepost', eigenaar_naam: 'Persoon A', geadresseerde_key: 'g-1' }),
      // g-2: e-mail verstuurd
      brief({ id: 'b2', status: 'verstuurd', verzonden_op: '2026-06-13T10:00:00Z',
        verzendstatus: 'verzonden', kanaal: 'email', campagne_stap: 'email_1',
        eigenaar_bedrijfsnaam: 'Bedrijf B', geadresseerde_key: 'g-2' }),
      // g-3: alleen concept
      brief({ id: 'b3', status: 'concept', eigenaar_naam: 'Persoon C', geadresseerde_key: 'g-3' }),
      // g-4: leeg verstuurd-veld, geen brief — niet meetelbaar (skipped, geen brief)
    ];
    render(wrap(<SignaalOutreachInzicht signaal={sig} />));
    // 3 groepen, 2 benaderd (g-1 post, g-2 e-mail)
    expect(screen.getByTestId('outreach-telling').textContent).toMatch(/3 geadresseerden, 2 benaderd/);
    expect(screen.getByTestId('outreach-geadresseerde-g-1')).toBeInTheDocument();
    expect(screen.getByTestId('outreach-geadresseerde-g-2')).toBeInTheDocument();
    expect(screen.getByTestId('outreach-geadresseerde-g-3')).toBeInTheDocument();
  });

  it('tijdlijn — toont alleen betrouwbare eventtypes, max 6, neutraliseert onbekende', () => {
    const sig = maakTestSignaal();
    mockBrieven = [
      brief({ id: 'b1', status: 'verstuurd', verzonden_op: '2026-06-12T10:00:00Z',
        eigenaar_naam: 'Voorbeeld Persoon', campagne_stap: 'brief_1', geadresseerde_key: 'g-1' }),
    ];
    mockEvents = [
      // 5 betrouwbare events
      ev({ id: 'e1', event_type: 'posted', event_date: '2026-06-12T10:00:00Z', brief_id: 'b1' }),
      ev({ id: 'e2', event_type: 'sent', event_date: '2026-06-11T10:00:00Z', brief_id: 'b1' }),
      ev({ id: 'e3', event_type: 'concept_created', event_date: '2026-06-10T10:00:00Z', brief_id: 'b1' }),
      ev({ id: 'e4', event_type: 'follow_up_created', event_date: '2026-06-09T10:00:00Z' }),
      ev({ id: 'e5', event_type: 'archived', event_date: '2026-06-08T10:00:00Z' }),
      // 2 onbetrouwbare → moeten worden genegeerd
      ev({ id: 'e6', event_type: 'printed', event_date: '2026-06-07T10:00:00Z' }),
      ev({ id: 'e7', event_type: 'response_received', event_date: '2026-06-06T10:00:00Z' }),
      // Een 6e betrouwbaar event ná de onbetrouwbare → mag wel meetellen
      ev({ id: 'e8', event_type: 'posted', event_date: '2026-06-05T10:00:00Z', brief_id: 'b1' }),
      // Een 7e betrouwbaar event → moet worden afgekapt
      ev({ id: 'e9', event_type: 'posted', event_date: '2026-06-04T10:00:00Z', brief_id: 'b1' }),
    ];
    render(wrap(<SignaalOutreachInzicht signaal={sig} />));
    const tijdlijn = screen.getByTestId('outreach-tijdlijn');
    const items = within(tijdlijn).getAllByRole('listitem');
    expect(items.length).toBeLessThanOrEqual(6);
    // Onbetrouwbare types mogen niet als hun ruwe naam voorkomen.
    expect(tijdlijn.textContent).not.toMatch(/printed/i);
    expect(tijdlijn.textContent).not.toMatch(/response_received/i);
    // Brief 1 verstuurd aan Voorbeeld Persoon
    expect(tijdlijn.textContent).toMatch(/Voorbeeld Persoon/);
    expect(tijdlijn.textContent).toMatch(/Opvolging aangemaakt/);
    expect(tijdlijn.textContent).toMatch(/Concept gearchiveerd/);
  });

  it('read-only — klikken op het paneel veroorzaakt geen update-call', async () => {
    const sig = maakTestSignaal();
    mockBrieven = [brief({ id: 'b1', eigenaar_naam: 'Persoon X', geadresseerde_key: 'g-1' })];
    const user = userEvent.setup();
    render(wrap(<SignaalOutreachInzicht signaal={sig} />));
    const paneel = screen.getByTestId('outreach-inzicht');
    await user.click(paneel);
    const rij = screen.getByTestId('outreach-geadresseerde-g-1');
    await user.click(rij);
    expect(updateMock).not.toHaveBeenCalled();
  });
});
