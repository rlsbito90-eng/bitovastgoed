// @vitest-environment jsdom
import React, { useRef } from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  isTaskPageScrollRoute,
  shouldPreventTaskPageBounce,
  useTaskPageScrollBoundary,
} from '@/hooks/useTaskPageScrollBoundary';

function Harness({ active = true }: { active?: boolean }) {
  const ref = useRef<HTMLElement>(null);
  useTaskPageScrollBoundary(ref, active);
  return <main ref={ref} data-testid="main-scroll"><div>Inhoud</div></main>;
}

function touch(element: HTMLElement, type: string, x: number, y: number) {
  const event = new Event(type, { cancelable: true, bubbles: true });
  Object.defineProperty(event, 'touches', {
    value: type === 'touchend' || type === 'touchcancel' ? [] : [{ clientX: x, clientY: y }],
  });
  element.dispatchEvent(event);
  return event;
}

describe('Taken overzicht en detail: iPhone verticale scrollgrens', () => {
  it('is uitsluitend actief op Taken en een taakdetail', () => {
    expect(isTaskPageScrollRoute('/taken')).toBe(true);
    expect(isTaskPageScrollRoute('/taken/abc-123')).toBe(true);
    expect(isTaskPageScrollRoute('/taken/')).toBe(true);
    for (const other of ['/', '/relaties', '/objecten', '/taken-extra', '/taken/a/b']) {
      expect(isTaskPageScrollRoute(other)).toBe(false);
    }
  });

  it('laat normaal verticaal scrollen en horizontale tabs ongemoeid', () => {
    const middle = { scrollTop: 200, scrollHeight: 1300, clientHeight: 600 };
    expect(shouldPreventTaskPageBounce({
      ...middle, totalX: 3, totalY: -55, stepY: -20,
    })).toBe(false);
    expect(shouldPreventTaskPageBounce({
      ...middle, totalX: 80, totalY: 8, stepY: 8,
    })).toBe(false);
    expect(shouldPreventTaskPageBounce({
      ...middle, totalX: 0, totalY: 3, stepY: 3,
    })).toBe(false);
  });

  it('blokkeert uitsluitend verticaal doortrekken bij boven-/onderrand', () => {
    const sizes = { scrollHeight: 1300, clientHeight: 600 };
    expect(shouldPreventTaskPageBounce({
      ...sizes, scrollTop: 0, totalX: 0, totalY: 90, stepY: 35,
    })).toBe(true);
    expect(shouldPreventTaskPageBounce({
      ...sizes, scrollTop: 700, totalX: 0, totalY: -60, stepY: -25,
    })).toBe(true);
    expect(shouldPreventTaskPageBounce({
      scrollHeight: 600, clientHeight: 600, scrollTop: 0,
      totalX: 0, totalY: 30, stepY: 10,
    })).toBe(true);
    expect(shouldPreventTaskPageBounce({
      ...sizes, scrollTop: 0, totalX: 55, totalY: 8, stepY: 8,
    })).toBe(false);
  });

  it('werkt met native touch-events en blijft buiten Taken uitgeschakeld', () => {
    const { rerender } = render(<Harness />);
    const main = screen.getByTestId('main-scroll');
    Object.defineProperty(main, 'scrollHeight', { configurable: true, value: 1300 });
    Object.defineProperty(main, 'clientHeight', { configurable: true, value: 600 });
    main.scrollTop = 0;
    touch(main, 'touchstart', 100, 160);
    expect(touch(main, 'touchmove', 102, 230).defaultPrevented).toBe(true);
    touch(main, 'touchend', 102, 230);

    main.scrollTop = 180;
    touch(main, 'touchstart', 100, 210);
    expect(touch(main, 'touchmove', 101, 150).defaultPrevented).toBe(false);
    touch(main, 'touchend', 101, 150);

    main.scrollTop = 0;
    touch(main, 'touchstart', 100, 160);
    expect(touch(main, 'touchmove', 180, 165).defaultPrevented).toBe(false);
    touch(main, 'touchend', 180, 165);

    rerender(<Harness active={false} />);
    main.scrollTop = 0;
    touch(main, 'touchstart', 100, 160);
    expect(touch(main, 'touchmove', 100, 230).defaultPrevented).toBe(false);
  });

  it('begrenst de hoofdscrollcontainer zonder taak-tabs te vergrendelen', () => {
    const app = readFileSync(resolve(process.cwd(), 'src/components/AppLayout.tsx'), 'utf8');
    const tasks = readFileSync(resolve(process.cwd(), 'src/pages/TakenPage.tsx'), 'utf8');
    expect(app).toContain('useTaskPageScrollBoundary(mainScrollRef, isTaskPage)');
    expect(app).toContain('data-task-scroll-boundary={isTaskPage ? "true" : undefined}');
    expect(app).toContain('isTaskPage ? "overscroll-y-none" : "overscroll-y-contain"');
    expect(app).toContain('overflow-y-auto overflow-x-hidden');
    expect(tasks).toContain('className={`page-shell');
    expect(tasks).toContain('overflow-x-auto');
  });
});
