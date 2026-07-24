from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
page = ROOT / "src/pages/ObjectDetailPage.tsx"
text = page.read_text(encoding="utf-8")

old_signature = """  const performScroll = (id: string) => {"""
new_signature = """  const performScroll = (id: string, behavior: ScrollBehavior = 'smooth') => {"""
if old_signature not in text:
    raise SystemExit("performScroll signature not found")
text = text.replace(old_signature, new_signature, 1)

old_scroll = """    window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });"""
new_scroll = """    window.scrollTo({ top: Math.max(0, top), behavior });"""
if old_scroll not in text:
    raise SystemExit("performScroll window.scrollTo not found")
text = text.replace(old_scroll, new_scroll, 1)

old_effect = """  // Deep-links scrollen pas nadat de juiste tabinhoud daadwerkelijk is gemount.
  useEffect(() => {
    const hash = location.hash.replace(/^#/, '');
    if (!hash || !ANCHOR_TO_TAB[hash]) return;
    const first = window.setTimeout(() => performScroll(hash), 140);
    const retry = window.setTimeout(() => performScroll(hash), 420);
    return () => {
      window.clearTimeout(first);
      window.clearTimeout(retry);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, location.hash]);
"""

new_effect = """  // Deep-links worden pas definitief uitgelijnd nadat hero, navigatie en lazy tabinhoud
  // hun uiteindelijke hoogte hebben. Korte hercontroles voorkomen dat een laat geladen
  // objectfoto de gekozen quickscan opnieuw onder de viewport duwt.
  useEffect(() => {
    const hash = location.hash.replace(/^#/, '');
    const targetTab = hash ? ANCHOR_TO_TAB[hash] : undefined;
    if (!hash || !targetTab || activeTab !== targetTab) return;

    let cancelled = false;
    let timer: number | undefined;
    let attempts = 0;
    let stablePasses = 0;

    const alignWhenStable = () => {
      if (cancelled) return;
      const target = document.getElementById(hash);
      attempts += 1;

      if (!target) {
        if (attempts < 40) timer = window.setTimeout(alignWhenStable, 75);
        return;
      }

      const sectionNav = document.querySelector<HTMLElement>('[data-object-section-nav="true"]');
      const sectionNavHeight = sectionNav?.getBoundingClientRect().height ?? 60;
      const rootStyles = getComputedStyle(document.documentElement);
      const parsePx = (value: string, fallback: number) => {
        const parsed = parseFloat(value);
        if (!parsed) return fallback;
        return value.trim().endsWith('rem') ? parsed * 16 : parsed;
      };
      const isDesktop = window.matchMedia('(min-width: 1024px)').matches;
      const topbar = isDesktop
        ? parsePx(rootStyles.getPropertyValue('--desktop-header-height'), 64)
        : parsePx(rootStyles.getPropertyValue('--mobile-header-height'), 56);
      const desiredTop = topbar + sectionNavHeight + 12;
      const delta = target.getBoundingClientRect().top - desiredTop;

      if (Math.abs(delta) > 3) {
        performScroll(hash, 'auto');
        stablePasses = 0;
      } else {
        stablePasses += 1;
      }

      // Minimaal circa 1,8 seconde blijven controleren voor laat geladen hero-media.
      if (attempts < 40 && (attempts < 18 || stablePasses < 5)) {
        timer = window.setTimeout(alignWhenStable, 100);
      }
    };

    const frame = window.requestAnimationFrame(alignWhenStable);
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frame);
      if (timer != null) window.clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, location.hash, requestedCalculationId]);
"""

if old_effect not in text:
    raise SystemExit("existing deep-link effect not found")
text = text.replace(old_effect, new_effect, 1)
page.write_text(text, encoding="utf-8")

test = ROOT / "src/test/ui/vastgoedrekenenDeepLinkScroll.test.ts"
test.write_text("""import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('Vastgoedrekenen deep-linkscroll', () => {
  it('blijft uitlijnen totdat hero en tabinhoud stabiel zijn', () => {
    const code = readFileSync(resolve(process.cwd(), 'src/pages/ObjectDetailPage.tsx'), 'utf8');
    expect(code).toContain("performScroll(hash, 'auto')");
    expect(code).toContain('attempts < 18 || stablePasses < 5');
    expect(code).toContain('[activeTab, location.hash, requestedCalculationId]');
  });
});
""", encoding="utf-8")
