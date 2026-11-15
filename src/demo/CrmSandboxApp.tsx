import { BrowserRouter, Link, Navigate, NavLink, Route, Routes } from 'react-router-dom';
import { Building2, ClipboardCheck, MapPinned, ShieldCheck, Users } from 'lucide-react';
import AdresModelProefPage from '@/pages/AdresModelProefPage';
import SandboxObjectPartsPage from './SandboxObjectPartsPage';
import { SandboxStoreProvider, useSandboxStore } from './sandboxStore';
import { VOORBEELDEN } from './sandboxModel';
import { beoordeelSandboxBelegger } from './sandboxAssessment';
import TestMatchingPage from './TestMatchingPage';

/**
 * Dit is bewust NIET de productie-CRM: geen App, AuthProvider,
 * DataStoreProvider, Supabase-client, serverfuncties of live objecten.
 * Alleen fictieve voorbeelden en lokale browsergegevens.
 */
function ProefObjecten() {
  const {staat}=useSandboxStore();
  const actieve=staat.beleggers.find(x=>x.id===staat.geselecteerdeBeleggerId)??staat.beleggers[0];
  const resultaat=beoordeelSandboxBelegger(staat,actieve);
  return <div className="space-y-5">
    <div>
      <h1 className="text-2xl font-semibold">Objecten in de proefomgeving</h1>
      <p className="mt-2 text-sm text-muted-foreground">Alle objecten hieronder zijn fictief. Je kunt de
        adresinvoer en de samenstellingscontrole testen zonder echte CRM-gegevens.</p>
    </div>
    <div className="rounded-lg bg-muted/30 p-4 space-y-1">
      <p className="font-semibold text-sm">{VOORBEELDEN[staat.scenario].naam}</p>
      <p className="text-xs text-muted-foreground">
        {staat.onderdelen[staat.scenario].length} onderdelen · {actieve.naam}: {resultaat.statusLabel}
      </p>
      <p className="text-xs text-muted-foreground">Eén set objectgegevens voor alle investeringsprofielen.</p>
    </div>
    <div className="grid gap-3 sm:grid-cols-2">
      <Link to="/objecten/adresproef" className="section-card p-5 space-y-2 hover:border-accent block">
        <MapPinned className="h-5 w-5 text-accent" />
        <h2 className="font-semibold">Meerdere adressen</h2>
        <p className="text-sm text-muted-foreground">Eén dossier met twee adressen, of een portefeuille
          met drie voorbeeldadressen. Toevoegen, wijzigen en hoofdadres kiezen.</p>
        <p className="text-xs font-medium text-accent">Open adresproef</p>
      </Link>
      <Link to="/objecten/samenstellingproef" className="section-card p-5 space-y-2 hover:border-accent block">
        <Building2 className="h-5 w-5 text-accent" />
        <h2 className="font-semibold">Objectonderdelen</h2>
        <p className="text-sm text-muted-foreground">Bedrijfshal, kantoor en wonen: voer fictieve m²
          in en laat de CRM automatisch controleren wat vergelijkbaar is.</p>
        <p className="text-xs font-medium text-accent">Open samenstellingsproef</p>
      </Link>
    </div>
  </div>;
}

function Shell() {
  const navigation=[
    { to:'/relaties', label:'Relaties & Matching', icon:Users },
    { to:'/objecten', label:'Objecten', icon:Building2 },
    { to:'/objecten/adresproef', label:'Adressen', icon:MapPinned },
    { to:'/objecten/samenstellingproef', label:'Ruimteverdeling', icon:ClipboardCheck },
  ];
  return <div className="min-h-screen">
    <header className="border-b border-border/70 bg-card/95">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 py-4 flex flex-wrap gap-3 justify-between items-center">
        <div className="min-w-0">
          <p className="font-semibold text-base">Bito Vastgoed <span className="text-accent">CRM</span></p>
          <p className="text-xs text-muted-foreground">Afzonderlijke proefomgeving · geen echte dossiers</p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-lg bg-muted px-3 py-2 text-xs font-medium">
          <ShieldCheck className="h-4 w-4 text-success" /> Zonder productiedatabase
        </span>
      </div>
    </header>
    <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 py-5 space-y-5">
      <nav aria-label="Proefomgeving" className="flex flex-wrap gap-2">
        {navigation.map(({to,label,icon:Icon})=>
          <NavLink key={to} to={to} className={({isActive})=>
            'rounded-lg px-3 py-2 text-xs sm:text-sm border inline-flex gap-1.5 items-center '
            +(isActive?'bg-primary text-primary-foreground border-primary':'bg-card/80 border-border hover:bg-muted')}>
            <Icon className="h-4 w-4" />{label}
          </NavLink>)}
      </nav>
      <main className="space-y-5">
        <Routes>
          <Route path="/relaties" element={<TestMatchingPage />} />
          <Route path="/objecten" element={<ProefObjecten />} />
          <Route path="/objecten/adresproef" element={<AdresModelProefPage />} />
          <Route path="/objecten/samenstellingproef" element={<SandboxObjectPartsPage />} />
          <Route path="*" element={<Navigate replace to="/relaties" />} />
        </Routes>
      </main>
      <p className="pb-8 text-center text-xs text-muted-foreground">
        Testomgeving met uitsluitend fictieve voorbeelden. Wijzigingen hier raken de
        productiedatabase, echte relaties en de bestaande matchhistorie niet.
      </p>
    </div>
  </div>;
}

export default function CrmSandboxApp(){
  return <SandboxStoreProvider><BrowserRouter><Shell /></BrowserRouter></SandboxStoreProvider>;
}
