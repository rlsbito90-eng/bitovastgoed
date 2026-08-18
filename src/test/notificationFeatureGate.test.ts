import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const layout = fs.readFileSync(path.join(process.cwd(), 'src/components/AppLayout.tsx'), 'utf8');
const facade = fs.readFileSync(path.join(process.cwd(), 'src/components/NotificationsBell.tsx'), 'utf8');
const main = fs.readFileSync(path.join(process.cwd(), 'src/main.tsx'), 'utf8');

describe('notification engine V2 activatie', () => {
  it('rendert op mobiel en desktop via één actieve notificatiecomponent', () => {
    expect(layout).toContain('NotificationsBellV2');
    expect(layout).toContain('const ActiveNotificationsBell = NOTIFICATION_ENGINE_V2_ENABLED ? NotificationsBellV2 : NotificationsBell');
    expect(layout.match(/<ActiveNotificationsBell \/>/g)?.length).toBe(2);
  });

  it('laat de compatibiliteitsnaam NotificationsBell uitsluitend naar V2 wijzen', () => {
    expect(facade).toContain("export { default } from './NotificationsBellV2'");
    expect(facade).not.toContain('localStorage');
    expect(facade).not.toContain('supabase.from');
  });

  it('start de legacy localStorage synchronisatielaag niet meer bij appboot', () => {
    expect(main).not.toContain('installNotificationStateSync');
    expect(main).not.toContain('notificationStateSync');
    expect(main).toContain('registerBitoServiceWorker');
  });
});
