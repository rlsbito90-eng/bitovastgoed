import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const page = readFileSync(resolve(process.cwd(), 'src/pages/DashboardPage.tsx'), 'utf8');

describe('Dashboard — compacte Vandaag-strip', () => {
  it('gebruikt dezelfde taakplanning als Taken', () => {
    expect(page).toContain('listTaskPlanning');
    expect(page).toContain('taskPlanningMap');
    expect(page).toContain('isTaskPlannedToday');
    expect(page).toContain('isTaskOverdue');
    expect(page).toContain('isTaskUpcoming');
  });

  it('houdt Vandaag compact en laat de commerciële pipeline direct volgen', () => {
    expect(page).toContain('<VandaagStrip');
    expect(page).toContain('data-testid="dashboard-vandaag-cockpit"');
    expect(page).toContain('gepland');
    expect(page).toContain('achterstallig');
    expect(page).toContain('komend');
    expect(page.indexOf('<VandaagStrip')).toBeLessThan(page.indexOf('className="kpi-hero block group"'));
  });

  it('vervangt het oude Action center zonder Taken het dashboard te laten domineren', () => {
    expect(page).not.toContain('Action center');
    expect(page).toContain('label="Open acties"');
    expect(page).not.toContain('Bekijk alle {achterstallig.length} achterstallige taken');
  });
});
