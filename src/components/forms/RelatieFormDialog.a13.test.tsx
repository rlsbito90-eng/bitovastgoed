// @vitest-environment jsdom
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { Relatie, RelatieContactpersoon } from '@/data/mock-data';
import RelatieFormDialog from './RelatieFormDialog';

const mocks = vi.hoisted(() => ({
 updateRelatie:vi.fn(),
 addRelatie:vi.fn(),
 updateContactpersoon:vi.fn(),
 addContactpersoon:vi.fn(),
 deleteContactpersoon:vi.fn(),
 close:vi.fn(),
 success:vi.fn(),
 error:vi.fn(),
 confirm:vi.fn(),
 contactpersonen:[] as unknown[],
}));

vi.mock('@/hooks/useDataStore',()=>({
 useDataStore:()=>({
  updateRelatie:mocks.updateRelatie,
  addRelatie:mocks.addRelatie,
  updateContactpersoon:mocks.updateContactpersoon,
  addContactpersoon:mocks.addContactpersoon,
  deleteContactpersoon:mocks.deleteContactpersoon,
  contactpersonen:mocks.contactpersonen,
 }),
}));
vi.mock('@/hooks/usePropertyTaxonomie',()=>({
 usePropertyTaxonomie:()=>({propertyTypes:[],dealTypes:[],subtypesForTypes:()=>[]}),
}));
vi.mock('sonner',()=>({toast:{success:mocks.success,error:mocks.error}}));

const relatie:Relatie={
 id:'synthetisch-rel-1',bedrijfsnaam:'Voorbeeld Makelaars',contactpersoon:'',
 type:'makelaar',commercialRoles:['bemiddelaar'],partijprofiel:null,vastgoedStrategieen:null,
 investeerderSubtype:'bv',telefoon:'030 1234567',email:'algemeen@voorbeeld.test',
 regio:['Utrecht'],assetClasses:['winkels'],propertyTypeIds:['type-winkel'],
 propertySubtypeIds:['sub-winkel'],dealTypeIds:['deal-belegging'],
 budgetMin:300000,budgetMax:1800000,ndaGetekend:true,
 leadStatus:'warm',laatsteContact:'',notities:'Bestaande relatie-informatie',
} as Relatie;

const primair:RelatieContactpersoon={
 id:'cp-1',relatieId:relatie.id,naam:'Contact Test',functie:'Directeur',
 email:'contact@voorbeeld.test',telefoon:'030 5551234',telefoonMobiel:'0612345678',
 isPrimair:true,decisionMaker:true,linkedinUrl:'https://linkedin.com/in/test',
 voorkeurKanaal:'email',notities:'Belangrijke beslisser',
};

beforeEach(()=>{
 vi.clearAllMocks();
 vi.spyOn(window,'confirm').mockReturnValue(true);
 mocks.contactpersonen=[primair];
 mocks.updateRelatie.mockResolvedValue(undefined);
 mocks.updateContactpersoon.mockResolvedValue(undefined);
 mocks.addRelatie.mockResolvedValue({...relatie,id:'synthetisch-nieuw'});
 mocks.addContactpersoon.mockResolvedValue(null);
});

