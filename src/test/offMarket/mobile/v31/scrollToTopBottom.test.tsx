// V31 — ScrollToTopButton: veilige mobiele bottomspacing.
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ScrollToTopButton from '@/components/ScrollToTopButton';

describe('ScrollToTopButton — mobiele bottomspacing', () => {
  it('gebruikt safe-area + tabbar-hoogte op mobiel en bottom-6 op desktop', () => {
    render(<ScrollToTopButton />);
    const knop = screen.getByRole('button', { name: /naar boven/i });
    expect(knop.className).toMatch(/bottom-\[calc\(env\(safe-area-inset-bottom\)\+5rem\)\]/);
    expect(knop.className).toMatch(/lg:bottom-6/);
  });
});
