import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

function migrationWithSuffix(suffix: string): string {
  const dir = path.join(process.cwd(), 'supabase/migrations');
  const file = fs.readdirSync(dir).find((name) => name.endsWith(suffix));
  if (!file) throw new Error(`Migratie ontbreekt: ${suffix}`);
  return fs.readFileSync(path.join(dir, file), 'utf8');
}

const sql = migrationWithSuffix('_disk_io_cron_opschoning_en_push_guard.sql');
const pushSend = fs.readFileSync(
  path.join(process.cwd(), 'supabase/functions/notification-push-send/index.ts'),
  'utf8',
);

describe('disk IO: cron-opschoning en push-guard', () => {
  it('ruimt cron-geschiedenis in kleine batches op en bewaart 3 dagen', () => {
    expect(sql).toContain("'bito-cron-history-purge'");
    expect(sql).toContain("'*/15 * * * *'");
    expect(sql).toContain("end_time < now() - interval '3 days'");
    expect(sql).toContain('order by runid');
    expect(sql).toContain('limit 5000');
  });

  it('roept de push-functie alleen aan als er een verzending klaarstaat', () => {
    expect(sql).toMatch(/if not exists \([\s\S]*notification_deliveries[\s\S]*\) then\s*return null;/);
    expect(sql).toContain('d.sent_at is null');
    expect(sql).toContain('d.failed_at is null');
    expect(sql).toContain('d.retry_count < 3');
    expect(sql).toContain('d.available_at <= now()');
  });

  it('gebruikt dezelfde voorwaarden als notification-push-send', () => {
    expect(pushSend).toContain(".is('sent_at', null)");
    expect(pushSend).toContain(".is('failed_at', null)");
    expect(pushSend).toContain(".lt('retry_count', 3)");
    expect(pushSend).toContain(".lte('available_at', nowIso)");
  });

  it('behoudt de bestaande autorisatie en rechten van de push-tick', () => {
    expect(sql).toContain("'authorization','Bearer ' || v_secret");
    expect(sql).toContain('notification-push-send');
    expect(sql).toContain('revoke all on function public.notification_push_http_tick() from public, anon, authenticated');
    expect(sql).toContain('grant execute on function public.notification_push_http_tick() to service_role');
  });

  it('laat de engine-tick van elke minuut ongemoeid', () => {
    expect(sql).not.toContain('notification_engine_http_tick');
    expect(sql).not.toContain('bito-notification-engine');
  });

  it('voegt een sorteerindex toe voor de signalenlijst', () => {
    expect(sql).toContain('on public.off_market_signalen (created_at desc)');
  });
});
