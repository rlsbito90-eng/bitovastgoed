// @vitest-environment jsdom
import React from 'react';
import {afterEach,describe,expect,it,vi} from 'vitest';
import {fireEvent,render,screen} from '@testing-library/react';
import type {Rendementscriterium} from '@/hooks/useRelatieMatchingData';
import RendementscriteriaPanel from './RendementscriteriaPanel';

const criteria:Rendementscriterium[]=[
  {
    id:'invest',relatieId:'rel-1',zoekprofielId:null,
    strategie:'belegging',methode:'netto_onbekend',percentage:8.5,
    criteriumType:'minimum',methodeBevestigd:false,status:'actief',
    toelichting:'Netto minimaal, exacte definitie onbekend',bron:'Gesprek',
    bronDatum:null,
  },
  {
    id:'develop',relatieId:'rel-1',zoekprofielId:null,
    strategie:'ontwikkeling',methode:'onbekend',percentage:20,
    criteriumType:'gemiddeld',methodeBevestigd:false,status:'actief',
    toelichting:null,bron:'Gesprek',bronDatum:null,
  },
];
const props=()=>({
  criteria,zoekprofielen:[],loading:false,fout:null,
  onSave:vi.fn(),onDelete:vi.fn(),
});

afterEach(()=>vi.restoreAllMocks());

describe('Rendementscriteria: klik de criteriumwaarde rechtstreeks',()=>{
  it('opent het netto minimum zonder de onzekere methode als bevestigd te markeren',()=>{
    const p=props();
    render(<RendementscriteriaPanel {...p}/>);
    expect(screen.queryByRole('button',{name:'Rendementscriterium bewerken'})).toBeNull();
    const row=screen.getByRole('button',{name:/Wijzig rendementscriterium Vastgoedbelegging, 8,50%/});
    expect(row).toHaveTextContent('8,50%');
    fireEvent.click(row);
    expect(screen.getByLabelText('Berekeningsmethode')).toHaveValue('netto_onbekend');
    expect(screen.getByLabelText('Betekenis')).toHaveValue('minimum');
    expect(screen.getAllByText('Berekeningsmethode nog verifiëren')).toHaveLength(2);
    expect(p.onSave).not.toHaveBeenCalled();
  });

  it('bewaart de 20,00% ontwikkelgemiddelde als ander criterium, zonder automatische conversie',()=>{
    const p=props();
    render(<RendementscriteriaPanel {...p}/>);
    const row=screen.getByRole('button',{name:/Wijzig rendementscriterium Ontwikkeling, 20,00%/});
    fireEvent.click(row);
    expect(screen.getByLabelText('Betekenis')).toHaveValue('gemiddeld');
    expect(screen.getByLabelText('Berekeningsmethode')).toHaveValue('onbekend');
    expect(p.onSave).not.toHaveBeenCalled();
  });

  it('waarschuwt voor niet-opgeslagen wijzigingen bij het wisselen van criterium',()=>{
    const p=props();
    const confirm=vi.spyOn(window,'confirm').mockReturnValue(false);
    render(<RendementscriteriaPanel {...p}/>);
    fireEvent.click(screen.getByRole('button',{name:/Wijzig rendementscriterium Vastgoedbelegging/}));
    fireEvent.change(screen.getByLabelText('Percentage'),{target:{value:'9,0'}});
    fireEvent.click(screen.getByRole('button',{name:/Wijzig rendementscriterium Ontwikkeling/}));
    expect(confirm).toHaveBeenCalled();
    expect(screen.getByLabelText('Percentage')).toHaveValue('9,0');
    expect(p.onSave).not.toHaveBeenCalled();
  });
});
