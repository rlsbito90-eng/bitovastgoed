import {describe,expect,it,vi} from 'vitest';
import {render,screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ObjectPipelineActies from './ObjectPipelineActies';

describe('Kandidatenacties: één primaire knop en compact menu',()=>{
  it('toont niet standaard drie gelijkwaardige knoppen',()=>{
    render(<ObjectPipelineActies canAdd onAdd={vi.fn()} onOffer={vi.fn()} onReply={vi.fn()}/>);
    expect(screen.getByRole('button',{name:/Kandidaat toevoegen/i})).toBeInTheDocument();
    expect(screen.getByRole('button',{name:'Meer kandidaat-acties'})).toBeInTheDocument();
    expect(screen.queryByText('Aanbieding registreren')).not.toBeInTheDocument();
    expect(screen.queryByText('Reactie registreren')).not.toBeInTheDocument();
  });
  it('behoudt alle registratiemogelijkheden via Meer',async()=>{
    const user=userEvent.setup(), add=vi.fn(), offer=vi.fn(), reply=vi.fn();
    render(<ObjectPipelineActies canAdd onAdd={add} onOffer={offer} onReply={reply}/>);
    await user.click(screen.getByRole('button',{name:'Kandidaat toevoegen'}));
    expect(add).toHaveBeenCalledOnce();
    await user.click(screen.getByRole('button',{name:'Meer kandidaat-acties'}));
    expect(screen.getByText(/er wordt niets verzonden/i)).toBeInTheDocument();
    await user.click(screen.getByRole('menuitem',{name:'Aanbieding registreren'}));
    expect(offer).toHaveBeenCalledOnce();
    await user.click(screen.getByRole('button',{name:'Meer kandidaat-acties'}));
    await user.click(screen.getByRole('menuitem',{name:'Reactie registreren'}));
    expect(reply).toHaveBeenCalledOnce();
  });
  it('laat bestaande registraties beschikbaar als alle relaties al kandidaat zijn',async()=>{
    const user=userEvent.setup(), offer=vi.fn();
    render(<ObjectPipelineActies canAdd={false} onAdd={vi.fn()} onOffer={offer} onReply={vi.fn()}/>);
    expect(screen.getByRole('button',{name:'Kandidaat toevoegen'})).toBeDisabled();
    await user.click(screen.getByRole('button',{name:'Meer kandidaat-acties'}));
    await user.click(screen.getByRole('menuitem',{name:'Aanbieding registreren'}));
    expect(offer).toHaveBeenCalledOnce();
  });
});
