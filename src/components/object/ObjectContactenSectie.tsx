import { Link } from 'react-router-dom';
import { Mail, Phone } from 'lucide-react';
import type { ObjectVastgoed, Relatie } from '@/data/mock-data';
import { VERKOPER_VIA_LABELS } from '@/data/mock-data';
import RelatieNaamDisplay from '@/components/RelatieNaamDisplay';

type Props = { object:ObjectVastgoed; gekoppeldeRelatie:Relatie|null; toonPrimair?:boolean };
type ItemProps = { label:string; value:string|undefined|null; href?:string };
function Contactveld({label,value,href}:ItemProps) {
  if(!value?.trim())return null;
  return <div className="min-w-0">
    <dt className="field-label">{label}</dt>
    <dd className="field-value mt-1.5 break-words">
      {href?<a href={href} className="hover:text-accent inline-flex items-center gap-1 break-all">
        {label==='Telefoon'?<Phone className="h-3.5 w-3.5 shrink-0"/>:<Mail className="h-3.5 w-3.5 shrink-0"/>}
        {value}
      </a>:value}
    </dd>
  </div>;
}
function contactAanwezig(...velden:Array<string|null|undefined>) {
  return velden.some(v=>!!v?.trim());
}

/** Gekoppelde relatie is leidend; de vrije contactvelden blijven
 * bewaard en alleen als aanvullende bron onder een inklapbare groep.
 */
export default function ObjectContactenSectie({object,gekoppeldeRelatie,toonPrimair=true}:Props) {
  const verkoperAanvullend=contactAanwezig(
    object.verkoperNaam,object.verkoperEmail,object.verkoperTelefoon,object.verkoperRol,object.verkoperVia,
  );
  const makelaarAanvullend=contactAanwezig(
    object.contactNaam,object.contactEmail,object.contactTelefoon,object.contactFunctie,
  );
  const overigeCount=Number(verkoperAanvullend)+Number(makelaarAanvullend);

  return <div className="space-y-3">
    {toonPrimair&&<section className="section-card p-5 space-y-3" data-testid="object-gekoppelde-relatie">
        <h3 className="section-title">Gekoppelde verkoper / eigenaar</h3>
        {gekoppeldeRelatie?
          <Link to={`/relaties/${gekoppeldeRelatie.id}`}
            className="block hover:opacity-80 transition-opacity">
            <RelatieNaamDisplay relatie={gekoppeldeRelatie} variant="default"/>
          </Link>
          :object.eigenaarRelatieId?
          <p className="text-sm text-muted-foreground">Gekoppelde relatie niet gevonden. Controleer de koppeling.</p>
          :object.verkoperNaam?.trim()?
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">{object.verkoperNaam}</p>
            <p className="text-xs text-muted-foreground">Alleen in object vastgelegd; nog niet aan Relaties gekoppeld.</p>
          </div>
          :<p className="text-sm text-muted-foreground">Nog geen verkoper of eigenaar gekoppeld.</p>}
      </section>}
    {toonPrimair&&object.verkoopmotivatie?.trim()&&
      <section className="section-card p-5 space-y-2">
        <h3 className="section-title">Verkoopmotivatie</h3>
        <p className="text-sm text-foreground whitespace-pre-wrap break-words">{object.verkoopmotivatie}</p>
      </section>}
    {overigeCount>0&&<details className="section-card">
      <summary className="cursor-pointer px-5 py-4 text-sm font-medium text-foreground hover:bg-muted/30">
        Aanvullende contactgegevens
        <span className="ml-2 text-xs font-normal text-muted-foreground">({overigeCount})</span>
        <span className="block text-xs font-normal text-muted-foreground mt-1">
          Losse objectgegevens · gekoppelde relatie blijft leidend
        </span>
      </summary>
      <div className="grid sm:grid-cols-2 gap-4 border-t border-border px-4 py-4">
        {verkoperAanvullend&&<section className="rounded-md border border-border/70 p-4 space-y-3">
          <h4 className="text-sm font-medium">Verkoper (aanvullend)</h4>
          <dl className="space-y-3">
            <Contactveld label="Naam" value={object.verkoperNaam}/>
            <Contactveld label="Rol" value={object.verkoperRol}/>
            <Contactveld label="Via" value={object.verkoperVia?
              VERKOPER_VIA_LABELS[object.verkoperVia]??object.verkoperVia:null}/>
            <Contactveld label="Telefoon" value={object.verkoperTelefoon}
              href={object.verkoperTelefoon?`tel:${object.verkoperTelefoon}`:undefined}/>
            <Contactveld label="E-mail" value={object.verkoperEmail}
              href={object.verkoperEmail?`mailto:${object.verkoperEmail}`:undefined}/>
          </dl>
        </section>}
        {makelaarAanvullend&&<section className="rounded-md border border-border/70 p-4 space-y-3">
          <h4 className="text-sm font-medium">Objectcontact / makelaar</h4>
          <dl className="space-y-3">
            <Contactveld label="Naam" value={object.contactNaam}/>
            <Contactveld label="Functie" value={object.contactFunctie}/>
            <Contactveld label="Telefoon" value={object.contactTelefoon}
              href={object.contactTelefoon?`tel:${object.contactTelefoon}`:undefined}/>
            <Contactveld label="E-mail" value={object.contactEmail}
              href={object.contactEmail?`mailto:${object.contactEmail}`:undefined}/>
          </dl>
        </section>}
      </div>
    </details>}
  </div>;
}
