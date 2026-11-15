import { Link } from 'react-router-dom';
import { ArrowRight, Building2, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { useSandboxStore } from './sandboxStore';
import { beoordeelSandboxBelegger, controleerDemoBron } from './sandboxAssessment';
import {
  GEBRUIKSFUNCTIES, SCENARIOS, VOORBEELDEN,
  type GebruiksfunctieCode, type VoorbeeldScenario,
} from './sandboxModel';
import type { Meetbasis } from '@/lib/matching/samenstellingscriterium';

export default function SandboxObjectPartsPage(){
  const {staat,kiesObject,wijzigOnderdeel,voegOnderdeelToe,verwijderOnderdeel,herstelObject}
    =useSandboxStore();
  const onderdelen=staat.onderdelen[staat.scenario];
  const bron=VOORBEELDEN[staat.scenario];
  const controle=controleerDemoBron(staat.scenario,onderdelen);
  return <div className="space-y-5">
    <div className="space-y-2">
      <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-accent">
        <Building2 className="h-4 w-4"/> Fictief object · één keer invoeren
      </p>
      <h1 className="text-2xl font-semibold">Objectonderdelen</h1>
      <p className="text-sm text-muted-foreground max-w-3xl">
        Pas hier de functie, oppervlakte of meetbasis aan. Dezelfde gegevens worden direct
        gebruikt voor alle fictieve investeringsprofielen bij Relaties & Matching.
        Je hoeft ze daar niet opnieuw in te voeren.
      </p>
    </div>
    <section className="section-card p-4 sm:p-5 space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <label className="block text-sm space-y-1 flex-1 min-w-[210px]">
          <span className="font-medium">Voorbeeldobject</span>
          <select aria-label="Voorbeeldobject" value={staat.scenario}
            onChange={e=>kiesObject(e.target.value as VoorbeeldScenario)}
            className="block w-full h-10 rounded-md border border-input bg-background px-3 text-sm">
            {SCENARIOS.map(s=><option value={s} key={s}>{VOORBEELDEN[s].naam}</option>)}
          </select>
        </label>
        <button type="button" onClick={herstelObject} className="h-10 px-3 rounded-md border border-border inline-flex gap-2 items-center text-sm">
          <RotateCcw className="h-4 w-4"/> Herstel dit object
        </button>
      </div>
      <div className="rounded-md bg-muted/30 px-3 py-3 space-y-1">
        <p className="font-medium text-xs">Fictieve objectbron</p>
        <p className="text-xs text-muted-foreground">{bron.toelichting}</p>
        <p className="text-xs text-muted-foreground">
          Bron-totaal: {bron.totaalM2===null?'onbekend':bron.totaalM2.toLocaleString('nl-NL')+' m² '+bron.meetbasis.toUpperCase()}
          {' · '}Onderdeelsom: {controle.somM2===null?'onvolledig':controle.somM2.toLocaleString('nl-NL')+' m²'}
        </p>
      </div>
      <h2 className="text-sm font-semibold">Onderdelen van dit object</h2>
      {onderdelen.map((part,i)=><div key={part.id} className="rounded-lg border border-border/70 p-3 space-y-3">
        <div className="flex justify-between items-center gap-2">
          <p className="font-medium text-sm">Onderdeel {i+1}{part.adres?' · '+part.adres:''}</p>
          <button type="button" aria-label={'Verwijder onderdeel '+(i+1)}
            onClick={()=>verwijderOnderdeel(part.id)}
            className="rounded-md p-2 hover:bg-muted text-muted-foreground">
            <Trash2 className="h-4 w-4"/>
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <label className="space-y-1 text-xs block">Omschrijving
            <input aria-label={'Onderdeel '+(i+1)+' omschrijving'}
              className="mt-1 w-full rounded-md border border-input bg-background h-10 px-3 text-sm"
              value={part.naam} onChange={e=>wijzigOnderdeel(part.id,'naam',e.target.value)}/>
          </label>
          <label className="space-y-1 text-xs block">Gebruiksfunctie
            <select aria-label={'Onderdeel '+(i+1)+' gebruiksfunctie'}
              className="mt-1 w-full rounded-md border border-input bg-background h-10 px-3 text-sm"
              value={part.gebruiksfunctieCode}
              onChange={e=>wijzigOnderdeel(part.id,'gebruiksfunctieCode',e.target.value as GebruiksfunctieCode)}>
              {GEBRUIKSFUNCTIES.map(f=><option value={f.value} key={f.value}>{f.label}</option>)}
            </select>
          </label>
          <label className="space-y-1 text-xs block">Oppervlakte (m²)
            <input aria-label={'Onderdeel '+(i+1)+' oppervlakte'} inputMode="decimal"
              className="mt-1 w-full rounded-md border border-input bg-background h-10 px-3 text-sm"
              value={part.oppervlakte}
              onChange={e=>wijzigOnderdeel(part.id,'oppervlakte',e.target.value)}/>
          </label>
          <label className="space-y-1 text-xs block">Meetbasis
            <select aria-label={'Onderdeel '+(i+1)+' meetbasis'}
              className="mt-1 w-full rounded-md border border-input bg-background h-10 px-3 text-sm"
              value={part.meetbasis}
              onChange={e=>wijzigOnderdeel(part.id,'meetbasis',e.target.value as Meetbasis)}>
              <option value="vvo">VVO</option><option value="gbo">GBO</option><option value="bvo">BVO</option>
            </select>
          </label>
        </div>
      </div>)}
      <button type="button" onClick={voegOnderdeelToe}
        className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-border text-sm">
        <Plus className="h-4 w-4"/> Onderdeel toevoegen
      </button>
    </section>
    <section className="section-card p-4 sm:p-5 space-y-4">
      <h2 className="font-semibold text-sm">Automatische broncontrole</h2>
      <p role="status" className="text-sm font-medium">
        {controle.status==='bruikbaar'?'Gegevens volgens de fictieve bron vergelijkbaar':'Controle nodig'}
      </p>
      <p className="text-xs text-muted-foreground">{controle.toelichting}</p>
      <p className="text-xs text-muted-foreground">
        Geen handmatige volledigheidsvinkjes. Een rekenkundig sluitend totaal bewijst
        bij echte panden niet dat metingen of afbakeningen correct zijn.
      </p>
    </section>
    <section className="section-card p-4 sm:p-5 space-y-3">
      <div className="flex flex-wrap gap-3 justify-between items-center">
        <h2 className="font-semibold">Effect op bestaande fictieve kopersprofielen</h2>
        <Link to="/relaties" className="text-sm font-medium text-accent inline-flex gap-1.5 items-center">
          Bekijk Matching <ArrowRight className="h-4 w-4"/>
        </Link>
      </div>
      <div className="grid sm:grid-cols-2 gap-2">
        {staat.beleggers.map(b=>{
          const r=beoordeelSandboxBelegger(staat,b);
          return <div key={b.id} className="rounded-md border border-border/70 p-3 space-y-1">
            <p className="font-medium text-sm">{b.naam}</p>
            <p className="text-xs font-medium">{r.statusLabel}</p>
            <p className="text-xs text-muted-foreground">
              Minimaal {b.percentage||'–'}% {GEBRUIKSFUNCTIES.find(f=>f.value===b.gebruiksfunctieCode)?.label.toLowerCase()}
              {' · '}{b.meetbasis.toUpperCase()} · {b.sterkte==='hard'?'harde eis':'voorkeur'}
            </p>
          </div>;
        })}
      </div>
      <p className="text-xs text-muted-foreground">
        Bij iedere aanpassing wordt dezelfde objectindeling opnieuw beoordeeld, zonder dubbele invoer
        of wijziging van je echte kandidaten, matches of database.
      </p>
    </section>
  </div>;
}
