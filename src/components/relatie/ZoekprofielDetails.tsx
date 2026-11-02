import type { ReactNode } from 'react';
import type { Zoekprofiel } from '@/data/mock-data';
import { ASSET_CLASS_LABELS, EXCLUSIVITEIT_LABELS, formatCurrency } from '@/data/mock-data';
import { isGemeenteToken, gemeenteUitToken } from '@/lib/geo/gemeenten2026';
import { usePropertyTaxonomie } from '@/hooks/usePropertyTaxonomie';

const TRANSACTIES:Record<string,string>={
  losse_aankoop:'Losse aankoop',portefeuille:'Portefeuille',
  jv:'Joint venture',asset_deal:'Asset deal',share_deal:'Share deal',
};
const VERHUUR:Record<string,string>={
  verhuurd:'Verhuurd',leeg:'Leeg',gedeeltelijk:'Gedeeltelijk verhuurd',
};
const ALS_EURO=(n?:number)=>n==null?'—':formatCurrency(n);
const TEKST=(v:unknown):string=>v==null||v===''?'—':String(v);
const LIJST=(items:readonly string[]|undefined, label:(value:string)=>string)=>items?.length
  ? items.map(label).join(', '):'—';

function Veld({titel,children}: {titel:string;children:ReactNode}){
  return <div className="min-w-0">
    <dt className="field-label">{titel}</dt>
    <dd className="mt-0.5 text-xs text-foreground break-words whitespace-pre-wrap">{children}</dd>
  </div>;
}

/** Volledige leesweergave van exact één bestaand zoekprofiel, zonder extra opslagbron. */
export default function ZoekprofielDetails({profiel}:{profiel:Zoekprofiel}){
  const tax=usePropertyTaxonomie();
  const typen=(profiel.propertyTypeIds??[]).map(id=>tax.labelType(id)||id);
  const subtypen=(profiel.propertySubtypeIds??[]).map(id=>tax.labelSubtype(id)||id);
  const dealtypen=(profiel.dealTypeIds??[]).map(id=>tax.labelDealtype(id)||id);
  const gemeenten=(profiel.steden??[]).filter(isGemeenteToken).map(gemeenteUitToken);
  const steden=(profiel.steden??[]).filter(s=>!isGemeenteToken(s));
  return <details className="group mt-3 rounded-md border border-border/70" open>
    <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-accent hover:bg-muted/30">
      Alle zoekcriteria <span className="font-normal text-muted-foreground">(klik om in/uit te klappen)</span>
    </summary>
    <dl className="grid sm:grid-cols-2 xl:grid-cols-1 gap-3 border-t border-border/70 px-3 py-3">
      <Veld titel="Status en prioriteit">{profiel.status} · prioriteit {profiel.prioriteit}</Veld>
      <Veld titel="Vastgoedtypen">{typen.length?typen.join(', '):'—'}</Veld>
      <Veld titel="Historische vastgoedklassen">{LIJST(profiel.typeVastgoed,v=>ASSET_CLASS_LABELS[v as keyof typeof ASSET_CLASS_LABELS]||v)}</Veld>
      <Veld titel="Subcategorieën">{subtypen.length?subtypen.join(', '):'—'}</Veld>
      <Veld titel="Historische subcategorieën">{LIJST(profiel.subcategorieIds,x=>x)}</Veld>
      <Veld titel="Deal- en propositietypen">{dealtypen.length?dealtypen.join(', '):'—'}</Veld>
      <Veld titel="Provincies en regio's">{LIJST(profiel.regio,x=>x)}</Veld>
      <Veld titel="Gemeenten">{gemeenten.length?gemeenten.join(', '):'—'}</Veld>
      <Veld titel="Plaatsen">{steden.length?steden.join(', '):(profiel.stad||'—')}</Veld>
      <Veld titel="Budget vanaf">{ALS_EURO(profiel.prijsMin)}</Veld>
      <Veld titel="Budget tot">{ALS_EURO(profiel.prijsMax)}</Veld>
      <Veld titel="Oppervlakte vanaf">{profiel.oppervlakteMin==null?'—':`${profiel.oppervlakteMin} m²`}</Veld>
      <Veld titel="Oppervlakte tot">{profiel.oppervlakteMax==null?'—':`${profiel.oppervlakteMax} m²`}</Veld>
      <Veld titel="Bouwjaar vanaf">{TEKST(profiel.bouwjaarMin)}</Veld>
      <Veld titel="Bouwjaar tot">{TEKST(profiel.bouwjaarMax)}</Veld>
      <Veld titel="Minimaal energielabel">{TEKST(profiel.energielabelMin)}</Veld>
      <Veld titel="Verhuurstatus">{profiel.verhuurStatus?VERHUUR[profiel.verhuurStatus]??profiel.verhuurStatus:'—'}</Veld>
      <Veld titel="Rendementseis">{profiel.rendementseis==null?'—':`${profiel.rendementseis}%`}</Veld>
      <Veld titel="WALT vanaf">{profiel.waltMin==null?'—':`${profiel.waltMin} jaar`}</Veld>
      <Veld titel="Maximale leegstand">{profiel.leegstandMaxPct==null?'—':`${profiel.leegstandMaxPct}%`}</Veld>
      <Veld titel="Ontwikkelpotentie">{profiel.ontwikkelPotentie?'Gewenst':'Niet opgegeven'}</Veld>
      <Veld titel="Transformatiepotentie">{profiel.transformatiePotentie?'Gewenst':'Niet opgegeven'}</Veld>
      <Veld titel="Transactievoorkeuren">{LIJST(profiel.transactietypeVoorkeur,x=>TRANSACTIES[x]||x)}</Veld>
      <Veld titel="Off-market voorkeur">{profiel.exclusiviteitVoorkeur
        ? EXCLUSIVITEIT_LABELS[profiel.exclusiviteitVoorkeur]:'—'}</Veld>
      <Veld titel="Aanvullende criteria">{TEKST(profiel.aanvullendeCriteria)}</Veld>
      <Veld titel="Laatst bijgewerkt">{profiel.updatedAt?new Date(profiel.updatedAt).toLocaleDateString('nl-NL'):'—'}</Veld>
    </dl>
  </details>;
}
