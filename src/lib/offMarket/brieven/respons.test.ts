import { describe, expect, it } from 'vitest';
import {
  procesPatchVoorRespons,
  responsAdviseertVervolgtaak,
} from './respons';

describe('respons proceslogica', () => {
  it('houdt later opnieuw benaderen als benaderd en normaliseert eigenaar naar gevonden', () => {
    expect(procesPatchVoorRespons('later_opnieuw_benaderen', 'benaderd', 'benaderd')).toEqual({
      eigenaarstatus: 'gevonden',
    });
  });

  it('zet positieve reactie door naar in gesprek zonder een verder dossier terug te zetten', () => {
    expect(procesPatchVoorRespons('interesse', 'benaderd', 'gevonden')).toEqual({
      status: 'in_gesprek',
      eigenaarstatus: 'gevonden',
    });
    expect(procesPatchVoorRespons('interesse', 'dealtraject', 'gevonden')).toEqual({
      eigenaarstatus: 'gevonden',
    });
  });

  it('stuurt verkeerd adres terug naar eigenaaronderzoek', () => {
    expect(procesPatchVoorRespons('verkeerd_adres', 'benaderd', 'gevonden')).toEqual({
      status: 'eigenaar_achterhalen',
      eigenaarstatus: 'te_onderzoeken',
    });
  });

  it('sluit expliciet negatieve dossiers af', () => {
    expect(procesPatchVoorRespons('niet_geinteresseerd', 'benaderd', 'gevonden')).toEqual({
      status: 'afgevallen',
      eigenaarstatus: 'gevonden',
    });
  });

  it('adviseert alleen bij echte vervolguitkomsten automatisch een vervolgtaak', () => {
    expect(responsAdviseertVervolgtaak('later_opnieuw_benaderen')).toBe(true);
    expect(responsAdviseertVervolgtaak('wil_meer_informatie')).toBe(true);
    expect(responsAdviseertVervolgtaak('gesprek_gepland')).toBe(true);
    expect(responsAdviseertVervolgtaak('reactie_ontvangen')).toBe(false);
  });
});
