// Per-gebruiker voorkeuren voor de Vastgoedrekenen module.

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { UserCalcPrefs, ViewMode } from '@/lib/vastgoedrekenen/types';

const LS_KEY = 'vr.viewMode';

export function useVastgoedrekenenPrefs() {
  const [prefs, setPrefs] = useState<UserCalcPrefs | null>(null);
  const [viewMode, setViewModeState] = useState<ViewMode>(() => {
    if (typeof window === 'undefined') return 'begeleid';
    return ((window.localStorage.getItem(LS_KEY) as ViewMode) || 'begeleid');
  });
  const [loading, setLoading] = useState(true);

  const fetchPrefs = useCallback(async () => {
    setLoading(true);
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) { setLoading(false); return; }
    const { data } = await supabase
      .from('user_calculation_preferences')
      .select('*')
      .eq('user_id', u.user.id)
      .maybeSingle();
    if (data) {
      setPrefs(data as UserCalcPrefs);
      setViewModeState((data.vastgoedrekenen_view_mode as ViewMode) ?? 'begeleid');
      try { window.localStorage.setItem(LS_KEY, data.vastgoedrekenen_view_mode); } catch {}
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchPrefs(); }, [fetchPrefs]);

  const setViewMode = useCallback(async (mode: ViewMode) => {
    setViewModeState(mode);
    try { window.localStorage.setItem(LS_KEY, mode); } catch {}
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    await supabase
      .from('user_calculation_preferences')
      .upsert({ user_id: u.user.id, vastgoedrekenen_view_mode: mode }, { onConflict: 'user_id' });
  }, []);

  return { prefs, viewMode, setViewMode, loading, refetch: fetchPrefs };
}
