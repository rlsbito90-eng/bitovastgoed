// @vitest-environment jsdom
import { useState } from 'react';
import { describe,it,expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { Partijprofiel, VastgoedStrategie } from '@/data/mock-data';
import PartijprofielVelden from './PartijprofielVelden';

function TestForm(){
 const [profiel,setProfiel]=useState<Partijprofiel|null>(null);
 const [strategieen,setStrategieen]=useState<VastgoedStrategie[]|null>(null);
 return <div>
  <p>Hoofdtype: belegger</p>
  <p>Commerciële rollen: niet gewijzigd</p>
  <PartijprofielVelden partijprofiel={profiel} vastgoedStrategieen={strategieen}
    onProfielChange={setProfiel} onStrategieenChange={setStrategieen}/>
  <output data-testid="waarde">{profiel??'onbekend'} | {(strategieen??[]).join(', ')||'geen strategie'}</output>
 </div>;
}
describe('Partijprofiel interactie — gecontroleerd en zonder opslag',()=>{
 it('toont een leeg profiel, zonder automatisch een koperrol aan te nemen',()=>{
  render(<TestForm/>);
  expect(screen.getByTestId('waarde').textContent).toContain('onbekend');
  expect(screen.getByText('Commerciële rollen: niet gewijzigd')).toBeTruthy();
 });
 it('kan ontwikkelende belegger plus meerdere strategieën kiezen',()=>{
  render(<TestForm/>);
  fireEvent.change(screen.getByLabelText('Partijprofiel'),{target:{value:'ontwikkelende_belegger'}});
  fireEvent.click(screen.getByLabelText('Value-add'));
  fireEvent.click(screen.getByLabelText('Transformatie'));
  const status=screen.getByTestId('waarde').textContent||'';
  expect(status).toContain('ontwikkelende_belegger');
  expect(status).toContain('value_add');
  expect(status).toContain('transformatie');
  expect(screen.getByText('Hoofdtype: belegger')).toBeTruthy();
 });
 it('kan afzonderlijke strategieën verwijderen zonder ander veld te wissen',()=>{
  render(<TestForm/>);
  fireEvent.change(screen.getByLabelText('Partijprofiel'),{target:{value:'ontwikkelaar'}});
  fireEvent.click(screen.getByLabelText('Uitponden'));
  fireEvent.click(screen.getByLabelText('Handel'));
  fireEvent.click(screen.getByLabelText('Uitponden'));
  const status=screen.getByTestId('waarde').textContent||'';
  expect(status).toContain('ontwikkelaar');
  expect(status).toContain('handel');
  expect(status).not.toContain('uitponden');
 });
 it('laat ook bemiddelaars classificeren zonder een mandaatvraag',()=>{
  render(<TestForm/>);
  fireEvent.change(screen.getByLabelText('Partijprofiel'),{target:{value:'bemiddelaar'}});
  expect(screen.getByTestId('waarde').textContent).toContain('bemiddelaar');
  expect(screen.queryByText(/mandaat verplicht/i)).toBeNull();
 });
});
