import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import AdminSectionCard from '@/components/admin/AdminSectionCard';

describe('AdminSectionCard', () => {
  it('is op mobiel (matchMedia=false) standaard ingeklapt', () => {
    render(
      <AdminSectionCard id="x" title="Titel">
        <div>BODY-INHOUD</div>
      </AdminSectionCard>,
    );
    const header = screen.getByRole('button', { name: /Titel/i });
    expect(header.getAttribute('aria-expanded')).toBe('false');
    // body hidden
    const body = document.getElementById('x-body');
    expect(body?.hasAttribute('hidden')).toBe(true);
  });

  it('opent bij klik op header', () => {
    render(
      <AdminSectionCard id="x" title="Titel">
        <div>BODY-INHOUD</div>
      </AdminSectionCard>,
    );
    const header = screen.getByRole('button', { name: /Titel/i });
    fireEvent.click(header);
    expect(header.getAttribute('aria-expanded')).toBe('true');
    expect(document.getElementById('x-body')?.hasAttribute('hidden')).toBe(false);
  });

  it('forceOpen opent de sectie automatisch', () => {
    const { rerender } = render(
      <AdminSectionCard id="x" title="Titel" forceOpen={false}>
        <div>BODY</div>
      </AdminSectionCard>,
    );
    expect(screen.getByRole('button', { name: /Titel/i }).getAttribute('aria-expanded')).toBe('false');
    rerender(
      <AdminSectionCard id="x" title="Titel" forceOpen={true}>
        <div>BODY</div>
      </AdminSectionCard>,
    );
    expect(screen.getByRole('button', { name: /Titel/i }).getAttribute('aria-expanded')).toBe('true');
  });
});
