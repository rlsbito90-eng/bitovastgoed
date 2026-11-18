// @vitest-environment jsdom
import {describe,it,expect,vi} from 'vitest';
import {fireEvent,render,screen,waitFor} from '@testing-library/react';
import type {ObjectVastgoed} from '@/data/mock-data';
import ObjectLocatieInline from './ObjectLocatieInline';

const object={id:'o',adres:'Straat 10',postcode:'1234 AB',plaats:'Utrecht',
  provincie:'Utrecht',publiekeRegio:'Regio Utrecht',
  geoLat:52.1,geoLon:5.1,geoBron:'BAG',geoGeverifieerdOp:'2026-11-02'} as ObjectVastgoed;
describe('Objectadres direct op de dossierkaart wijzigen',()=>{
  it('bewerkt locatie als één geheel, zonder groot objectformulier',async()=>{
    const save=vi.fn().mockResolvedValue(undefined);
    render(<ObjectLocatieInline object={object} onSave={save}/>);
    fireEvent.click(screen.getByRole('button',{name:'Wijzigen'}));
    fireEvent.change(screen.getByRole('textbox',{name:'Adres'}),{target:{value:'Nieuweweg 22'}});
    expect(save).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button',{name:'Opslaan'}));
    await waitFor(()=>expect(save).toHaveBeenCalledWith({
      adres:'Nieuweweg 22',geoLat:null,geoLon:null,geoBron:null,geoGeverifieerdOp:null,
    }));
  });
  it('annuleert zonder aan de bestaande locatie te komen',()=>{
    const save=vi.fn();
    render(<ObjectLocatieInline object={object} onSave={save}/>);
    fireEvent.click(screen.getByRole('button',{name:'Wijzigen'}));
    fireEvent.change(screen.getByRole('textbox',{name:'Plaats'}),{target:{value:'Amersfoort'}});
    fireEvent.click(screen.getByRole('button',{name:'Annuleren'}));
    expect(save).not.toHaveBeenCalled();
    expect(screen.getAllByText('Utrecht')).toHaveLength(2);
  });
  it('wijzigt alleen publieke regio zonder BAG te resetten',async()=>{
    const save=vi.fn().mockResolvedValue(undefined);
    render(<ObjectLocatieInline object={object} onSave={save}/>);
    fireEvent.click(screen.getByRole('button',{name:'Wijzigen'}));
    fireEvent.change(screen.getByRole('textbox',{name:'Publieke regio'}),{target:{value:'Midden-Nederland'}});
    fireEvent.click(screen.getByRole('button',{name:'Opslaan'}));
    await waitFor(()=>expect(save).toHaveBeenCalledWith({publiekeRegio:'Midden-Nederland'}));
  });
});