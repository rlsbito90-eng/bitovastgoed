import {describe,it,expect} from 'vitest';
import { vindMogelijkeRelaties, linkedinSleutel, isGeldigeLinkedinProfielUrl, zijnDezelfdeInvoer } from './relatieInvoerDubbelen';
import type {Relatie,RelatieContactpersoon} from '@/data/mock-data';
const bestaande=[
  {id:'r1',bedrijfsnaam:'ABC',contactpersoon:'Romy',email:'romy@example.nl',telefoon:'06 12345678',linkedinUrl:'https://www.linkedin.com/in/romy-test/',softDeletedAt:undefined},
  {id:'r2',bedrijfsnaam:'Andere BV',contactpersoon:'Joost',email:'',telefoon:''},
] as Relatie[];
const contacten=[{relatieId:'r2',naam:'Jan',email:'jan@example.nl',telefoon:'06-1122 3344',isPrimair:true}] as RelatieContactpersoon[];
describe('Relaties — contactdeduplicatie',()=>{
 it('herkent LinkedIn URLs onafhankelijk van tracking query en subdomein',()=>{
  expect(linkedinSleutel('https://nl.linkedin.com/in/Romy-test/?trk=network')).toBe('/in/romy-test');
  expect(linkedinSleutel('linkedin.com/in/romy-test/')).toBe('/in/romy-test');
  expect(isGeldigeLinkedinProfielUrl('https://fake-linkedin.com/in/x')).toBe(false);
 });
 it('controleert tegen bestaande relaties én contactpersonen',()=>{
  expect(vindMogelijkeRelaties({email:'ROMY@EXAMPLE.NL'},bestaande,contacten)[0].redenen).toContain('e-mail');
  expect(vindMogelijkeRelaties({email:'JAN@EXAMPLE.NL'},bestaande,contacten)[0].relatie.id).toBe('r2');
  expect(vindMogelijkeRelaties({telefoon:'+31 6 12345678'},bestaande,contacten)[0].redenen).toContain('telefoon');
  expect(vindMogelijkeRelaties({linkedinUrl:'https://linkedin.com/in/romy-test/'},bestaande,contacten)[0].redenen).toContain('LinkedIn-profiel');
 });
 it('markeert gelijke naam en onderneming, niet alleen gelijke voornaam',()=>{
  expect(vindMogelijkeRelaties({contactpersoon:'Romy',bedrijfsnaam:'ABC'},bestaande,contacten).length).toBe(1);
  expect(vindMogelijkeRelaties({contactpersoon:'Romy'},bestaande,contacten).length).toBe(0);
 });
 it('signaleert een identiek contact tweemaal in dezelfde import',()=>{
  expect(zijnDezelfdeInvoer({email:'A@B.nl'},{email:'a@b.nl'})).toBe(true);
  expect(zijnDezelfdeInvoer({linkedinUrl:'https://linkedin.com/in/hello/?trk=x'},
    {linkedinUrl:'https://www.linkedin.com/in/hello/'})).toBe(true);
  expect(zijnDezelfdeInvoer({contactpersoon:'Jan',bedrijfsnaam:'ABC'},
    {contactpersoon:'Jan',bedrijfsnaam:'XYZ'})).toBe(false);
 });
});
