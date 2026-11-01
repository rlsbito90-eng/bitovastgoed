// @vitest-environment jsdom
import React from 'react';
import { describe,it,expect,vi } from 'vitest';
import { render,screen,fireEvent,waitFor } from '@testing-library/react';
import type { Relatie } from '@/data/mock-data';
import InlineRelatieSectie from './InlineRelatieSectie';

const relatie={
  id:'test-relatie',bedrijfsnaam:'Voorbeeld BV',type:'belegger',
  partijprofiel:'fonds',commercialRoles:['koper'],vastgoedStrategieen:['value_add'],
  contactpersoon:'',telefoon:'0101234567',email:'info@voorbeeld.test',
  regio:['Zuid-Holland'],assetClasses:[],budgetMin:200000,budgetMax:800000,
  rendementseis:6.5,ndaGetekend:true,leadStatus:'warm',laatsteContact:'',
} as Relatie;
const company=[{key:'bedrijfsnaam',label:'Bedrijfsnaam'},{key:'website',label:'Website'}] as const;
const finance=[{key:'budgetMin',label:'Budget minimum',kind:'number'},{key:'budgetMax',label:'Budget maximum',kind:'number'}] as const;

describe('Direct bewerken relatiegegevens — geïsoleerde patch',()=>{
  it('toont ook lege velden in het volledige profiel',()=>{
    render(<InlineRelatieSectie titel="Bedrijf" relatie={relatie} velden={company} onSave={vi.fn()}/>);
    expect(screen.getByText('Bedrijfsnaam')).toBeTruthy();
    expect(screen.getByText('Website')).toBeTruthy();
    expect(screen.getByText('—')).toBeTruthy();
  });
  it('wijzigt alleen bedrijf zonder budgets of rollen opnieuw op te slaan',async()=>{
    const save=vi.fn().mockResolvedValue(undefined);
    render(<InlineRelatieSectie titel="Bedrijf" relatie={relatie} velden={company} onSave={save}/>);
    fireEvent.click(screen.getByRole('button',{name:'Bedrijf bewerken'}));
    fireEvent.change(screen.getByLabelText('Website'),{target:{value:'https://voorbeeld.test'}});
    fireEvent.click(screen.getByRole('button',{name:'Opslaan'}));
    await waitFor(()=>expect(save).toHaveBeenCalledWith({website:'https://voorbeeld.test'}));
    expect(save.mock.calls[0][0]).not.toHaveProperty('budgetMin');
    expect(save.mock.calls[0][0]).not.toHaveProperty('type');
    expect(save.mock.calls[0][0]).not.toHaveProperty('commercialRoles');
  });
  it('leegmaken van een numeriek veld geeft alleen dat veld als expliciet clearing',async()=>{
    const save=vi.fn().mockResolvedValue(undefined);
    render(<InlineRelatieSectie titel="Financiering" relatie={relatie} velden={finance} onSave={save}/>);
    fireEvent.click(screen.getByRole('button',{name:'Financiering bewerken'}));
    fireEvent.change(screen.getByLabelText('Budget minimum'),{target:{value:''}});
    fireEvent.click(screen.getByRole('button',{name:'Opslaan'}));
    await waitFor(()=>expect(save).toHaveBeenCalledTimes(1));
    expect(Object.prototype.hasOwnProperty.call(save.mock.calls[0][0],'budgetMin')).toBe(true);
    expect(save.mock.calls[0][0]).not.toHaveProperty('budgetMax');
  });
  it('weigert negatieve budgetten en behoudt het formulier bij een fout',async()=>{
    const save=vi.fn();
    render(<InlineRelatieSectie titel="Financiering" relatie={relatie} velden={finance} onSave={save}/>);
    fireEvent.click(screen.getByRole('button',{name:'Financiering bewerken'}));
    fireEvent.change(screen.getByLabelText('Budget maximum'),{target:{value:'-2'}});
    fireEvent.click(screen.getByRole('button',{name:'Opslaan'}));
    expect(screen.getByRole('alert').textContent).toContain('Ongeldige waarde');
    expect(save).not.toHaveBeenCalled();
  });
  it('beschermt niet-opgeslagen wijzigingen bij annuleren',()=>{
    const save=vi.fn();
    const confirm=vi.spyOn(window,'confirm').mockReturnValue(false);
    render(<InlineRelatieSectie titel="Bedrijf" relatie={relatie} velden={company} onSave={save}/>);
    fireEvent.click(screen.getByRole('button',{name:'Bedrijf bewerken'}));
    fireEvent.change(screen.getByLabelText('Website'),{target:{value:'https://ander.test'}});
    fireEvent.click(screen.getByRole('button',{name:'Annuleren'}));
    expect(confirm).toHaveBeenCalled();
    expect(screen.getByLabelText('Website')).toBeTruthy();
    expect(save).not.toHaveBeenCalled();
    confirm.mockRestore();
  });
});
