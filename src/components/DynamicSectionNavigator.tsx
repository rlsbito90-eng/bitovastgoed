import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUp } from 'lucide-react';
import { useLocation } from 'react-router-dom';

const MIN_SCROLL_Y = 420;
const SECTION_START_TOLERANCE = 72;
const ARMED_POSITION_TOLERANCE = 120;

function getScrollContainer(): HTMLElement | Window {
  const main = document.querySelector('main');
  if (main instanceof HTMLElement && main.scrollHeight > main.clientHeight + 8) return main;
  return window;
}

function getScrollTop(container: HTMLElement | Window): number {
  return container === window ? window.scrollY : (container as HTMLElement).scrollTop;
}

function getViewportTop(container: HTMLElement | Window): number {
  if (container === window) return 0;
  return (container as HTMLElement).getBoundingClientRect().top;
}

function isEditing(): boolean {
  const active = document.activeElement;
  return active instanceof HTMLInputElement
    || active instanceof HTMLTextAreaElement
    || active instanceof HTMLSelectElement
    || active?.getAttribute('contenteditable') === 'true';
}

function getCandidateSections(): HTMLElement[] {
  const explicit = Array.from(document.querySelectorAll<HTMLElement>('[data-scroll-section]'));
  if (explicit.length > 0) return explicit.filter((element) => element.offsetParent !== null);

  const fallback = Array.from(
    document.querySelectorAll<HTMLElement>(
      'main section[id], main [role="tabpanel"] > section, main h2[id], main h3[id], main [id^="section-"]',
    ),
  );
  return fallback.filter((element) => element.offsetParent !== null);
}

function getLabel(element: HTMLElement): string {
  const explicit = element.dataset.scrollLabel?.trim();
  if (explicit) return explicit;

  const heading = element.matches('h1,h2,h3,h4')
    ? element
    : element.querySelector<HTMLElement>('h1,h2,h3,h4,[data-scroll-heading]');
  return heading?.textContent?.trim() || 'onderdeel';
}

function scrollTo(container: HTMLElement | Window, top: number): void {
  if (container === window) {
    window.scrollTo({ top, behavior: 'smooth' });
    return;
  }
  (container as HTMLElement).scrollTo({ top, behavior: 'smooth' });
}

