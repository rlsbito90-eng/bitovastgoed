import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { isInteractiefVastgoedkansRijDoel } from '@/lib/vastgoedkansRijSelectie';

const pagina = fs.readFileSync('src/pages/VastgoedkansenPage.tsx', 'utf8');

describe('Vastgoedkansen — volledige rijselectie', () => {
  it('laat een gewone klik in de dossierregel selectie toggelen', () => {
    const rij = document.createElement('div');
    const tekst = document.createElement('span');
    rij.appendChild(tekst);

    expect(isInteractiefVastgoedkansRijDoel(tekst)).toBe(false);
  });

  it.each(['a', 'button', 'input', 'select', 'textarea', 'label'])(
    'beschermt interactief element <%s> tegen rijselectie',
    (tag) => {
      const rij = document.createElement('div');
      const element = document.createElement(tag);
      const kind = document.createElement('span');
      element.appendChild(kind);
      rij.appendChild(element);

      expect(isInteractiefVastgoedkansRijDoel(kind)).toBe(true);
    },
  );

  it('beschermt Radix/shadcn checkbox- en buttonrollen tegen dubbel toggelen', () => {
    const checkbox = document.createElement('div');
    checkbox.setAttribute('role', 'checkbox');
    const checkboxKind = document.createElement('span');
    checkbox.appendChild(checkboxKind);

    const button = document.createElement('div');
    button.setAttribute('role', 'button');

    expect(isInteractiefVastgoedkansRijDoel(checkboxKind)).toBe(true);
    expect(isInteractiefVastgoedkansRijDoel(button)).toBe(true);
  });

  it('koppelt de guard aan de hele rij en toont geselecteerde staat', () => {
    expect(pagina).toContain('data-testid="vastgoedkans-selecteerbare-rij"');
    expect(pagina).toContain('isInteractiefVastgoedkansRijDoel(event.target)');
    expect(pagina).toContain("data-selected={isGeselecteerd ? 'true' : 'false'}");
    expect(pagina).toContain('toggleKans(kans.id)');
    expect(pagina).toContain('ring-primary/30 bg-primary/5');
  });
});
