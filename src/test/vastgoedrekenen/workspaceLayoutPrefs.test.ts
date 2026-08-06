import { beforeEach, describe, expect, it } from 'vitest';
import {
  VR_DEFAULT_LAYOUT,
  VR_LAYOUT_STORAGE_KEY,
  loadLayoutPrefs,
  moveWidget,
  normalizeLayoutPrefs,
  resetLayoutPrefs,
  saveLayoutPrefs,
  toggleWidget,
  visibleWidgets,
} from '@/lib/vastgoedrekenen/workspaceLayoutPrefs';

describe('Vastgoedrekenen workspace layout preferences', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('normaliseert ongeldige en onvolledige voorkeuren naar een complete layout', () => {
    expect(normalizeLayoutPrefs({ order: ['recent', 'recent', 'onbekend'], hidden: ['snelacties', 'onbekend'] })).toEqual({
      order: ['recent', 'statistieken', 'snelacties'],
      hidden: ['snelacties'],
    });
  });

  it('slaat voorkeuren lokaal op en leest ze terug', () => {
    const prefs = {
      order: ['recent', 'snelacties', 'statistieken'] as const,
      hidden: ['statistieken'] as const,
    };

    saveLayoutPrefs({ order: [...prefs.order], hidden: [...prefs.hidden] });

    expect(window.localStorage.getItem(VR_LAYOUT_STORAGE_KEY)).not.toBeNull();
    expect(loadLayoutPrefs()).toEqual({ order: [...prefs.order], hidden: [...prefs.hidden] });
  });

  it('kan widgets verbergen, tonen en herschikken zonder financiële data te raken', () => {
    const hidden = toggleWidget(VR_DEFAULT_LAYOUT, 'recent');
    expect(visibleWidgets(hidden)).toEqual(['statistieken', 'snelacties']);

    const shown = toggleWidget(hidden, 'recent');
    expect(visibleWidgets(shown)).toEqual(['statistieken', 'recent', 'snelacties']);

    const moved = moveWidget(shown, 'recent', -1);
    expect(moved.order).toEqual(['recent', 'statistieken', 'snelacties']);
  });

  it('herstelt de standaardlayout en verwijdert opgeslagen voorkeuren', () => {
    window.localStorage.setItem(VR_LAYOUT_STORAGE_KEY, JSON.stringify({ order: ['recent'], hidden: ['recent'] }));

    expect(resetLayoutPrefs()).toEqual(VR_DEFAULT_LAYOUT);
    expect(window.localStorage.getItem(VR_LAYOUT_STORAGE_KEY)).toBeNull();
  });
});
