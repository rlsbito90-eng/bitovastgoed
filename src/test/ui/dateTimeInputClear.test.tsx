import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Input } from '@/components/ui/input';

function ControlledInput({ type, initialValue }: { type: 'date' | 'time'; initialValue: string }) {
  const [value, setValue] = useState(initialValue);
  return <Input type={type} value={value} onChange={(event) => setValue(event.target.value)} />;
}

describe('Input — datum en tijd wissen', () => {
  it('wist een ingevulde datum en stuurt de lege waarde naar de controlled state', () => {
    render(<ControlledInput type="date" initialValue="2026-08-29" />);

    const input = screen.getByDisplayValue('2026-08-29') as HTMLInputElement;
    fireEvent.click(screen.getByRole('button', { name: 'Datum wissen' }));

    expect(input.value).toBe('');
    expect(screen.queryByRole('button', { name: 'Datum wissen' })).toBeNull();
  });

  it('wist een ingevulde tijd', () => {
    render(<ControlledInput type="time" initialValue="18:40" />);

    const input = screen.getByDisplayValue('18:40') as HTMLInputElement;
    fireEvent.click(screen.getByRole('button', { name: 'Tijd wissen' }));

    expect(input.value).toBe('');
  });

  it('verandert gewone tekstvelden niet', () => {
    render(<Input type="text" value="Bito" readOnly />);
    expect(screen.queryByRole('button', { name: /wissen/i })).toBeNull();
  });
});
