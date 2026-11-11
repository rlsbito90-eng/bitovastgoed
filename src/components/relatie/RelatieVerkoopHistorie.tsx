import { Link } from 'react-router-dom';
import type { ObjectVastgoed } from '@/data/mock-data';
import { OBJECT_STATUS_LABELS,formatDate } from '@/data/mock-data';
import { gekoppeldeVerkoopobjecten } from '@/lib/relaties/objectVerkoopHistorie';

interface Props {
  relatieId: string;
  objecten: readonly ObjectVastgoed[];
}

/** Historische verkoopobjecten via bestaande objecten.eigenaar_relatie_id.
 * Betreft geregistreerde objecten, niet automatisch de datum van aanlevering.
 */
export default function RelatieVerkoopHistorie({relatieId,objecten}:Props) {
  const gekoppeld=gekoppeldeVerkoopobjecten(relatieId,objecten);
  const beschikbaar=gekoppeld.filter(o=>o.status==='beschikbaar'&&!o.isArchived).length;
  const verkocht=gekoppeld.filter(o=>o.status==='verkocht').length;

  return (
    <section className="section-card p-5 sm:p-6 space-y-3" data-testid="relatie-verkoop-historie">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="section-title">Aangeboden vastgoed · gekoppelde dossiers</h2>
          <p className="text-xs text-muted-foreground mt-1">
            Objecten waarbij deze relatie als verkoper/eigenaar is gekoppeld.
          </p>
        </div>
        <span className="text-xs font-medium border rounded-md px-2 py-1">
          {gekoppeld.length} {gekoppeld.length===1?'object':'objecten'}
        </span>
      </div>
      {gekoppeld.length>0&&
        <p className="text-xs text-muted-foreground">
          {beschikbaar} beschikbaar · {verkocht} verkocht · overige statussen blijven in de historie
        </p>}
      {gekoppeld.length===0?
        <p className="text-sm text-muted-foreground">
          Nog geen objecten gekoppeld aan deze relatie. Koppel bij een object de
          bestaande verkoper/eigenaar om het dossier hier terug te vinden.
        </p>
        :<div className="divide-y divide-border/70">
          {gekoppeld.map(o=>(
            <Link key={o.id} to={'/objecten/'+o.id}
              className="flex gap-3 items-start justify-between py-3 hover:bg-muted/40 rounded px-1">
              <div className="min-w-0">
                <p className="text-sm font-medium break-words">{o.titel}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {[o.plaats,o.provincie].filter(Boolean).join(' · ') || 'Locatie niet ingevuld'}
                  {' · '}
                  {o.datumToegevoegd?('Geregistreerd '+formatDate(o.datumToegevoegd)):'Registratiedatum onbekend'}
                </p>
              </div>
              <span className="shrink-0 text-xs text-muted-foreground text-right">
                {OBJECT_STATUS_LABELS[o.status]??o.status}
                {o.isArchived?' · Archief':''}
              </span>
            </Link>
          ))}
        </div>
      }
      <p className="text-xs text-muted-foreground">
        De datum hierboven is de registratiedatum in het CRM, niet per definitie de
        daadwerkelijke aanleverdatum. Vrije tekst zonder relatiekoppeling wordt niet
        meegeteld. Voor een volledige herkomsthistorie is later registratie van
        aanbrenger en aanlevermoment nodig.
      </p>
    </section>
  );
}
