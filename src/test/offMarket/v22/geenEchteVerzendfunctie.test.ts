// V2.2 — emailProfielen/helpers bevatten geen echte verzendlogica.
// We controleren statisch dat het bestand geen Gmail/SMTP/Resend/fetch/sendEmail/oauth
// imports of strings bevat.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '../../..');

function readFile(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

describe('V2.2 — geen echte e-mailverzending', () => {
  it('emailProfielen.ts importeert geen externe verzendservice', () => {
    const src = readFile('lib/offMarket/email/emailProfielen.ts');
    expect(src).not.toMatch(/from\s+['"]nodemailer['"]/i);
    expect(src).not.toMatch(/from\s+['"]resend['"]/i);
    expect(src).not.toMatch(/from\s+['"]@google-cloud\/.*gmail/i);
    expect(src).not.toMatch(/googleapis/i);
    expect(src).not.toMatch(/smtp/i);
    expect(src).not.toMatch(/oauth/i);
    expect(src).not.toMatch(/\bfetch\s*\(/);
    expect(src).not.toMatch(/sendEmail/);
    expect(src).not.toMatch(/tracking[_-]?pixel/i);
  });

  it('BriefVoorbereidenDialog kopieert via clipboard, geen externe mailservice', () => {
    const src = readFile('components/offmarket/BriefVoorbereidenDialog.tsx');
    expect(src).not.toMatch(/nodemailer|resend|googleapis|smtp/i);
    expect(src).not.toMatch(/sendEmail\s*\(/);
    // clipboard-API mag wel — dat is lokaal
    expect(src).toMatch(/navigator\.clipboard/);
  });
});
