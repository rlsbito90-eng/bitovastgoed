/**
 * A13 browseracceptatie met de ECHTE PartijprofielVelden-component.
 * Alleen synthetische data; geen Supabase-client, auth of opslag.
 * Wordt niet gebundeld via de gewone productiebouw.
 */
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import '../src/index.css';
import PartijprofielVelden from '../src/components/forms/PartijprofielVelden';
import type { Partijprofiel, VastgoedStrategie } from '../src/data/mock-data';

function App(){
 const [partijprofiel,setPartijprofiel]=useState<Partijprofiel|null>(null);
 const [vastgoedStrategieen,setVastgoedStrategieen]=useState<VastgoedStrategie[]|null>(null);
 const laadVoorbeeld=()=>{
  setPartijprofiel('ontwikkelende_belegger');
  setVastgoedStrategieen(['value_add','transformatie']);
 };
 return <main className="min-h-screen bg-background p-4">
  <section aria-label="A13 partijprofiel browseracceptatie"
   className="mx-auto w-full max-w-xl space-y-4 rounded-lg border border-border bg-card p-4">
   <h1 className="text-xl font-semibold">Partijprofiel A13 — acceptatietest</h1>
   <p className="text-sm">Synthetisch testcontact, zonder databaseverbinding of persistente opslag.</p>
   <p data-testid="legacy-velden">Hoofdtype: makelaar · Commerciële rollen: bemiddelaar · Zoekprofielen: 2</p>
   <PartijprofielVelden partijprofiel={partijprofiel}
     vastgoedStrategieen={vastgoedStrategieen}
     onProfielChange={setPartijprofiel}
     onStrategieenChange={setVastgoedStrategieen}/>
   <output aria-label="A13 formulierwaarde" className="block text-sm">
    Profiel: {partijprofiel??'onbekend'} · Strategieën: {(vastgoedStrategieen??[]).join(', ')||'onbekend'}
   </output>
   <button type="button" onClick={laadVoorbeeld}
     className="rounded-md border border-input px-3 py-2 text-sm">
    Laad bestaand voorbeeld
   </button>
  </section>
 </main>;
}
createRoot(document.getElementById('root')!).render(<App/>);
