import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TestMatchingPage from './TestMatchingPage';

describe('Isolatie van demo-matching zonder login',()=>{
  beforeEach(()=>{localStorage.clear();});
  it('start met voorbeeldcomplex en voldoet aan 70% harde eis',()=>{
    render(<TestMatchingPage/>);
    expect(screen.getByRole('status')).toHaveTextContent('Voldoet');
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });
  it('65% met harde eis valt af',async()=>{
    const u=userEvent.setup();render(<TestMatchingPage/>);
    await u.selectOptions(screen.getByLabelText('Voorbeeldobject'),'gemengd');
    expect(screen.getByRole('status')).toHaveTextContent('Afgevallen — harde eis');
  });
  it('65% als voorkeur is geen harde afwijzing',async()=>{
    const u=userEvent.setup();render(<TestMatchingPage/>);
    await u.selectOptions(screen.getByLabelText('Voorbeeldobject'),'gemengd');
    await u.selectOptions(screen.getByLabelText('Sterkte'),'voorkeur');
    expect(screen.getByRole('status')).toHaveTextContent('Afwijkende voorkeur');
  });
  it('ontbrekend brongegeven wordt controle nodig',async()=>{
    const u=userEvent.setup();render(<TestMatchingPage/>);
    await u.selectOptions(screen.getByLabelText('Voorbeeldobject'),'onbekend');
    expect(screen.getByRole('status')).toHaveTextContent('Controle nodig');
  });
  it('herstelt de fictieve waarden zonder productiemutatie',async()=>{
    const u=userEvent.setup();render(<TestMatchingPage/>);
    await u.selectOptions(screen.getByLabelText('Voorbeeldobject'),'gemengd');
    await u.click(screen.getByRole('button',{name:'Herstellen'}));
    expect(screen.getByRole('status')).toHaveTextContent('Voldoet');
  });
});
