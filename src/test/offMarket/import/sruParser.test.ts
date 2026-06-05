import { describe, it, expect } from 'vitest';
import { parseSruResponse, bouwSruUrl, bouwPermalink } from '@/lib/offMarket/import/sruParser';

const FIXTURE = `<?xml version="1.0" encoding="UTF-8"?>
<srw:searchRetrieveResponse xmlns:srw="http://docs.oasis-open.org/ns/search-ws/sruResponse">
  <srw:numberOfRecords>2</srw:numberOfRecords>
  <srw:records>
    <srw:record>
      <srw:recordData>
        <gzd:gzd xmlns:gzd="http://standaarden.overheid.nl/sru" xmlns:dcterms="http://purl.org/dc/terms/">
          <dcterms:identifier>gmb-2026-12345</dcterms:identifier>
          <dcterms:title>Omgevingsvergunning Damrak 70, transformatie kantoor naar wonen</dcterms:title>
          <dcterms:creator>gemeente Amsterdam</dcterms:creator>
          <dcterms:modified>2026-06-01</dcterms:modified>
          <dcterms:subject>omgevingsvergunning</dcterms:subject>
          <dcterms:subject>transformatie</dcterms:subject>
          <dcterms:abstract>Vergunning voor transformatie van kantoor naar 45 woningen aan het Damrak 70, 1012LM Amsterdam.</dcterms:abstract>
        </gzd:gzd>
      </srw:recordData>
    </srw:record>
    <srw:record>
      <srw:recordData>
        <gzd:gzd xmlns:gzd="http://standaarden.overheid.nl/sru" xmlns:dcterms="http://purl.org/dc/terms/">
          <dcterms:identifier>gmb-2026-12346</dcterms:identifier>
          <dcterms:title>Kapvergunning &amp; dakkapel Vondelstraat 5</dcterms:title>
          <dcterms:creator>gemeente Amsterdam</dcterms:creator>
          <dcterms:modified>2026-06-02</dcterms:modified>
          <dcterms:subject>kapvergunning</dcterms:subject>
        </gzd:gzd>
      </srw:recordData>
    </srw:record>
  </srw:records>
</srw:searchRetrieveResponse>`;

describe('sruParser', () => {
  it('parseert namespace-tolerant en geeft beide records', () => {
    const { records, totaal } = parseSruResponse(FIXTURE);
    expect(totaal).toBe(2);
    expect(records).toHaveLength(2);
  });

  it('extraheert kernvelden + subjects + permalink', () => {
    const { records } = parseSruResponse(FIXTURE);
    const r = records[0];
    expect(r.identifier).toBe('gmb-2026-12345');
    expect(r.titel).toContain('Damrak 70');
    expect(r.datum).toBe('2026-06-01');
    expect(r.creator).toBe('gemeente Amsterdam');
    expect(r.subjects).toEqual(['omgevingsvergunning', 'transformatie']);
    expect(r.samenvatting).toContain('1012LM');
    expect(r.link).toBe('https://zoek.officielebekendmakingen.nl/gmb-2026-12345.html');
  });

  it('decodeert XML-entities in titel', () => {
    const { records } = parseSruResponse(FIXTURE);
    expect(records[1].titel).toContain('&');
  });

  it('returnt lege array bij lege response', () => {
    const xml = '<srw:searchRetrieveResponse><srw:numberOfRecords>0</srw:numberOfRecords></srw:searchRetrieveResponse>';
    const r = parseSruResponse(xml);
    expect(r.records).toEqual([]);
    expect(r.totaal).toBe(0);
  });

  it('bouwt SRU-URL met CQL-query en paginatie', () => {
    const url = bouwSruUrl({
      endpoint: 'https://repository.overheid.nl/sru',
      creator: 'gemeente Amsterdam',
      subjects: ['omgevingsvergunning', 'bestemmingsplan'],
      sinceIso: '2026-05-29',
      startRecord: 1,
      maximumRecords: 100,
    });
    expect(url).toContain('operation=searchRetrieve');
    expect(url).toContain('startRecord=1');
    expect(url).toContain('maximumRecords=100');
    expect(decodeURIComponent(url)).toContain('dcterms.creator="gemeente Amsterdam"');
    expect(decodeURIComponent(url)).toContain('dcterms.modified >= "2026-05-29"');
  });

  it('bouwPermalink genereert juiste URL', () => {
    expect(bouwPermalink('gmb-2026-1')).toBe('https://zoek.officielebekendmakingen.nl/gmb-2026-1.html');
  });
});
