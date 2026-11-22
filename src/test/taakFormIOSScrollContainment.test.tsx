// @vitest-environment jsdom
import React, { useRef } from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  shouldBlockModalTouch,
  useModalScrollContainment,
} from '@/hooks/useModalScrollContainment';

function Harness({ active = true }: { active?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useModalScrollContainment(ref, active);
  return <div ref={ref} data-testid="scroll-region" />;
}

function touch(el: HTMLElement, type: string, x: number, y: number): Event {
  const event = new Event(type, { cancelable: true, bubbles: true });
  Object.defineProperty(event, 'touches', {
    value: type === 'touchend' ? [] : [{ clientX: x, clientY: y }],
  });
  el.dispatchEvent(event);
  return event;
}

describe('Taakformulier: iOS scroll containment', () => {
  it('laat normaal verticaal scrollen toe, maar blokkeert zijwaarts slepen', () => {
    const middle = { scrollTop: 120, scrollHeight: 950, clientHeight: 350 };
    expect(shouldBlockModalTouch({ ...middle, totalX: 3, totalY: -40, stepY: -15 })).toBe(false);
    expect(shouldBlockModalTouch({ ...middle, totalX: 50, totalY: -4, stepY: -4 })).toBe(true);
  });

  it('voorkomt iOS rubber-band bij bovenrand, onderrand en zonder scrollruimte', () => {
    const sizes = { scrollHeight: 950, clientHeight: 350 };
    expect(shouldBlockModalTouch({ ...sizes, scrollTop: 0, totalX: 0, totalY: 20, stepY: 20 })).toBe(true);
    expect(shouldBlockModalTouch({ ...sizes, scrollTop: 600, totalX: 0, totalY: -20, stepY: -20 })).toBe(true);
    expect(shouldBlockModalTouch({
      scrollTop: 0, scrollHeight: 350, clientHeight: 350, totalX: 0, totalY: -20, stepY: -20,
    })).toBe(true);
    expect(shouldBlockModalTouch({ ...sizes, scrollTop: 0, totalX: 0, totalY: 1, stepY: 1 })).toBe(false);
  });

  it('registreert een niet-passieve touchmove-listener op alleen het scrollvlak', () => {
    render(<Harness />);
    const region = screen.getByTestId('scroll-region');
    Object.defineProperty(region, 'scrollHeight', { configurable: true, value: 950 });
    Object.defineProperty(region, 'clientHeight', { configurable: true, value: 350 });
    region.scrollTop = 130;

    touch(region, 'touchstart', 100, 180);
    const horizontal = touch(region, 'touchmove', 160, 183);
    expect(horizontal.defaultPrevented).toBe(true);

    touch(region, 'touchend', 160, 183);
    touch(region, 'touchstart', 100, 180);
    const vertical = touch(region, 'touchmove', 102, 140);
    expect(vertical.defaultPrevented).toBe(false);

    region.scrollTop = 0;
    touch(region, 'touchend', 102, 140);
    touch(region, 'touchstart', 100, 180);
    const topBounce = touch(region, 'touchmove', 100, 220);
    expect(topBounce.defaultPrevented).toBe(true);

    region.scrollLeft = 42;
    region.dispatchEvent(new Event('scroll'));
    expect(region.scrollLeft).toBe(0);
  });

  it('begrenst het volledige taakformulier en native datum-/tijdvelden tot viewportbreedte', () => {
    const form = readFileSync(resolve(process.cwd(), 'src/components/forms/TaakFormDialog.tsx'), 'utf8');
    const planning = readFileSync(resolve(process.cwd(), 'src/components/tasks/TaakWerkplanningVelden.tsx'), 'utf8');
    expect(form).toContain('useModalScrollContainment(scrollBodyRef, open)');
    expect(form).toContain('h-[min(92svh,800px)]');
    expect(form).toContain('className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"');
    expect(form).toContain('overflow-x-hidden overflow-y-auto overscroll-none touch-pan-y');
    expect(form).toContain('ref={scrollBodyRef}');
    expect(form).toContain('className="min-w-0 max-w-full" type="date"');
    expect(form).toContain('className="min-w-0 max-w-full" type="time"');
    expect(planning).toContain('className="min-w-0 max-w-full space-y-2"');
    expect(planning).toContain('grid min-w-0 grid-cols-2');
    expect(planning).toContain('min-w-0 max-w-full rounded-md');
  });
});
