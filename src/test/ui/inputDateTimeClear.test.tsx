import * as React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Input } from '@/components/ui/input';

function ControlledDate() {
  const [value, setValue] = React.useState('2026-08-29');

  return (
    <Input
      type="date"
      aria-label="Volgende actie datum"
      value={value}
      onChange={(event) => setValue(event.target.value)}
    />
  );
}

function ControlledTime() {
  const [value, setValue] = React.useState('19:54');

  return (
    <Input
      type="time"
      aria-label="Tijd"
      value={value}
      onChange={(event) => setValue(event.target.value)}
    />
  );
}

describe('Input — datum/tijd wissen', () => {
  it('wist een controlled datum direct via pointerdown zonder de picker te heropenen', () => {
    render(<ControlledDate />);

    const input = screen.getByLabelText('Volgende actie datum') as HTMLInputElement;
    expect(input.value).toBe('2026-08-29');

    fireEvent.pointerDown(screen.getByRole('button', { name: 'Datum wissen' }));

    expect(input.value).toBe('');
    expect(screen.queryByRole('button', { name: 'Datum wissen' })).not.toBeInTheDocument();
    expect(document.activeElement).not.toBe(input);
  });

  it('wist een controlled tijd via dezelfde centrale wisactie', () => {
    render(<ControlledTime />);

    const input = screen.getByLabelText('Tijd') as HTMLInputElement;
    expect(input.value).toBe('19:54');

    fireEvent.pointerDown(screen.getByRole('button', { name: 'Tijd wissen' }));

    expect(input.value).toBe('');
    expect(screen.queryByRole('button', { name: 'Tijd wissen' })).not.toBeInTheDocument();
  });
});
