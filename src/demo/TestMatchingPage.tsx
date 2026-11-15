import { Link } from 'react-router-dom';
import { ArrowRight, RotateCcw, ShieldAlert, Users } from 'lucide-react';
import { useSandboxStore } from './sandboxStore';
import { beoordeelSandboxBelegger } from './sandboxAssessment';
import {
  GEBRUIKSFUNCTIES, SCENARIOS, VOORBEELDEN,
  type DemoBelegger, type GebruiksfunctieCode, type VoorbeeldScenario,
} from './sandboxModel';
import type { CriteriumSterkte, Meetbasis } from '@/lib/matching/samenstellingscriterium';

export default function TestMatchingPage(){
  const {staat,kiesObject,kiesBelegger,wijzigBelegger,herstelAlles}=useSandboxStore();
  const belegger=staat.beleggers.find(b=>b.id===staat.geselecteerdeBeleggerId)??staat.beleggers[0];
  const result=beoordeelSandboxBelegger(staat,belegger);
  const parts=staat.onderdelen[staat.scenario];
  const bron=VOORBEELDEN[staat.scenario];

  return <div className="space-y-5">
    <div className="space-y-2">
      <p className="inline-flex items-center gap-2 text-xs uppercase tracking-wider text-accent font-semibold">
        <Users className="h-4 w-4"/> Fictieve relaties · Matching
      </p>
      <h1 className="text-2xl font-semibold">Koperscriteria beoordelen</h1>
      <p className="max-w-3xl text-sm text-muted-foreground">
        Eén objectregistratie wordt automatisch voor verschillende beleggers beoordeeld.
        Pas de fictieve belegger of de onderliggende objectgegevens aan en zie direct wat
        de harde eisen en voorkeuren doen. Zonder dubbele invoer of controlevinkjes.
      </p>
    </div>
    <div className="grid lg:grid-cols-2 gap-4">
      <section className="section-card p-4 sm:p-5 space-y-4">
        <div className="flex gap-2 justify-between items-center">
          <h2 className="font-semibold">Fictieve belegger</h2>
          <button type="button" onClick={herstelAlles}
            className="rounded-lg border px-3 py-2 inline-flex gap-1.5 items-center text-xs">
            <RotateCcw className="h-4 w-4"/> Alles herstellen
          </button>
        </div>
        <label className="text-xs space-y-1 block">Investeringsprofiel
          <select aria-label="Fictieve belegger"
            className="mt-1 w-full rounded-md border border-input bg-background h-10 px-3 text-sm"
            value={belegger.id}
            onChange={e=>kiesBelegger(e.target.value as DemoBelegger['id'])}>
            {staat.beleggers.map(b=><option key={b.id} value={b.id}>{b.naam}</option>)}
          </select>
        </label>
        <div className="grid sm:grid-cols-2 gap-3">
          <label className="text-xs space-y-1 block">Gebruiksfunctie
            <select aria-label="Gebruiksfunctie van de belegger"
              className="mt-1 w-full rounded-md border border-input bg-background h-10 px-3 text-sm"
              value={belegger.gebruiksfunctieCode}
              onChange={e=>wijzigBelegger(belegger.id,'gebruiksfunctieCode',e.target.value as GebruiksfunctieCode)}>
              {GEBRUIKSFUNCTIES.map(f=><option value={f.value} key={f.value}>{f.label}</option>)}
            </select>
          </label>
          <label className="text-xs space-y-1 block">Minimaal aandeel (%)
            <input aria-label="Minimaal aandeel gebruiksfunctie" inputMode="decimal"
              className="mt-1 w-full rounded-md border border-input bg-background h-10 px-3 text-sm"
              value={belegger.percentage}
              onChange={e=>wijzigBelegger(belegger.id,'percentage',e.target.value)}/>
          </label>
          <label className="text-xs space-y-1 block">Sterkte
            <select aria-label="Sterkte"
              className="mt-1 w-full rounded-md border border-input bg-background h-10 px-3 text-sm"
              value={belegger.sterkte}
              onChange={e=>wijzigBelegger(belegger.id,'sterkte',e.target.value as CriteriumSterkte)}>
              <option value="hard">Harde eis</option><option value="voorkeur">Voorkeur</option>
            </select>
          </label>
          <label className="text-xs space-y-1 block">Meetbasis van de eis
            <select aria-label="Meetbasis van de eis"
              className="mt-1 w-full rounded-md border border-input bg-background h-10 px-3 text-sm"
              value={belegger.meetbasis}
              onChange={e=>wijzigBelegger(belegger.id,'meetbasis',e.target.value as Meetbasis)}>
              <option value="vvo">VVO</option><option value="gbo">GBO</option><option value="bvo">BVO</option>
            </select>
          </label>
        </div>
      </section>
      <section className="section-card p-4 sm:p-5 space-y-4">
        <div className="flex gap-2 items-center justify-between">
          <h2 className="font-semibold">Gekoppeld fictief object</h2>
          <Link to="/objecten/samenstellingproef"
            className="text-xs font-medium text-accent inline-flex gap-1.5 items-center">
            Wijzig objectonderdelen <ArrowRight className="h-4 w-4"/>
          </Link>
        </div>
        <label className="text-xs space-y-1 block">Voorbeeldobject
          <select aria-label="Voorbeeldobject"
            className="mt-1 w-full rounded-md border border-input bg-background h-10 px-3 text-sm"
            value={staat.scenario}
            onChange={e=>kiesObject(e.target.value as VoorbeeldScenario)}>
            {SCENARIOS.map(s=><option value={s} key={s}>{VOORBEELDEN[s].naam}</option>)}
          </select>
        </label>
        <div className="space-y-1">
          {parts.length===0?<p className="text-xs text-muted-foreground">Nog geen onderdelen.</p>:
            parts.map(part=><p key={part.id} className="text-xs text-muted-foreground">
              {part.naam}: {part.oppervlakte||'onbekend'} m² {part.meetbasis.toUpperCase()}
              {' · '}{GEBRUIKSFUNCTIES.find(f=>f.value===part.gebruiksfunctieCode)?.label}
            </p>)}
        </div>
        <p className="text-xs text-muted-foreground">
          Fictieve bron: {bron.totaalM2===null?'onbekend totaal':
            bron.totaalM2.toLocaleString('nl-NL')+' m² '+bron.meetbasis.toUpperCase()}.
          Oppervlaktes bewerk je uitsluitend bij het object.
        </p>
      </section>
    </div>
    <section className="section-card p-4 sm:p-5 space-y-3" aria-label="Matchresultaat">
      <div className="flex flex-wrap justify-between gap-2 items-center">
        <h2 className="font-semibold">Beoordeling van {belegger.naam}</h2>
        <span role="status" className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold">
          {result.statusLabel}
        </span>
      </div>
      <p className="text-sm">
        {result.beoordeling.status==='controle_nodig'&&result.bron.status==='controle_nodig'
          ?result.bron.toelichting : result.beoordeling.beoordelingen[0]?.toelichting}
      </p>
      {result.aandeel!==null&&result.beoordeling.status!=='controle_nodig'&&
        <p className="text-xs text-muted-foreground">
          Gemeten aandeel volgens de fictieve indeling: {result.aandeel.toLocaleString('nl-NL',{maximumFractionDigits:2})}%.
        </p>}
      <div className="flex items-start gap-2">
        <ShieldAlert className="h-4 w-4 shrink-0 text-muted-foreground"/>
        <p className="text-xs text-muted-foreground">
          Een harde uitsluiting is niet te compenseren met andere goede criteria.
          Ontbrekende broninformatie betekent ‘Controle nodig’, niet automatisch afvallen.
          Dit is een fictieve proef, geen verificatie van echte vastgoedobjecten.
        </p>
      </div>
    </section>
    <section className="section-card p-4 sm:p-5 space-y-3">
      <h2 className="font-semibold">Dezelfde objectgegevens, verschillende beleggers</h2>
      <div className="grid sm:grid-cols-2 gap-2">
        {staat.beleggers.map(b=>{
          const x=beoordeelSandboxBelegger(staat,b);
          return <button type="button" key={b.id} onClick={()=>kiesBelegger(b.id)}
            className={'text-left rounded-lg border p-3 space-y-1 '+
              (b.id===belegger.id?'border-accent bg-accent/5':'border-border/70 hover:bg-muted/30')}>
            <p className="font-semibold text-sm">{b.naam}</p>
            <p className="text-xs">{x.statusLabel}</p>
            <p className="text-xs text-muted-foreground">
              Min. {b.percentage||'–'}% {GEBRUIKSFUNCTIES.find(f=>f.value===b.gebruiksfunctieCode)?.label.toLowerCase()}
              {' · '}{b.sterkte==='hard'?'harde eis':'voorkeur'} · {b.meetbasis.toUpperCase()}
            </p>
          </button>;
        })}
      </div>
      <p className="text-xs text-muted-foreground">
        Aanpassingen worden alleen voor deze fictieve profielen in de browser bewaard.
        ‘Alles herstellen’ zet de volledige proef terug.
      </p>
    </section>
  </div>;
}
