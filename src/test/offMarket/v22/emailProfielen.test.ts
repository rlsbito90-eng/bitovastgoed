// V2.2 — E-mailprofielen: keys, labels, templates.
import { describe, it, expect } from 'vitest';
import {
  EMAIL_PROFIEL_LABEL, EMAIL_PROFIEL_VOLGORDE,
  buildEmailTemplate, kanaalVoorStap, defaultFollowupDagen,
  volgendeEmailStap,
} from '@/lib/offMarket/email/emailProfielen';

describe('emailProfielen — V2.2', () => {
  it('bevat exact 9 profielen met labels', () => {
    expect(EMAIL_PROFIEL_VOLGORDE).toHaveLength(9);
    for (const p of EMAIL_PROFIEL_VOLGORDE) {
      expect(EMAIL_PROFIEL_LABEL[p]).toBeTruthy();
    }
    // Specifieke labels gevraagd in scope
    expect(EMAIL_PROFIEL_LABEL.splitsingspotentie).toBe('Splitsingspotentie');
    expect(EMAIL_PROFIEL_LABEL.transformatie_herontwikkeling).toBe('Transformatie / herontwikkeling');
    expect(EMAIL_PROFIEL_LABEL.algemene_acquisitie).toBe('Algemene acquisitie');
  });

  it('buildEmailTemplate geeft onderwerp en brieftekst terug voor elk profiel', () => {
    for (const p of EMAIL_PROFIEL_VOLGORDE) {
      const t = buildEmailTemplate({
        profiel: p, adres: 'Voorbeeldstraat 1', plaats: 'Voorbeeldstad',
      });
      expect(t.onderwerp.length).toBeGreaterThan(5);
      expect(t.brieftekst).toContain('Bito Vastgoed');
      expect(t.brieftekst).toContain('Voorbeeldstraat 1');
      expect(t.brieftekst).toContain('Ramysh Bito');
    }
  });

  it('kanaalVoorStap herkent email_* en post-brieven', () => {
    expect(kanaalVoorStap('email_1')).toBe('email');
    expect(kanaalVoorStap('email_3')).toBe('email');
    expect(kanaalVoorStap('brief_1')).toBe('post');
    expect(kanaalVoorStap(null)).toBe('post');
  });

  it('defaultFollowupDagen — post 21, email 7', () => {
    expect(defaultFollowupDagen('post')).toBe(21);
    expect(defaultFollowupDagen('email')).toBe(7);
    expect(defaultFollowupDagen(null)).toBe(21);
  });

  it('volgendeEmailStap negeert postbrieven en gearchiveerde records', () => {
    expect(volgendeEmailStap([])).toBe('email_1');
    expect(volgendeEmailStap([
      { kanaal: 'post', campagne_stap: 'brief_1' },
      { kanaal: 'post', campagne_stap: 'brief_2' },
    ])).toBe('email_1');
    expect(volgendeEmailStap([
      { kanaal: 'email', campagne_stap: 'email_1' },
    ])).toBe('email_2');
    expect(volgendeEmailStap([
      { kanaal: 'email', campagne_stap: 'email_1' },
      { kanaal: 'email', campagne_stap: 'email_2' },
    ])).toBe('email_3');
    // Archived telt niet mee
    expect(volgendeEmailStap([
      { kanaal: 'email', campagne_stap: 'email_1', archived_at: '2026-01-01' },
    ])).toBe('email_1');
  });
});
