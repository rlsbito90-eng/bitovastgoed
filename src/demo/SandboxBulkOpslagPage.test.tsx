import {describe,expect,it} from 'vitest';
import {render,screen,within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SandboxBulkOpslagPage from './SandboxBulkOpslagPage';

describe('Browserproef bulkopslag: geïsoleerde koppeling met dezelfde verzoek-ID',()=>{
 it('selecteert beleggers, vraagt controle, slaat op en toont per-kandidaat audit',async()=>{
   const user=userEvent.setup();
   render(<SandboxBulkOpslagPage/>);
   await user.click(screen.getByLabelText('Selecteer opslagproef Belegger A'));
   await user.click(screen.getByLabelText('Selecteer opslagproef Belegger C'));
   await user.click(screen.getByRole('button',{name:'Voorstel controleren'}));
   expect(screen.getByLabelText('Opslagvoorstel')).toHaveTextContent('Belegger A, Belegger C');
   await user.click(screen.getByRole('button',{name:'Bevestig opslagproef voor 2 kandidaten'}));
   expect(await screen.findByRole('status')).toHaveTextContent('Bevestigd opgeslagen: 2 gewijzigd');
   expect(screen.getByText('Auditregistraties in de proef (2)')).toBeInTheDocument();
   const rows=within(screen.getByLabelText('Opslagproef kandidatenlijst')).getAllByText(/Zeer warm/);
   expect(rows.length).toBeGreaterThanOrEqual(3);
 });
 it('volgt veilig het scenario waarin een ander tabblad de kandidaat tussendoor wijzigt',async()=>{
   const user=userEvent.setup();
   render(<SandboxBulkOpslagPage/>);
   await user.click(screen.getByLabelText('Selecteer opslagproef Belegger C'));
   await user.selectOptions(screen.getByLabelText('Opslagscenario'),'conflict');
   await user.click(screen.getByRole('button',{name:'Voorstel controleren'}));
   await user.click(screen.getByRole('button',{name:'Bevestig opslagproef voor 1 kandidaten'}));
   expect(await screen.findByRole('alert')).toHaveTextContent('elders gewijzigd');
   expect(screen.getByText('Auditregistraties in de proef (0)')).toBeInTheDocument();
   await user.click(screen.getByRole('button',{name:'Ververs fictieve lijst'}));
   expect(await screen.findByRole('status')).toHaveTextContent('gegevens vernieuwd');
 });
 it('herhaalt bij een netwerkstoring exact hetzelfde verzoek zonder dubbele auditregels',async()=>{
   const user=userEvent.setup();
   render(<SandboxBulkOpslagPage/>);
   await user.click(screen.getByLabelText('Selecteer opslagproef Belegger C'));
   await user.selectOptions(screen.getByLabelText('Opslagscenario'),'netwerk');
   await user.click(screen.getByRole('button',{name:'Voorstel controleren'}));
   await user.click(screen.getByRole('button',{name:'Bevestig opslagproef voor 1 kandidaten'}));
   expect(await screen.findByRole('alert')).toHaveTextContent('Verzoek-ID blijft identiek');
   expect(screen.getByText('Auditregistraties in de proef (1)')).toBeInTheDocument();
   await user.click(screen.getByRole('button',{name:'Opnieuw proberen met hetzelfde verzoek-ID'}));
   expect(await screen.findByRole('status')).toHaveTextContent('Bevestigd opgeslagen: 1 gewijzigd');
   expect(screen.getByText('Auditregistraties in de proef (1)')).toBeInTheDocument();
 });
});
