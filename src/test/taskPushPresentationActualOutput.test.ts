import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import * as ts from 'typescript';
import { describe, expect, it } from 'vitest';

// Voer precies de pure presentatiecode uit de Supabase-functie uit, zonder
// netwerk, Deno-runtime, service-role, pushabonnementen of echte push.
const source = readFileSync(resolve(process.cwd(), 'supabase/functions/notification-push-send/index.ts'), 'utf8');
const begin = source.indexOf('function schoon(');
const end = source.indexOf('Deno.serve(', begin);
if (begin < 0 || end < 0) throw new Error('Pushpresentatiecode niet gevonden');
const pureSource = source.slice(begin, end) + '\nexports.present = taakPushPresentatie;';
const executable = ts.transpileModule(pureSource, {
  compilerOptions: { target: ts.ScriptTarget.ES2020 },
}).outputText;
const out: { present?: (event: any, task: any, context: any, zone: string) => {title:string,body:string} } = {};
runInNewContext(executable, { exports: out }, { timeout: 3000 });
if (!out.present) throw new Error('Taakpushpresentatie ontbreekt');
const present = out.present;
const zone = 'Europe/Amsterdam';
const today = new Intl.DateTimeFormat('en-CA', {
  timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit',
}).format(new Date());
const [year,month,day] = today.split('-').map(Number);
const tomorrow = new Date(Date.UTC(year,month-1,day+1)).toISOString().slice(0,10);

describe('Echte opmaak van CRM-pushberichten', () => {
  const task = {
    titel: 'Robin bellen over Hilversum',
    type_taak: 'Bellen',
    deadline: null,
    deadline_tijd: null,
  };
  const context = {
    relatie: { bedrijfsnaam: 'Triple S Vastgoed' },
    object: { titel: 'Geuzenweg 22A & 22B' },
  };

  it('toont concrete taak, object én relatie bij een herinnering voor vandaag', () => {
    const result = present({event_type:'task_plan_reminder',metadata:{plan_datum:today}},task,context,zone);
    expect(result).toEqual({
      title: 'Bellen · Vandaag gepland',
      body: 'Robin bellen over Hilversum\nGeuzenweg 22A & 22B · Triple S Vastgoed',
    });
  });

  it('gebruikt de plandatum en niet een losstaande verstreken deadline', () => {
    const result = present(
      {event_type:'task_plan_reminder',metadata:{plan_datum:tomorrow}},
      {...task,deadline:'2020-01-01'},
      context,zone,
    );
    expect(result.title).toBe('Bellen · Morgen gepland');
    expect(result.body).not.toContain('2020');
    expect(result.body.split('\n')).toHaveLength(2);
  });

  it('maakt van een echte deadlineherinnering een duidelijk andere kop', () => {
    const result = present(
      {event_type:'task_reminder',metadata:{deadline:today}},
      {titel:'Verkoper Westervoort opvolgen',type_taak:'Opvolging',deadline:today},
      {relatie:null,object:null},zone,
    );
    expect(result.title).toBe('Opvolging · Deadline vandaag');
    expect(result.body).toBe('Verkoper Westervoort opvolgen');
  });

  it('gebruikt de primaire contactpersoon wanneer het relatiehoofdrecord geen naam bevat', () => {
    const result = present(
      {event_type:'task_plan_reminder',metadata:{plan_datum:today}},
      {titel:'Test taak',type_taak:'Algemeen'},
      {relatie:{bedrijfsnaam:'',contactpersoon:null},primaireContactNaam:'Kwok'},
      zone,
    );
    expect(result).toEqual({
      title:'Taak · Vandaag gepland',
      body:'Test taak\nKwok',
    });
  });

  it('gebruikt de bedrijfsnaam als die bestaat, en voorkomt dubbele contactnamen', () => {
    const result = present(
      {event_type:'task_plan_reminder',metadata:{plan_datum:today}},
      {titel:'Koper bellen',type_taak:'Bellen'},
      {relatie:{bedrijfsnaam:'Triple S Vastgoed'},primaireContactNaam:'Robin'},
      zone,
    );
    expect(result.body).toBe('Koper bellen\nTriple S Vastgoed');
  });


  it('toont het echte CRM-object bij een taak zonder adres (Veendam)', () => {
    const result = present(
      {event_type:'task_plan_reminder',metadata:{plan_datum:today}},
      {titel:'Test taak',type_taak:'Algemeen'},
      {
        object: {objectnaam:'Bedrijfspand Veendam',adres:null,publieke_naam:null},
        relatie: {bedrijfsnaam:'Investeerder'},
      },zone,
    );
    expect(result.body).toBe('Test taak\nBedrijfspand Veendam · Investeerder');
  });

  it('kiest de expliciet gekoppelde CRM-objectnaam vóór een aanvullend Radar-signaal', () => {
    const result = present(
      {event_type:'task_plan_reminder',metadata:{plan_datum:today}},
      {titel:'Bezichtiging voorbereiden',type_taak:'Algemeen'},
      {
        object: {objectnaam:'1e Sweelinckstraat 26, Den Haag',adres:'1e Sweelinckstraat 26'},
        signaal: {adres:'Ander signaal 1',plaats:'Amsterdam'},
      },zone,
    );
    expect(result.body).toBe('Bezichtiging voorbereiden\n1e Sweelinckstraat 26, Den Haag');
  });

  it('toont alleen relatie, indien geen object is gekoppeld', () => {
    const result = present({event_type:'high_priority_task'},{
      titel:'Documenten opvragen',type_taak:'Algemeen',
    },{relatie:{voornaam:'Robin',achternaam:'Schoenmakers'},object:null},zone);
    expect(result).toEqual({
      title:'Taak',
      body:'Documenten opvragen\nRobin Schoenmakers',
    });
  });

  it('neemt briefopvolging volledig mee, zonder dubbele contextregel', () => {
    const result = present({event_type:'task_overdue'},{
      titel:'Brief 2 opvolgen — Walvast O.G.',type_taak:'Opvolging',deadline:'2020-01-01',
    },{signaal:{adres:'Spoorlaan 1',plaats:'Tilburg'},relatie:{bedrijfsnaam:'Walvast O.G.'}},zone);
    expect(result.title).toBe('Brief opvolgen · Deadline verstreken');
    expect(result.body).toBe('Brief 2 opvolgen — Walvast O.G.\nSpoorlaan 1 · Tilburg · Walvast O.G.');
  });

  it('hanteert een limiet voor lange taak- en contextregels', () => {
    const result = present({event_type:'task_plan_reminder',metadata:{plan_datum:today}},
      {titel:'Onderzoek '.repeat(25),type_taak:'Algemeen'},
      {object:{titel:'Pand '.repeat(30)},relatie:{bedrijfsnaam:'Relatie '.repeat(20)}},zone);
    expect(result.body.split('\n')).toHaveLength(2);
    for (const line of result.body.split('\n')) expect(line.length).toBeLessThanOrEqual(96);
  });
});
