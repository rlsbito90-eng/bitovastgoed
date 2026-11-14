// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { isOfflinePreviewMode } from '@/lib/auth/offlinePreview';
import { offlineDemoClient } from '@/lib/demo/offlineSupabase';

describe('publieke preview met lokale data, niet gekoppeld aan productie', () => {
  it('mag nooit op productie of buiten de preview-only build worden ingeschakeld', () => {
    const preview = 'https://bitovastgoed-8xywl0ats-bitovastgoed.vercel.app';
    expect(isOfflinePreviewMode({ flag: 'true', origin: preview })).toBe(true);
    expect(isOfflinePreviewMode({ flag: undefined, origin: preview })).toBe(false);
    expect(isOfflinePreviewMode({ flag: 'false', origin: preview })).toBe(false);
    expect(isOfflinePreviewMode({ flag: 'true', origin: 'https://bitovastgoed.vercel.app' })).toBe(false);
    expect(isOfflinePreviewMode({ flag: 'true', origin: 'https://www.bitovastgoed.nl' })).toBe(false);
    expect(isOfflinePreviewMode({ flag: 'true', origin: 'https://evil.example' })).toBe(false);
    expect(isOfflinePreviewMode({ flag: 'true', origin: preview + '.evil.example' })).toBe(false);
    expect(isOfflinePreviewMode({ flag: 'true', origin: preview.replace('https:', 'http:') })).toBe(false);
  });

  it('geeft zonder wachtwoord een demo-user met beheerdersrol, volledig offline', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    try {
      const { data: { session } } = await offlineDemoClient.auth.getSession();
      expect(session.user.email).toBe('demo@example.invalid');
      const { data: roles } = await offlineDemoClient.from('user_roles').select('*').eq('user_id', session.user.id);
      expect(roles).toHaveLength(1);
      expect(roles[0].role).toBe('admin');
      const { data: relaties } = await offlineDemoClient.from('relaties').select('*');
      expect(relaties.every(r => r.email?.endsWith('.invalid'))).toBe(true);
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally { fetchSpy.mockRestore(); }
  });

  it('kan fictieve CRM-records lokaal toevoegen, bijwerken en verwijderen', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    try {
      const { data: created } = await offlineDemoClient.from('relaties')
        .insert({ bedrijfsnaam: 'Nieuwe testrelatie', lead_status: 'actief' }).select().single();
      expect(created?.id).toBeTruthy();
      const { data: selected } = await offlineDemoClient.from('relaties').select('*').eq('id', created.id).maybeSingle();
      expect(selected.bedrijfsnaam).toBe('Nieuwe testrelatie');
      await offlineDemoClient.from('relaties').update({ bedrijfsnaam: 'Bijgewerkt' }).eq('id', created.id);
      const { data: updated } = await offlineDemoClient.from('relaties').select('*').eq('id', created.id).single();
      expect(updated.bedrijfsnaam).toBe('Bijgewerkt');
      await offlineDemoClient.from('relaties').delete().eq('id', created.id);
      const { data: removed } = await offlineDemoClient.from('relaties').select('*').eq('id', created.id).maybeSingle();
      expect(removed).toBeNull();
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally { fetchSpy.mockRestore(); }
  });
});
