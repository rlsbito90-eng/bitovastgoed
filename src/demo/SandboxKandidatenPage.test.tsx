import {describe,expect,it} from 'vitest';
import {render,screen,within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SandboxKandidatenPage from './SandboxKandidatenPage';

const setup=()=>render(<SandboxKandidatenPage/>);
describe('Bulkbewerkingen en sortering als veilige browserproef',()=>{
  it('toont één primaire knop met meer-menu, sortering en zes actieve kandidaten',()=>{
    setup();
    expect(screen.getByRole('button',{name:'Kandidaat toevoegen'})).toBeInTheDocument();
    expect(screen.getByRole('button',{name:'Meer kandidaat-acties'})).toBeInTheDocument();
    expect(screen.getByLabelText('Sorteer kandidaten')).toHaveValue('aanbevolen');
    expect(within(screen.getByLabelText('Fictieve kandidaatlijst')).getAllByRole('checkbox')).toHaveLength(6);
  });
  it('toont via Meer dat registraties niet werkelijk worden uitgevoerd',async()=>{
    const u=userEvent.setup();setup();
    await u.click(screen.getByRole('button',{name:'Meer kandidaat-acties'}));
    await u.click(screen.getByRole('menuitem',{name:'Aanbieding registreren'}));
    expect(screen.getByRole('status')).toHaveTextContent('niets geregistreerd of verzonden');
  });
  it('selecteert twee kandidaten en past één interne afwijzingsreden toe',async()=>{
    const u=userEvent.setup();setup();
    await u.click(screen.getByLabelText('Selecteer Belegger A'));
    await u.click(screen.getByLabelText('Selecteer Belegger C'));
    await u.click(screen.getByRole('button',{name:'Toepassen op 2 kandidaten'}));
    expect(screen.getByRole('alert')).toHaveTextContent('Kies eerst één afwijzingscategorie');
    await u.selectOptions(screen.getByLabelText('Afwijzingscategorie'),'locatie');
    await u.click(screen.getByRole('button',{name:'Toepassen op 2 kandidaten'}));
    expect(screen.getByRole('status')).toHaveTextContent('2 kandidaten afgewezen');
    await u.selectOptions(screen.getByLabelText('Filter kandidaten'),'afgevallen');
    expect(within(screen.getByLabelText('Fictieve kandidaatlijst')).getAllByRole('checkbox')).toHaveLength(4);
    expect(screen.getAllByText(/Intern uitgesloten/)).toHaveLength(3);
  });
  it('selecteert alle zichtbare kandidaten en kan in bulk de fase veranderen',async()=>{
    const u=userEvent.setup();setup();
    await u.click(screen.getByLabelText('Selecteer alle zichtbare kandidaten'));
    await u.selectOptions(screen.getByLabelText('Bulkactie'),'fase');
    await u.selectOptions(screen.getByLabelText('Nieuwe pipelinefase'),'nda_verstuurd');
    await u.click(screen.getByRole('button',{name:'Toepassen op 6 kandidaten'}));
    expect(screen.getByRole('status')).toHaveTextContent('6 kandidaten naar een andere fase gezet');
    expect(screen.getAllByText(/NDA verstuurd/).length).toBeGreaterThanOrEqual(6);
  });
  it('maakt afgevallen kandidaten zichtbaar en sorteert alle kandidaten op match',async()=>{
    const u=userEvent.setup();setup();
    await u.selectOptions(screen.getByLabelText('Filter kandidaten'),'alle');
    await u.selectOptions(screen.getByLabelText('Sorteer kandidaten'),'match');
    const rows=within(screen.getByLabelText('Fictieve kandidaatlijst')).getAllByRole('checkbox');
    expect(rows).toHaveLength(8);
    const names=within(screen.getByLabelText('Fictieve kandidaatlijst')).getAllByText(/^Belegger [A-H]$/);
    expect(names[0]).toHaveTextContent('Belegger A');
    expect(names[1]).toHaveTextContent('Belegger G');
    await u.selectOptions(screen.getByLabelText('Filter kandidaten'),'actief');
    expect(screen.getByText(/6 zichtbaar · 0 geselecteerd/)).toBeInTheDocument();
  });
});
