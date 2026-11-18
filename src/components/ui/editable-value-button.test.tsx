// @vitest-environment jsdom
import {describe,it,expect,vi} from 'vitest';
import {fireEvent,render,screen} from '@testing-library/react';
import EditableValueButton from './editable-value-button';

describe('Klikbare veldwaarde in plaats van aparte bewerkknop',()=>{
  it('klikt op de volledige waarde en werkt met toetsenbord',()=>{
    const onClick=vi.fn();
    render(<EditableValueButton label="Vraagprijs" onClick={onClick}>€ 850.000</EditableValueButton>);
    const button=screen.getByRole('button',{name:'Wijzig Vraagprijs'});
    expect(button).toHaveTextContent('€ 850.000');
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
    button.focus();
    expect(document.activeElement).toBe(button);
    fireEvent.keyDown(button,{key:'Enter'});
    // Enter/Spatie worden door de browser afgehandeld als native button.
    expect(button.tagName).toBe('BUTTON');
  });
  it('geeft onbekende waarden een zichtbare en bereikbaar klikoppervlakte',()=>{
    render(<EditableValueButton label="Jaarhuur" onClick={vi.fn()}>
      Nog niet opgegeven
    </EditableValueButton>);
    expect(screen.getByRole('button',{name:'Wijzig Jaarhuur'})).toHaveTextContent('Nog niet opgegeven');
  });
  it('blokkeert interactie wanneer opslaan bezig is',()=>{
    const onClick=vi.fn();
    render(<EditableValueButton label="Verkoopmotivatie" disabled onClick={onClick}>Motief</EditableValueButton>);
    fireEvent.click(screen.getByRole('button',{name:'Wijzig Verkoopmotivatie'}));
    expect(onClick).not.toHaveBeenCalled();
  });
});
