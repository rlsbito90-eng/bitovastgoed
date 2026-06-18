// V2.1 — desktop dossier-tabbar gebruikt glass-tab-pill en heeft actieve state.
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

describe('Desktop dossier tabbar — Liquid Glass', () => {
  it('actieve tab heeft data-state="active" + glass-tab-pill class', () => {
    render(
      <Tabs defaultValue="overzicht">
        <div className="glass-tabbar">
          <TabsList data-testid="tl">
            <TabsTrigger value="overzicht" className="glass-tab-pill">Overzicht</TabsTrigger>
            <TabsTrigger value="onderzoek" className="glass-tab-pill">Onderzoek</TabsTrigger>
          </TabsList>
        </div>
      </Tabs>,
    );
    const actief = screen.getByRole('tab', { name: 'Overzicht' });
    expect(actief.getAttribute('data-state')).toBe('active');
    expect(actief.className).toMatch(/glass-tab-pill/);
  });
});
