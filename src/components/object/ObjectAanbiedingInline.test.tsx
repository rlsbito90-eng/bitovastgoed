// @vitest-environment jsdom
import {describe,it,expect,vi} from 'vitest';
import {fireEvent,render,screen,waitFor} from '@testing-library/react';
import type {ObjectVastgoed} from '@/data/mock-data';
import ObjectAanbiedingInline from './ObjectAanbiedingInline';

describe('Aanbiedingswijze rechtstreeks bewerken',()=>{
  it('slaat alleen de geselecteerde aanbiedingswijze op',async()=>{
    const save=vi.fn().mockResolvedValue(undefined);
    const object={id:'obj',aanbiedingswijze:'off_market',anoniem:true} as ObjectVastgoed;
    render(<ObjectAanbiedingInline object={object} onSave={save}/>);
    fireEvent.change(screen.getByLabelText('Aanbiedingswijze'),{target:{value:'openbaar'}});
    await waitFor(()=>expect(save).toHaveBeenCalledWith({aanbiedingswijze:'openbaar'}));
    expect(save.mock.calls[0][0]).not.toHaveProperty('anoniem');
  });
});