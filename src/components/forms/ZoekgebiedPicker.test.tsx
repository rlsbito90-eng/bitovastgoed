// @vitest-environment jsdom
import React, { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import ZoekgebiedPicker from './ZoekgebiedPicker';
import { zoekPdokWoonplaatsen } from '@/lib/bag/pdokLookup';

vi.mock('@/lib/bag/pdokLookup', () => ({
  zoekPdokWoonplaatsen: vi.fn(async (zoektekst: string) =>
    ['Apeldoorn','Deventer','Breda','Tilburg']
      .filter(naam=>naam.toLowerCase().includes(zoektekst.toLowerCase()))
      .map((naam,i)=>({id:'w'+i,woonplaats:naam,weergavenaam:naam,type:'woonplaats'}))
  ),
}));

function Scherm({initialGemeenten=[],initialPlaatsen=[]}:{
  initialGemeenten?:string[];initialPlaatsen?:string[];
}){
  const [gemeenten,setGemeenten]=useState(initialGemeenten);
  const [plaatsen,setPlaatsen]=useState(initialPlaatsen);
  return <div>
    <ZoekgebiedPicker gemeenten={gemeenten} plaatsen={plaatsen}
      onChange={next=>{setGemeenten(next.gemeenten);setPlaatsen(next.plaatsen);}}/>
    <output data-testid="waarden">{JSON.stringify({gemeenten,plaatsen})}</output>
  </div>;
}
afterEach(()=>vi.clearAllMocks());

describe('Eén zoekveld voor plaatsen én gemeenten',()=>{
  it('laat Apeldoorn en Deventer als woonplaatsen kiezen zonder gemeenten te vullen',async()=>{
    render(<Scherm/>);
    const zoek=screen.getByRole('textbox',{name:'Zoek plaats of gemeente'});
    fireEvent.change(zoek,{target:{value:'Apel'}});
    fireEvent.click(await within(screen.getByRole('group',{name:'Plaatsen'})).findByRole('checkbox',{name:'Plaats Apeldoorn'}));
    expect(screen.getByTestId('waarden').textContent).toBe('{"gemeenten":[],"plaatsen":["Apeldoorn"]}');
    fireEvent.change(zoek,{target:{value:'Deven'}});
    fireEvent.click(await within(screen.getByRole('group',{name:'Plaatsen'})).findByRole('checkbox',{name:'Plaats Deventer'}));
    expect(screen.getByTestId('waarden').textContent).toBe('{"gemeenten":[],"plaatsen":["Apeldoorn","Deventer"]}');
  });

  it('kiest expliciet de hele gemeente zonder automatisch de plaats toe te voegen',()=>{
    render(<Scherm/>);
    fireEvent.change(screen.getByRole('textbox',{name:'Zoek plaats of gemeente'}),{target:{value:'Apel'}});
    fireEvent.click(within(screen.getByRole('group',{name:'Gemeenten'})).getByRole('checkbox',{name:'Gemeente Apeldoorn'}));
    expect(screen.getByTestId('waarden').textContent).toBe('{"gemeenten":["Apeldoorn"],"plaatsen":[]}');
  });

  it('bewaart zowel bestaande plaatsen als gemeenten zonder ze te dupliceren',async()=>{
    render(<Scherm initialGemeenten={['Deventer']} initialPlaatsen={['Apeldoorn']}/>);
    expect(screen.getByRole('button',{name:'Verwijder plaats Apeldoorn'})).toBeTruthy();
    expect(screen.getByRole('button',{name:'Verwijder gemeente Deventer'})).toBeTruthy();
    await waitFor(()=>expect(zoekPdokWoonplaatsen).not.toHaveBeenCalled());
    fireEvent.click(screen.getByRole('button',{name:'Verwijder gemeente Deventer'}));
    expect(screen.getByTestId('waarden').textContent).toBe('{"gemeenten":[],"plaatsen":["Apeldoorn"]}');
  });
});