describe('A13 bestaand RelatieFormDialog — synthetisch, geen echte database',()=>{
 it('slaat nieuw profiel en meerdere strategieën op zonder bestaand contact of zoekcriteria aan te passen',async()=>{
  render(<RelatieFormDialog open={true} onOpenChange={mocks.close} relatie={relatie}/>);
  fireEvent.change(screen.getByRole('combobox',{name:'Partijprofiel'}),{
   target:{value:'ontwikkelende_belegger'},
  });
  fireEvent.click(screen.getByRole('checkbox',{name:'Value-add'}));
  fireEvent.click(screen.getByRole('checkbox',{name:'Transformatie'}));
  fireEvent.click(screen.getByRole('button',{name:'Opslaan'}));
  await waitFor(()=>expect(mocks.updateRelatie).toHaveBeenCalledTimes(1));
  const [id,payload]=mocks.updateRelatie.mock.calls[0];
  expect(id).toBe(relatie.id);
  expect(payload).toMatchObject({
   bedrijfsnaam:relatie.bedrijfsnaam,type:'makelaar',commercialRoles:['bemiddelaar'],
   partijprofiel:'ontwikkelende_belegger',
   vastgoedStrategieen:['value_add','transformatie'],
   telefoon:relatie.telefoon,email:relatie.email,regio:['Utrecht'],
   propertyTypeIds:['type-winkel'],budgetMin:300000,budgetMax:1800000,
   notities:'Bestaande relatie-informatie',
  });
  await waitFor(()=>expect(mocks.close).toHaveBeenCalledWith(false));
  expect(mocks.updateContactpersoon).not.toHaveBeenCalled();
  expect(mocks.addContactpersoon).not.toHaveBeenCalled();
  expect(mocks.deleteContactpersoon).not.toHaveBeenCalled();
  expect(mocks.addRelatie).not.toHaveBeenCalled();
 });

 it('verwijdert één strategie zonder de overige strategieën en rollen te wissen',async()=>{
  const bestaand={...relatie,partijprofiel:'ontwikkelaar' as const,
   vastgoedStrategieen:['handel','transformatie'] as const};
  render(<RelatieFormDialog open={true} onOpenChange={mocks.close} relatie={bestaand as Relatie}/>);
  expect((screen.getByRole('combobox',{name:'Partijprofiel'}) as HTMLSelectElement).value)
   .toBe('ontwikkelaar');
  expect((screen.getByRole('checkbox',{name:'Handel'}) as HTMLInputElement).checked).toBe(true);
  fireEvent.click(screen.getByRole('checkbox',{name:'Handel'}));
  fireEvent.click(screen.getByRole('checkbox',{name:'Uitponden'}));
  fireEvent.click(screen.getByRole('button',{name:'Opslaan'}));
  await waitFor(()=>expect(mocks.updateRelatie).toHaveBeenCalledTimes(1));
  const payload=mocks.updateRelatie.mock.calls[0][1];
  expect(payload.vastgoedStrategieen).toEqual(['transformatie','uitponden']);
  expect(payload.partijprofiel).toBe('ontwikkelaar');
  expect(payload.commercialRoles).toEqual(['bemiddelaar']);
  expect(mocks.updateContactpersoon).not.toHaveBeenCalled();
 });

 it('bewaart beslisserstatus en vult leeg gemaakte contactvelden expliciet leeg',async()=>{
  render(<RelatieFormDialog open={true} onOpenChange={mocks.close} relatie={relatie}/>);
  fireEvent.change(screen.getByPlaceholderText('naam@bedrijf.nl'),{target:{value:''}});
  fireEvent.click(screen.getByRole('button',{name:'Opslaan'}));
  await waitFor(()=>expect(mocks.updateContactpersoon).toHaveBeenCalledTimes(1));
  const [id,wijziging]=mocks.updateContactpersoon.mock.calls[0];
  expect(id).toBe(primair.id);
  expect(wijziging.email).toBe('');
  expect(wijziging.naam).toBe('Contact Test');
  expect(wijziging).not.toHaveProperty('decisionMaker');
  expect(wijziging).not.toHaveProperty('linkedinUrl');
  expect(wijziging).not.toHaveProperty('notities');
  expect(mocks.deleteContactpersoon).not.toHaveBeenCalled();
 });

 it('houdt het formulier open als het opslaan van de relatie faalt',async()=>{
  mocks.updateRelatie.mockRejectedValueOnce(new Error('Opslag geweigerd'));
  render(<RelatieFormDialog open={true} onOpenChange={mocks.close} relatie={relatie}/>);
  fireEvent.change(screen.getByRole('combobox',{name:'Partijprofiel'}),{
   target:{value:'vastgoedondernemer'},
  });
  fireEvent.click(screen.getByRole('button',{name:'Opslaan'}));
  await waitFor(()=>expect(mocks.error).toHaveBeenCalledWith('Opslag geweigerd'));
  expect(mocks.close).not.toHaveBeenCalled();
  expect(mocks.updateContactpersoon).not.toHaveBeenCalled();
  expect((screen.getByRole('combobox',{name:'Partijprofiel'}) as HTMLSelectElement).value)
   .toBe('vastgoedondernemer');
 });

 it('voegt nieuwe bemiddelaar toe zonder automatisch koperrol of zoekprofiel',async()=>{
  mocks.contactpersonen=[];
  render(<RelatieFormDialog open={true} onOpenChange={mocks.close}
   initialValues={{bedrijfsnaam:'Nieuw contact',type:'makelaar'}} />);
  fireEvent.change(screen.getByRole('combobox',{name:'Partijprofiel'}),{
   target:{value:'bemiddelaar'},
  });
  fireEvent.click(screen.getByRole('button',{name:'Aanmaken'}));
  await waitFor(()=>expect(mocks.addRelatie).toHaveBeenCalledTimes(1));
  const payload=mocks.addRelatie.mock.calls[0][0];
  expect(payload.partijprofiel).toBe('bemiddelaar');
  expect(payload.commercialRoles).toBeNull();
  expect(payload.type).toBe('makelaar');
  expect(payload.vastgoedStrategieen).toBeNull();
  expect(mocks.updateRelatie).not.toHaveBeenCalled();
 });
 it('vraagt niet om bevestiging bij ongewijzigd sluiten na hydratatie',()=>{
  render(<RelatieFormDialog open={true} onOpenChange={mocks.close} relatie={relatie}/>);
  fireEvent.click(screen.getByTestId('relatie-form-sluiten'));
  expect(window.confirm).not.toHaveBeenCalled();
  expect(mocks.close).toHaveBeenCalledWith(false);
 });

 it('beschermt gewijzigde contactpersoon zonder relatieveldwijziging bij sluiten',()=>{
  vi.mocked(window.confirm).mockReturnValueOnce(false).mockReturnValueOnce(true);
  render(<RelatieFormDialog open={true} onOpenChange={mocks.close} relatie={relatie}/>);
  fireEvent.change(screen.getByPlaceholderText('naam@bedrijf.nl'),{target:{value:'bewerkt@voorbeeld.test'}});
  fireEvent.click(screen.getByTestId('relatie-form-sluiten'));
  expect(window.confirm).toHaveBeenCalledTimes(1);
  expect(mocks.close).not.toHaveBeenCalled();
  fireEvent.click(screen.getByTestId('relatie-form-sluiten'));
  expect(mocks.close).toHaveBeenCalledWith(false);
  expect(mocks.updateContactpersoon).not.toHaveBeenCalled();
 });

 it('beschermt gewijzigd partijprofiel bij sluiten',()=>{
  vi.mocked(window.confirm).mockReturnValueOnce(false);
  render(<RelatieFormDialog open={true} onOpenChange={mocks.close} relatie={relatie}/>);
  fireEvent.change(screen.getByRole('combobox',{name:'Partijprofiel'}),{target:{value:'vastgoedondernemer'}});
  fireEvent.click(screen.getByTestId('relatie-form-sluiten'));
  expect(mocks.close).not.toHaveBeenCalled();
  expect(window.confirm).toHaveBeenCalledTimes(1);
 });

 it('verwijdert de primaire contactpersoon niet als diens naam leeg wordt gemaakt',async()=>{
  render(<RelatieFormDialog open={true} onOpenChange={mocks.close} relatie={relatie}/>);
  fireEvent.change(screen.getByPlaceholderText('Naam contactpersoon'),{target:{value:''}});
  fireEvent.click(screen.getByRole('button',{name:'Opslaan'}));
  await waitFor(()=>expect(mocks.error).toHaveBeenCalledWith(
   'Vul de naam van de primaire contactpersoon in. Verwijderen kan afzonderlijk via Contactpersonen.'
  ));
  expect(mocks.updateRelatie).not.toHaveBeenCalled();
  expect(mocks.deleteContactpersoon).not.toHaveBeenCalled();
  expect(mocks.close).not.toHaveBeenCalled();
 });

 it('waarschuwt voor gedeeltelijke opslag en staat gecontroleerde herpoging toe',async()=>{
  mocks.updateContactpersoon.mockRejectedValueOnce(new Error('Contactgegevens tijdelijk niet bereikbaar'));
  render(<RelatieFormDialog open={true} onOpenChange={mocks.close} relatie={relatie}/>);
  fireEvent.change(screen.getByPlaceholderText('naam@bedrijf.nl'),{target:{value:'gewijzigd@voorbeeld.test'}});
  fireEvent.click(screen.getByRole('button',{name:'Opslaan'}));
  await waitFor(()=>expect(mocks.error).toHaveBeenCalledWith(
   expect.stringContaining('Relatiegegevens zijn opgeslagen, maar de contactpersoon niet')
  ));
  expect(mocks.close).not.toHaveBeenCalled();
  expect(mocks.updateRelatie).toHaveBeenCalledTimes(1);
  expect(mocks.updateContactpersoon).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole('button',{name:'Opslaan'}));
  await waitFor(()=>expect(mocks.updateContactpersoon).toHaveBeenCalledTimes(2));
  await waitFor(()=>expect(mocks.close).toHaveBeenCalledWith(false));
  expect(mocks.deleteContactpersoon).not.toHaveBeenCalled();
 });

 it('herhaalt aanmaken niet bij gedeeltelijke mislukking nieuwe relatie en koppelt pas bij succes',async()=>{
  mocks.contactpersonen=[];
  mocks.addContactpersoon.mockRejectedValueOnce(new Error('Primaire contactpersoon niet aangemaakt'))
   .mockResolvedValueOnce({...primair,id:'nieuw-cp-1'});
  const onCreated=vi.fn();
  render(<RelatieFormDialog open={true} onOpenChange={mocks.close}
   initialValues={{bedrijfsnaam:'Nieuw testbedrijf'}} initialPrimaireContactpersoon={{naam:'Nieuw contact'}}
   onCreated={onCreated} />);
  fireEvent.click(screen.getByRole('button',{name:'Aanmaken'}));
  await waitFor(()=>expect(mocks.error).toHaveBeenCalledWith(
   expect.stringContaining('Relatiegegevens zijn opgeslagen, maar de contactpersoon niet')
  ));
  expect(onCreated).not.toHaveBeenCalled();
  expect(mocks.addRelatie).toHaveBeenCalledTimes(1);
  expect(mocks.close).not.toHaveBeenCalled();
  // Ondanks ongewijzigde prefillvelden moet gedeeltelijke opslag beschermd blijven.
  vi.mocked(window.confirm).mockReturnValueOnce(false);
  fireEvent.click(screen.getByTestId('relatie-form-sluiten'));
  expect(window.confirm).toHaveBeenCalledTimes(1);
  expect(mocks.close).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button',{name:'Opslaan'}));
  await waitFor(()=>expect(onCreated).toHaveBeenCalledWith('synthetisch-nieuw'));
  expect(mocks.addRelatie).toHaveBeenCalledTimes(1);
  expect(mocks.addContactpersoon).toHaveBeenCalledTimes(2);
  expect(mocks.updateRelatie).toHaveBeenCalledWith('synthetisch-nieuw',expect.any(Object));
  expect(mocks.close).toHaveBeenCalledWith(false);
 });

 it('blokkeert sluiten tijdens lopende opslag',async()=>{
  let klaar!:()=>void;
  mocks.updateRelatie.mockImplementationOnce(()=>new Promise<void>(resolve=>{klaar=resolve;}));
  render(<RelatieFormDialog open={true} onOpenChange={mocks.close} relatie={relatie}/>);
  fireEvent.click(screen.getByRole('button',{name:'Opslaan'}));
  await waitFor(()=>expect(mocks.updateRelatie).toHaveBeenCalledTimes(1));
  expect(screen.getByTestId('relatie-form-sluiten')).toBeDisabled();
  klaar();
  await waitFor(()=>expect(mocks.close).toHaveBeenCalledWith(false));
 });

});
