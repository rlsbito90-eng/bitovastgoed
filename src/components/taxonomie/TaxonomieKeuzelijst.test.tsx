// @vitest-environment jsdom
import {describe,it,expect,vi} from 'vitest';
import {fireEvent,render,screen} from '@testing-library/react';
import TaxonomieKeuzelijst from './TaxonomieKeuzelijst';

const options=[
  {id:'woning',label:'Wonen'},
  {id:'kantoor',label:'Kantoren'},
  {id:'winkel',label:'Winkels'},
  {id:'industrieel',label:'Industrieel'},
  {id:'logistiek',label:'Logistiek'},
  {id:'zorg',label:'Zorgvastgoed'},
  {id:'hotel',label:'Hotels'},
];

describe('Compacte taxonomiepicker',()=>{
  it('toont geselecteerde waarden eerst, zonder gekleurde tegelknoppen',()=>{
    const change=vi.fn();
    render(<TaxonomieKeuzelijst options={options} value={['winkel']} onChange={change}/>);
    expect(screen.getByText('1 geselecteerd')).toBeTruthy();
    const checks=screen.getAllByRole('checkbox') as HTMLInputElement[];
    expect(checks[0].checked).toBe(true);
    expect(screen.getByRole('checkbox',{name:'Winkels'})).toBeTruthy();
    fireEvent.click(screen.getByRole('checkbox',{name:'Kantoren'}));
    expect(change).toHaveBeenCalledWith(['winkel','kantoor']);
  });
  it('kan zoeken zonder bestaande selecties te verliezen',()=>{
    const change=vi.fn();
    render(<TaxonomieKeuzelijst options={options} value={['winkel']} onChange={change}/>);
    fireEvent.change(screen.getByRole('searchbox',{name:'Zoeken in classificatie'}),
      {target:{value:'Zorg'}});
    expect(screen.getByRole('checkbox',{name:'Zorgvastgoed'})).toBeTruthy();
    expect(screen.queryByRole('checkbox',{name:'Winkels'})).toBeNull();
    expect(screen.getByText('1 geselecteerd')).toBeTruthy();
    fireEvent.click(screen.getByRole('checkbox',{name:'Zorgvastgoed'}));
    expect(change).toHaveBeenCalledWith(['winkel','zorg']);
  });
  it('behoudt onbekende historische opties die expliciet zijn meegegeven',()=>{
    const change=vi.fn();
    render(<TaxonomieKeuzelijst options={[...options,{id:'oud',label:'Historisch type (oud)'}]}
      value={['oud']} onChange={change}/>);
    expect((screen.getByRole('checkbox',{name:'Historisch type (oud)'}) as HTMLInputElement).checked)
      .toBe(true);
  });
});
