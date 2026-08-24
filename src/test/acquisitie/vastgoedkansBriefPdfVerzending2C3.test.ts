import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const hook = fs.readFileSync(path.join(process.cwd(), 'src/hooks/useAcquisitieBrieven.tsx'), 'utf8');
const kaart = fs.readFileSync(path.join(process.cwd(), 'src/components/acquisitie/VastgoedkansConceptbriefKaart.tsx'), 'utf8');
const statuskaart = fs.readFileSync(path.join(process.cwd(), 'src/components/acquisitie/AcquisitieBrievenStatusKaart.tsx'), 'utf8');

describe('BUILD 2.0C.3 — Vastgoedkans PDF en verzending registreren', () => {
  it('markeert alleen een concept van dezelfde Vastgoedkans als verstuurd', () => {
    expect(hook).toContain(".eq('id', id)");
    expect(hook).toContain(".eq('vastgoedkans_id', vastgoedkansId)");
    expect(hook).toContain(".eq('status', 'concept')");
    expect(hook).toContain("status: 'verstuurd'");
    expect(hook).toContain("verzendstatus: 'gepost'");
  });

  it('schrijft het posted event uitsluitend op vastgoedkans_id', () => {
    expect(hook).toContain("event_type: 'posted'");
    expect(hook).toContain('vastgoedkans_id: vastgoedkansId');
  });

  it('promoveert geen Off-Market-signaal en maakt geen taak automatisch aan', () => {
    expect(hook).not.toContain(".from('off_market_signalen')");
    expect(hook).not.toContain('addTaak');
    expect(hook).not.toContain('offMarketSignaalId');
  });

  it('genereert PDF lokaal en registreert alleen een audit-event', () => {
    expect(kaart).toContain("from '@react-pdf/renderer'");
    expect(kaart).toContain('pdf(<BriefPDF vm={vm} />).toBlob()');
    expect(kaart).toContain('logVastgoedkansBriefPdfGenerated(brief)');
    expect(hook).toContain("event_type: 'pdf_generated'");
  });

  it('maakt duidelijk dat markeren alleen de werkelijke postverzending registreert', () => {
    expect(kaart).toContain('Bevestig dit alleen nadat de brief daadwerkelijk op de post is gedaan.');
    expect(kaart).toContain('Bevestig verzending');
  });

  it('leidt voorbereid/verzonden voor Vastgoedkans af uit persisted brieven', () => {
    expect(statuskaart).toContain("brief.status === 'verstuurd'");
    expect(statuskaart).toContain('model.briefVoorbereid || heeftPersistedBrief');
    expect(statuskaart).toContain('model.briefVerzonden || heeftPersistedVerstuurd');
  });
});
