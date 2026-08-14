import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { bepaalVastgoedkansReactieVervolgadvies } from '@/lib/vastgoedkansReactieVervolg';

const kaartBron = fs.readFileSync(path.resolve('src/components/acquisitie/AcquisitieBrievenStatusKaart.tsx'), 'utf8');
const mutatieBron = fs.readFileSync(path.resolve('src/hooks/useVastgoedkansReactieVervolg.tsx'), 'utf8');

describe('BUILD 2.0C — reactie naar bewuste commerciële vervolgstap', () => {
  it('stuurt positieve signalen naar Positieve reactie', () => {
    expect(bepaalVastgoedkansReactieVervolgadvies('interesse')?.status).toBe('positieve_reactie');
    expect(bepaalVastgoedkansReactieVervolgadvies('wil_meer_informatie')?.status).toBe('positieve_reactie');
    expect(bepaalVastgoedkansReactieVervolgadvies('gesprek_gepland')?.status).toBe('positieve_reactie');
  });

  it('vereist een concrete datum voor wachten en een gepland gesprek', () => {
    expect(bepaalVastgoedkansReactieVervolgadvies('later_opnieuw_benaderen')).toMatchObject({ status: 'wachten', datumVereist: true });
    expect(bepaalVastgoedkansReactieVervolgadvies('gesprek_gepland')?.datumVereist).toBe(true);
  });

  it('behandelt verkeerd adres en retourpost als onderzoek, niet als afgevallen', () => {
    expect(bepaalVastgoedkansReactieVervolgadvies('verkeerd_adres')?.status).toBe('onderzoek');
    expect(bepaalVastgoedkansReactieVervolgadvies('retour_post')?.status).toBe('onderzoek');
  });

  it('stelt afvallen alleen voor bij expliciet negatieve of niet-relevante uitkomsten', () => {
    expect(bepaalVastgoedkansReactieVervolgadvies('niet_geinteresseerd')?.status).toBe('afgevallen');
    expect(bepaalVastgoedkansReactieVervolgadvies('verkocht_of_niet_relevant')?.status).toBe('afgevallen');
    expect(bepaalVastgoedkansReactieVervolgadvies('afgevallen')?.status).toBe('afgevallen');
    expect(bepaalVastgoedkansReactieVervolgadvies('geen_reactie')?.status).toBe('opvolgen');
  });

  it('past niets automatisch toe en muteert uitsluitend werkbak en volgende actie', () => {
    expect(kaartBron).toContain('Voorgestelde vervolgstap');
    expect(kaartBron).toContain('onClick={pasVervolgadviesToe}');
    expect(kaartBron).toContain('Dit gebeurt alleen na deze klik');
    expect(mutatieBron).toContain(".from('vastgoedkansen')");
    expect(mutatieBron).toContain('status: input.status');
    expect(mutatieBron).toContain('volgende_actie_omschrijving');
    expect(mutatieBron).toContain('volgende_actie_datum');
    expect(mutatieBron).not.toContain('reactie_status');
    expect(mutatieBron).not.toContain('eigenaar_relatie_id');
    expect(mutatieBron).not.toContain('kadaster');
  });
});
