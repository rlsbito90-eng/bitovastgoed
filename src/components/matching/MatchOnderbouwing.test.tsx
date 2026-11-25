import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MatchOnderbouwing } from './MatchOnderbouwing';
import type { ProfielRoute } from '@/lib/matching/rolMandaatAdapter';

const route: ProfielRoute = {
  key:'basis',zoekprofielId:null,bron:'relatie_basis',naam:'Algemene criteria',
  route:'directe_partij',kwalificatie:'te_verifieren',bevestiging:'bevestigd',
  koperRelatieId:'koper',redenVanRoute:'algemeen',
  toelichting:{
    matcht:['Vastgoedtype komt overeen'],
    controleer:['Harde aankoopvoorwaarden van de relatie verifiëren vóór benadering'],
    afwijkend:[],
    voorwaarden:[
      {soort:'hard',tekst:'Minimaal 70% bedrijfsruimte'},
      {soort:'voorkeur',tekst:'Bij voorkeur verhuurd'},
    ],
  },
};
describe('MatchOnderbouwing',()=>{
  it('toont de concrete harde voorwaarde direct en houdt voorkeuren apart',()=>{
    const {container}=render(<MatchOnderbouwing route={route}/>);
    const details=container.querySelector('details');
    expect(details?.open).toBe(false);
    const preview=screen.getByTestId('match-onderbouwing').firstElementChild as HTMLElement;
    expect(within(preview).getByText('Minimaal 70% bedrijfsruimte')).toBeTruthy();
    expect(within(preview).getByText('Harde aankoopvoorwaarde · te controleren')).toBeTruthy();
    expect(within(preview).queryByText('Bij voorkeur verhuurd')).toBeNull();
    expect(within(details as HTMLElement).getByText('Voorkeur · niet-bindend')).toBeTruthy();
    expect(within(details as HTMLElement).getByText('Bij voorkeur verhuurd')).toBeTruthy();
  });
  it('presenteert een aantoonbare afwijking vóór een algemene controle',()=>{
    const {container}=render(<MatchOnderbouwing route={{...route,toelichting:{
      ...route.toelichting,afwijkend:['Vraagprijs buiten opgegeven budgetgrenzen'],
    }}}/>);
    const preview=container.querySelector('[data-testid="match-onderbouwing"]')?.firstElementChild as HTMLElement;
    expect(within(preview).getByText('Vraagprijs buiten opgegeven budgetgrenzen')).toBeTruthy();
  });
});
