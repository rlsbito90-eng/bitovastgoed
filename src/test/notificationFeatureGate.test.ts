import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const bron = fs.readFileSync(path.join(process.cwd(), 'src/components/AppLayout.tsx'), 'utf8');

describe('notification engine V2 feature gate', () => {
  it('houdt legacy standaard actief en schakelt V2 alleen via expliciete env-flag', () => {
    expect(bron).toContain('VITE_NOTIFICATION_ENGINE_V2 === "true"');
    expect(bron).toContain('NotificationsBellV2');
    expect(bron).toContain('const ActiveNotificationsBell = NOTIFICATION_ENGINE_V2_ENABLED ? NotificationsBellV2 : NotificationsBell');
    expect(bron.match(/<ActiveNotificationsBell \/>/g)?.length).toBe(2);
  });
});
