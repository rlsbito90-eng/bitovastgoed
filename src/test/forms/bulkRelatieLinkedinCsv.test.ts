import {describe,it,expect} from 'vitest';
import {parseTekst} from '@/components/forms/BulkRelatieImportDialog';

describe('Meerdere toevoegen — LinkedIn export en gewone CSV',()=>{
 it('leest LinkedIn Connections.csv na eventuele uitlegregels',()=>{
  const csv=`Notes:
This list contains connections.
First Name,Last Name,URL,Email Address,Company,Position,Connected On
Jan,de Vries,https://www.linkedin.com/in/jan-de-vries/,jan@example.com,"Vastgoed, B.V.",Directeur,20 Nov 2025
Romy,Voorbeeld,https://linkedin.com/in/romy-voorbeeld/,,Invest BV,Acquisitie,21 Nov 2025`;
  const parsed=parseTekst(csv);
  expect(parsed.isLinkedIn).toBe(true);
  expect(parsed.ontbrekendeHeaders).toEqual([]);
  expect(parsed.rijen).toHaveLength(2);
  expect(parsed.rijen[0].data).toMatchObject({
    contactpersoon:'Jan de Vries',bedrijfsnaam:'Vastgoed, B.V.',
    email:'jan@example.com',type:'overig',leadStatus:'actief',
    linkedinUrl:'https://www.linkedin.com/in/jan-de-vries/',
  });
  expect(parsed.rijen[1].data.email).toBe('');
  expect(parsed.rijen[1].data.type).toBe('overig');
  expect(parsed.rijen[0].data.notities).toContain('Directeur');
 });
 it('leest gewone CSV met expliciete kopersclassificatie ongewijzigd',()=>{
  const parsed=parseTekst('Bedrijfsnaam,Contactpersoon,Type relatie,E-mail,Status\nBelegger BV,Jan,Koper,jan@invest.nl,Warm');
  expect(parsed.isLinkedIn).toBe(false);
  expect(parsed.rijen[0].data).toMatchObject({
    bedrijfsnaam:'Belegger BV',type:'belegger',leadStatus:'warm',
  });
 });
 it('kent aan ongetypeerde contacten nooit vanzelf koper toe',()=>{
  const parsed=parseTekst('Voornaam,Achternaam,Email\nPiet,Voorbeeld,piet@example.nl');
  expect(parsed.isLinkedIn).toBe(false);
  expect(parsed.rijen[0].data).toMatchObject({
    contactpersoon:'Piet Voorbeeld',type:'overig',leadStatus:'actief',
  });
 });
  it('behoudt gewone Excel-plaktabellen',()=>{
  const parsed=parseTekst('Bedrijf\tNaam\tEmail\nVoorbeeld BV\tJan\tjan@example.nl');
  expect(parsed.rijen[0].data).toMatchObject({
    bedrijfsnaam:'Voorbeeld BV',contactpersoon:'Jan',email:'jan@example.nl',leadStatus:'actief',
  });
 });
});
