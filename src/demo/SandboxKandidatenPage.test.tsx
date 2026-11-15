import {describe,expect,it} from 'vitest';
import {render,screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SandboxKandidatenPage from './SandboxKandidatenPage';

describe('Kandidaatinterface in de gescheiden browserproef',()=>{
  it('toont slechts één primaire kandidaat-actie en een secundair menu',()=>{
    render(<SandboxKandidatenPage/>);
    expect(screen.getByRole('button',{name:'Kandidaat toevoegen'})).toBeInTheDocument();
    expect(screen.getByRole('button',{name:'Meer kandidaat-acties'})).toBeInTheDocument();
    expect(screen.getByText(/8 kandidaten in pipeline/)).toBeInTheDocument();
  });
  it('maakt duidelijk dat een aanbieding registreren geen bericht verzendt',async()=>{
    const user=userEvent.setup();
    render(<SandboxKandidatenPage/>);
    await user.click(screen.getByRole('button',{name:'Meer kandidaat-acties'}));
    await user.click(screen.getByRole('menuitem',{name:'Aanbieding registreren'}));
    expect(screen.getByRole('status')).toHaveTextContent('niets geregistreerd of verzonden');
  });
});
