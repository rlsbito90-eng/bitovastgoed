from pathlib import Path

page_path = Path('src/pages/ObjectDetailPage.tsx')
test_path = Path('src/test/ui/vastgoedrekenenDeepLinkScroll.test.ts')

page = page_path.read_text(encoding='utf-8')

old_scroll = '''  // Scroll naar een element binnen huidige tab (gebruikt door deep-links en quick actions)
  const performScroll = (id: string, behavior: ScrollBehavior = 'smooth') => {
    const target = document.getElementById(id);
    if (!target) return false;
    const sectionNav = document.querySelector<HTMLElement>('[data-object-section-nav="true"]');
    const sectionNavHeight = sectionNav?.getBoundingClientRect().height ?? 60;
    const buffer = 12;
    const rootStyles = getComputedStyle(document.documentElement);
    const parsePx = (v: string, fb: number) => {
      const n = parseFloat(v);
      if (!n) return fb;
      return v.trim().endsWith('rem') ? n * 16 : n;
    };
    const isDesktop = window.matchMedia('(min-width: 1024px)').matches;
    const topbar = isDesktop
      ? parsePx(rootStyles.getPropertyValue('--desktop-header-height'), 64)
      : parsePx(rootStyles.getPropertyValue('--mobile-header-height'), 56);
    const top = target.getBoundingClientRect().top + window.scrollY - (topbar + sectionNavHeight + buffer);
    window.scrollTo({ top: Math.max(0, top), behavior });
    return true;
  };
'''

new_scroll = '''  // Bepaal welk element werkelijk verticaal scrollt. In de desktop-CRM is dit
  // doorgaans het centrale <main>-paneel en niet het browservenster.
  const getScrollContext = (target: HTMLElement) => {
    const sectionNav = document.querySelector<HTMLElement>('[data-object-section-nav="true"]');
    const sectionNavHeight = sectionNav?.getBoundingClientRect().height ?? 60;
    const buffer = 12;

    let node = target.parentElement;
    while (node && node !== document.body) {
      const style = window.getComputedStyle(node);
      const overflowY = style.overflowY;
      const isScrollable = /(auto|scroll|overlay)/.test(overflowY)
        && node.scrollHeight > node.clientHeight + 1;
      if (isScrollable) {
        return {
          container: node,
          desiredViewportTop: node.getBoundingClientRect().top + sectionNavHeight + buffer,
        };
      }
      node = node.parentElement;
    }

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

    return {
      container: null as HTMLElement | null,
      desiredViewportTop: topbar + sectionNavHeight + buffer,
    };
  };

  // Scroll naar een element binnen de huidige tab. Gebruik de echte scrollcontainer,
  // zodat deep links ook werken in de desktop-layout met een vast zijmenu en header.
  const performScroll = (id: string, behavior: ScrollBehavior = 'smooth') => {
    const target = document.getElementById(id);
    if (!target) return false;

    const { container, desiredViewportTop } = getScrollContext(target);
    if (container) {
      const top = container.scrollTop + target.getBoundingClientRect().top - desiredViewportTop;
      container.scrollTo({ top: Math.max(0, top), behavior });
    } else {
      const top = target.getBoundingClientRect().top + window.scrollY - desiredViewportTop;
      window.scrollTo({ top: Math.max(0, top), behavior });
    }
    return true;
  };
'''

if page.count(old_scroll) != 1:
    raise SystemExit(f'performScroll block count: {page.count(old_scroll)}')
page = page.replace(old_scroll, new_scroll)

old_stable = '''      const sectionNav = document.querySelector<HTMLElement>('[data-object-section-nav="true"]');
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
'''

new_stable = '''      const { desiredViewportTop } = getScrollContext(target);
      const delta = target.getBoundingClientRect().top - desiredViewportTop;
'''

if page.count(old_stable) != 1:
    raise SystemExit(f'stable alignment block count: {page.count(old_stable)}')
page = page.replace(old_stable, new_stable)
page_path.write_text(page, encoding='utf-8')

test = test_path.read_text(encoding='utf-8')
old_expectations = '''    expect(code).toContain("performScroll(hash, 'auto')");
    expect(code).toContain('attempts < 18 || stablePasses < 5');
    expect(code).toContain('[activeTab, location.hash, requestedCalculationId]');
'''
new_expectations = '''    expect(code).toContain("performScroll(hash, 'auto')");
    expect(code).toContain('attempts < 18 || stablePasses < 5');
    expect(code).toContain('[activeTab, location.hash, requestedCalculationId]');
    expect(code).toContain('const getScrollContext = (target: HTMLElement)');
    expect(code).toContain('container.scrollTo({ top: Math.max(0, top), behavior })');
    expect(code).toContain('target.getBoundingClientRect().top - desiredViewportTop');
'''
if test.count(old_expectations) != 1:
    raise SystemExit(f'test expectation block count: {test.count(old_expectations)}')
test = test.replace(old_expectations, new_expectations)
test_path.write_text(test, encoding='utf-8')