function prepareScenarioTabs(): void {
  const workspace = document.querySelector<HTMLElement>('[data-testid="vastgoedrekenen-case-workspace"]');
  if (!workspace) return;

  const tabLists = Array.from(workspace.querySelectorAll<HTMLElement>('[role="tablist"]'));
  const scenarioTabList = tabLists.find((list) => {
    const labels = Array.from(list.querySelectorAll<HTMLElement>('[role="tab"]')).map((tab) => tab.textContent?.trim() ?? '');
    return labels.some((label) => label.includes('Doorrekenen'))
      && labels.some((label) => label.includes('Opzet & classificatie') || label === 'Scenario')
      && labels.some((label) => label.includes('Kengetallen & aannames'));
  });
  if (!scenarioTabList) return;

  const tabs = Array.from(scenarioTabList.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
  const calculation = tabs.find((tab) => tab.textContent?.includes('Doorrekenen'));
  const setup = tabs.find((tab) => tab.textContent?.includes('Opzet & classificatie') || tab.textContent?.trim() === 'Scenario');
  const assumptions = tabs.find((tab) => tab.textContent?.includes('Kengetallen & aannames'));
  if (!calculation || !setup || !assumptions) return;

  const setupText = Array.from(setup.childNodes).find((node) => node.nodeType === Node.TEXT_NODE);
  if (setupText) setupText.textContent = ' Scenario';
  setup.setAttribute('aria-label', 'Scenario');

  if (scenarioTabList.firstElementChild !== setup || setup.nextElementSibling !== calculation) {
    scenarioTabList.append(setup, calculation, assumptions);
  }

  if (scenarioTabList.dataset.defaultScenarioApplied === 'true') return;
  scenarioTabList.dataset.defaultScenarioApplied = 'true';
  window.requestAnimationFrame(() => setup.click());
}

export default function DynamicSectionNavigator() {
  const location = useLocation();
  const [visible, setVisible] = useState(false);
  const [label, setLabel] = useState('Naar boven');
  const [targetTop, setTargetTop] = useState(0);
  const [mode, setMode] = useState<'section' | 'top'>('top');
  const armedSectionTop = useRef<number | null>(null);

  const title = useMemo(() => label, [label]);

  useEffect(() => {
    armedSectionTop.current = null;
    let frame = 0;
    const container = getScrollContainer();

    const update = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        prepareScenarioTabs();

        const scrollTop = getScrollTop(container);
        setVisible(scrollTop > MIN_SCROLL_Y && !isEditing());

        if (armedSectionTop.current !== null) {
          const distanceToArmedSection = Math.abs(scrollTop - armedSectionTop.current);
          if (distanceToArmedSection <= ARMED_POSITION_TOLERANCE) {
            setMode('top');
            setLabel('Naar boven');
            setTargetTop(0);
            return;
          }
          armedSectionTop.current = null;
        }

        const sections = getCandidateSections();
        if (sections.length === 0) {
          setMode('top');
          setLabel('Naar boven');
          setTargetTop(0);
          return;
        }

        const viewportTop = getViewportTop(container);
        const positions = sections
          .map((element) => ({
            label: getLabel(element),
            top: element.getBoundingClientRect().top - viewportTop + scrollTop,
          }))
          .sort((a, b) => a.top - b.top);

        const currentIndex = positions.reduce((active, item, index) => (
          item.top <= scrollTop + SECTION_START_TOLERANCE ? index : active
        ), -1);

        if (currentIndex < 0) {
          setMode('top');
          setLabel('Naar boven');
          setTargetTop(0);
          return;
        }

        const current = positions[currentIndex];
        const sectionTop = Math.max(0, current.top - 16);
        const distanceFromStart = scrollTop - current.top;

        if (distanceFromStart > SECTION_START_TOLERANCE) {
          setMode('section');
          setLabel(`Naar begin van ${current.label}`);
          setTargetTop(sectionTop);
          return;
        }

        setMode('top');
        setLabel('Naar boven');
        setTargetTop(0);
      });
    };

    update();
    container.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update, { passive: true });
    document.addEventListener('focusin', update);
    document.addEventListener('focusout', update);
    const observer = new MutationObserver(update);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['hidden', 'class', 'data-state'],
    });

    return () => {
      window.cancelAnimationFrame(frame);
      container.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
      document.removeEventListener('focusin', update);
      document.removeEventListener('focusout', update);
      observer.disconnect();
    };
  }, [location.pathname, location.search, location.hash]);

  function handleClick() {
    const container = getScrollContainer();
    if (mode === 'section') armedSectionTop.current = targetTop;
    else armedSectionTop.current = null;
    scrollTo(container, targetTop);
  }

  return (
    <>
      <style>{`[data-testid="vastgoedrekenen-case-workspace"] > .sticky { position: static !important; top: auto !important; }`}</style>
      {visible && (
        <button
          type="button"
          onClick={handleClick}
          title={title}
          aria-label={title}
          className="group fixed bottom-[calc(env(safe-area-inset-bottom)+1rem)] right-4 z-40 inline-flex h-12 items-center justify-center gap-2 rounded-full border border-accent/50 bg-primary px-3 text-primary-foreground shadow-lg transition-all hover:-translate-y-0.5 hover:shadow-xl sm:bottom-6 sm:right-6 sm:h-11 sm:px-3.5"
        >
          <ArrowUp className="h-5 w-5 shrink-0" />
          <span className="hidden max-w-0 overflow-hidden whitespace-nowrap text-xs font-medium opacity-0 transition-all duration-200 group-hover:max-w-[260px] group-hover:opacity-100 lg:inline-block">
            {label}
          </span>
        </button>
      )}
    </>
  );
}
