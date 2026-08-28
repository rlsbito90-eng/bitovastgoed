import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const page = readFileSync(resolve(process.cwd(), 'src/pages/TakenPage.tsx'), 'utf8');

describe('Mijn werk — snel verwijderen', () => {
  it('biedt verwijderen direct vanuit het drie-puntenmenu', () => {
    expect(page).toContain('<Trash2 className="h-4 w-4 mr-2" /> Verwijderen');
    expect(page).toContain('setVerwijderTaak(task)');
  });

  it('vraagt expliciete bevestiging voordat deleteTaak wordt uitgevoerd', () => {
    expect(page).toContain('Taak verwijderen?');
    expect(page).toContain('await deleteTaak(verwijderTaak.id)');
    expect(page).toContain('Deze actie kan niet ongedaan worden gemaakt.');
  });
});
