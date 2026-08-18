import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

function migrationWithSuffix(suffix: string): string {
  const dir = path.join(process.cwd(), 'supabase/migrations');
  const file = fs.readdirSync(dir).find((name) => name.endsWith(suffix));
  if (!file) throw new Error(`Migratie ontbreekt: ${suffix}`);
  return fs.readFileSync(path.join(dir, file), 'utf8');
}

const scheduling = migrationWithSuffix('_timed_task_notification_scheduling.sql');
const cadence = migrationWithSuffix('_notification_engine_one_minute_cadence.sql');

describe('timed task notification scheduling', () => {
  it('maakt een timed deadline pas vanaf het expliciete lokale tijdstip actief', () => {
    expect(scheduling).toContain('(t.deadline + t.deadline_tijd) <= v_now_local');
    expect(scheduling).toContain("then 'Taakdeadline bereikt'");
    expect(scheduling).toContain("coalesce(left(t.deadline_tijd::text, 5), 'all-day')");
  });

  it('maakt dezelfde dag niet direct een tweede overdue-event', () => {
    expect(scheduling).toContain('and t.deadline < v_today');
    expect(scheduling).not.toContain('(t.deadline + t.deadline_tijd) < v_now_local');
  });

  it('controleert deadline-events iedere minuut', () => {
    expect(cadence).toContain("'bito-notification-engine-1m'");
    expect(cadence).toContain("'* * * * *'");
    expect(cadence).toContain('notification_engine_http_tick');
  });
});
