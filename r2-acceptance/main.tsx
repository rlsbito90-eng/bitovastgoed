/**
 * Alleen voor featurebranch-browseracceptatie.
 * Gebruikt verzonnen records; geen Auth, Supabase-client of persistente opslag.
 * Niet opgenomen in de Vite-productiebuild.
 */
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import '../src/index.css';
import { KandidaatVoorstellenR2 } from '../src/components/pipeline/KandidaatVoorstellenR2';
import GemeentePicker from '../src/components/forms/GemeentePicker';
import CommercieleRollenPicker from '../src/components/forms/CommercieleRollenPicker';
import type { CommercieleRol } from '../src/data/mock-data';
import type { CrmMandaatInput, CrmObjectInput, CrmRelatieInput } from '../src/lib/matching/rolMandaatAdapter';

const object: CrmObjectInput = {
  id:'test-object-001', status:'beschikbaar', type:'wonen',
  propertyTypeId:'type-wonen', vraagprijs:450000, plaats:'Breda', provincie:'Noord-Brabant'
};
const relaties: CrmRelatieInput[] = [
  {id:'broker',type:'makelaar',commercialRoles:['bemiddelaar'],propertyTypeIds:['type-wonen'],budgetMax:850000},
  {id:'investor',type:'belegger',commercialRoles:['koper'], propertyTypeIds:['type-wonen'],budgetMax:700000},
  {id:'linked',type:'belegger',commercialRoles:['koper'],propertyTypeIds:['type-wonen'],budgetMax:700000},
  {id:'outlier',type:'belegger',commercialRoles:['koper']}
];
const zoekprofielen: CrmMandaatInput[] = [
  {id:'broker-mandaat-1',relatieId:'broker',status:'actief',naam:'Woningen tot €800k',
    propertyTypeIds:['type-wonen'], prijsMax:800000},
  {id:'broker-mandaat-2',relatieId:'broker',status:'actief',naam:'Kopersnetwerk Brabant',
    propertyTypeIds:['type-wonen'],prijsMax:950000},
  {id:'outlier-mandaat',relatieId:'outlier',status:'actief',naam:'Budget buiten bandbreedte',
    propertyTypeIds:['type-wonen'],prijsMax:200000,mandateType:'eigen_aankoop',mandateConfirmed:true}
];
const namen: Record<string,string> = {
  broker:'Horecamakelaar Nederland',investor:'Directe belegger',
  linked:'Reeds gekoppelde relatie',outlier:'Afwijkende partij'
};
function GemeenteAcceptatie() {
 const [provincie,setProvincie]=useState('Noord-Brabant');
 const [gemeenten,setGemeenten]=useState<string[]>([]);
 return <section aria-label="Provincie en gemeente acceptatie" style={{marginTop:24,padding:16,border:'1px solid #e3d9cc',borderRadius:12}}>
  <h2 style={{fontSize:20,fontWeight:700}}>Geografisch zoekprofiel — test</h2>
  <p style={{fontSize:13,color:'#64748b'}}>Alleen fictieve selectie; niets wordt opgeslagen.</p>
  <label style={{display:'block',marginTop:12,marginBottom:10}}>Provincie voorbeeld
    <select aria-label="Provincie voorbeeld" value={provincie}
      onChange={e=>setProvincie(e.target.value)} style={{marginLeft:12,padding:8,border:'1px solid #aaa'}}>
      <option value="Noord-Brabant">Noord-Brabant</option>
      <option value="Utrecht">Utrecht</option>
      <option value="Zuid-Holland">Zuid-Holland</option>
    </select>
  </label>
  <GemeentePicker provincies={[provincie]} gekozen={gemeenten} onChange={setGemeenten} />
 </section>;
}

function RollenAcceptatie(){
 const [rollen,setRollen]=useState<CommercieleRol[] | null>(null);
 return <section aria-label="Commerciële rollen acceptatie" style={{marginTop:24,padding:16,border:'1px solid #e3d9cc',borderRadius:12}}>
  <h2 style={{fontSize:20,fontWeight:700}}>Commerciële rollen — test</h2>
  <p style={{fontSize:13}}>Bestaand type partij: makelaar. Dit blijft ongewijzigd.</p>
  <CommercieleRollenPicker value={rollen} onChange={setRollen}/>
  <p role="status">Rollen: {rollen===null?'onbekend':rollen.length?rollen.join(', '):'bewust leeg'}</p>
 </section>;
}
function App() {
 const [keuze,setKeuze]=useState<string | null>(null);
 return <div style={{background:'#f5f1ec',minHeight:'100vh',padding:'18px 12px'}}>
  <main style={{maxWidth:'940px',margin:'0 auto',background:'#fffdfa',border:'1px solid #e3d9cc',
    borderRadius:'16px',padding:'clamp(16px, 4vw, 32px)',overflowWrap:'anywhere'}}>
   <div style={{borderBottom:'1px solid #e8e0d6',paddingBottom:'18px',marginBottom:'22px'}}>
    <p style={{fontSize:'12px',fontWeight:700,color:'#886438',letterSpacing:'.07em'}}>BITO CRM · SYNTHETISCHE TESTOMGEVING</p>
    <h1 style={{fontSize:'clamp(24px, 4vw, 32px)',fontWeight:700,color:'#072438',margin:'8px 0'}}>Matching R2 – acceptatieomgeving</h1>
    <p style={{fontSize:'14px',color:'#5b6573'}}>Geen echte CRM-records, geen verzending en geen opslag. Testobject: verhuurde woning Breda · € 450.000.</p>
   </div>
   <KandidaatVoorstellenR2 object={object} relaties={relaties} zoekprofielen={zoekprofielen}
    reedsGekoppeld={new Set(['linked'])}
    relatieNaam={id=>namen[id]||id}
    onConceptGekozen={concept=>setKeuze(`Gekozen contact: ${namen[concept.contactRelatieId]}; rechtstreeks benaderbaar; eindkoper: ${concept.koperRelatieId||'later vaststellen'}; geen opslag`)}
   />
   {keuze && <div style={{marginTop:'20px',padding:'14px',borderRadius:'10px',background:'#f2ede5'}} role="status">{keuze}</div>}
   <GemeenteAcceptatie />
   <RollenAcceptatie />
  </main>
 </div>;
}
createRoot(document.getElementById('root')!).render(<App/>);
