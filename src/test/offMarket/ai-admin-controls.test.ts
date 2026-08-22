import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '../../..');
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

describe('Off-Market AI beheer', () => {
  const panel = read('src/components/admin/OffMarketAiInstellingenPanel.tsx');
  const backlog = read('src/components/admin/AiAchterstandPanel.tsx');

  it('biedt providerkeuze en harde master switch', () => {
    expect(panel).toMatch(/OpenAI/);
    expect(panel).toMatch(/Claude \/ Anthropic/);
    expect(panel).toMatch(/Google Gemini/);
    expect(panel).toMatch(/AI actief/);
    expect(panel).toMatch(/Master switch/);
  });

  it('biedt aanvraag-, dag- en maandlimieten', () => {
    expect(panel).toMatch(/Max\. aanvragen per dag/);
    expect(panel).toMatch(/Max\. kosten per dag/);
    expect(panel).toMatch(/Max\. kosten per maand/);
  });

  it('slaat geen API-key in browserconfig op', () => {
    expect(panel).not.toMatch(/type=["']password["']/);
    expect(panel).not.toMatch(/set.*API_KEY/i);
    expect(panel).toMatch(/server-side Supabase secret/);
  });

  it('toont instellingen logisch boven de AI-achterstand', () => {
    expect(backlog).toMatch(/OffMarketAiInstellingenPanel/);
    expect(backlog.indexOf('<OffMarketAiInstellingenPanel')).toBeLessThan(backlog.indexOf('AI-achterstand'));
  });
});
