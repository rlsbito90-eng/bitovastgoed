import { describe, expect, it } from 'vitest';
import { standaardOpvolgTitel } from './opvolging';

describe('biedboek-opvolging', () => {
  it('richt opvolging na een verkopersvoorstel aan de koper', () => {
    expect(standaardOpvolgTitel({ fase: 'wacht_op_koper' }, 'Jasper', 'Amsterdam'))
      .toBe('Koper opvolgen · Jasper · Amsterdam');
  });

  it('richt opvolging na een kopersbod aan de verkoper', () => {
    expect(standaardOpvolgTitel({ fase: 'wacht_op_verkoper' }, 'Jasper', 'Amsterdam'))
      .toBe('Verkoper opvolgen over bod van Jasper · Amsterdam');
  });
});
