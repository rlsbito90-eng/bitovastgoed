import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const page = readFileSync(resolve(process.cwd(), 'src/pages/DashboardPage.tsx'), 'utf8');

describe('Dashboard — Vandaag cockpit', () => {
  it('gebruikt dezelfde taakplanning als Mijn werk', () => {
    expect(page).toContain('listTaskPlanning');
    expect(page).toContain('taskPlanningMap');
    expect(page).toContain('isTaskPlannedToday');
    expect(page).toContain('isTaskOverdue');
    expect(page).toContain('isTaskUpcoming');
  });

  it('zet Vandaag direct bovenaan en houdt achterstand apart', () => {
    expect(page).toContain('<VandaagCockpit');
    expect(page).toContain('data-testid="dashboard-vandaag-cockpit"');
    expect(page).toContain('Gepland vandaag');
    expect(page).toContain('Achterstallig');
    expect(page).toContain('Bekijk alle {achterstallig.length} achterstallige taken');
  });

  it('vervangt het oude Action center', () => {
    expect(page).not.toContain('Action center');
    expect(page).toContain('label="Werkdruk"');
  });
});
