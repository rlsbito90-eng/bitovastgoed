import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import AanbiedingRegistrerenDialog from '@/components/forms/AanbiedingRegistrerenDialog';
import AanbiedingsReactieDialog from '@/components/forms/AanbiedingsReactieDialog';
import { laatsteReactie, REACTIE_STATUS_LABELS,REACTIE_REDEN_LABELS } from '@/lib/relaties/aanbiedingsReacties';
import { useDataStore } from '@/hooks/useDataStore';
import { PipelineFaseBadge, InteresseNiveauBadge } from './PipelineBadges';
import { VOLGENDE_ACTIE_LABELS } from '@/data/mock-data';
import { aanbodHistorieVoorRelatie,isAlsAangebodenGeregistreerd,type AanbiedingHistorieRij } from '@/lib/relaties/aanbiedingsHistorie';
import { format } from 'date-fns';
import { nl } from 'date-fns/locale';
import { Building2, Send, MessageSquareText } from 'lucide-react';

const fmtDatum = (d?: string) =>
  d ? format(new Date(d), 'd MMM yyyy', { locale: nl }) : '—';

export default function RelatiePipelineSectie({ relatieId }: { relatieId: string }) {
  const { getPipelineVoorRelatie, getObjectById, contactMoments } = useDataStore();
  const items = getPipelineVoorRelatie(relatieId);
  const rijen = aanbodHistorieVoorRelatie(items,contactMoments ?? []);
  const aangeboden = rijen.filter(isAlsAangebodenGeregistreerd);
  const nogNietAangeboden = rijen.filter(r => !isAlsAangebodenGeregistreerd(r));
  const [aanbiedOpen,setAanbiedOpen]=useState(false);
  const [aanbiedObjectId,setAanbiedObjectId]=useState('');
  const [reactieOpen,setReactieOpen]=useState(false);
  const [reactieObjectId,setReactieObjectId]=useState('');
  const openReactie=(objectId='')=>{
    setReactieObjectId(objectId);setReactieOpen(true);
  };
  const openAanbieding=(objectId='')=>{
    setAanbiedObjectId(objectId);
    setAanbiedOpen(true);
  };

  const toonRij = (rij: AanbiedingHistorieRij) => {
    const k=rij.kandidaat;
    const obj=getObjectById(k.objectId);
    return <li key={k.id} className="px-2 py-3">
      <div className="flex items-start justify-between gap-3">
        <Link to={'/objecten/'+k.objectId} className="flex-1 min-w-0 group">
          <div className="flex items-center gap-2 text-sm font-medium group-hover:text-primary">
            <Building2 className="h-4 w-4 opacity-60 shrink-0" />
            <span className="break-words">{obj?.titel ?? '(verwijderd object)'}</span>
          </div>
          {obj?.plaats && <p className="text-xs text-muted-foreground ml-6">{obj.plaats}</p>}
        </Link>
        <div className="flex flex-wrap items-center gap-1.5 justify-end shrink-0">
          <PipelineFaseBadge fase={k.pipelineFase} />
          <InteresseNiveauBadge niveau={k.interesseNiveau} />
        </div>
      </div>
      <div className="mt-1.5 ml-6 text-xs text-muted-foreground flex flex-wrap gap-x-4 gap-y-1">
        {isAlsAangebodenGeregistreerd(rij) && <span>
          <strong className="text-foreground/80">Aangeboden:</strong>{' '}
          {rij.eersteAanbieddatum
            ? fmtDatum(rij.eersteAanbieddatum)
            : rij.bewijs === 'fase_zonder_datum'
              ? 'Volgens pipelinefase; datum niet geregistreerd'
              : 'Datum niet geregistreerd'}
        </span>}
        {k.volgendeActie && <span>
          <strong className="text-foreground/80">Volgende:</strong> {VOLGENDE_ACTIE_LABELS[k.volgendeActie]}
          {k.volgendeActieDatum && ' · '+fmtDatum(k.volgendeActieDatum)}
        </span>}
        {k.laatsteContactdatum && <span>
          <strong className="text-foreground/80">Laatste pipeline-activiteit:</strong> {fmtDatum(k.laatsteContactdatum)}
        </span>}
      </div>
      {rij.momenten.length > 0 && <p className="mt-1 ml-6 text-xs text-muted-foreground">
        {rij.momenten.map(m=>(
          (m.soort === 'teaser' ? 'Teaser ' : 'Informatie ')+fmtDatum(m.datum)
        )).join(' · ')}
      </p>}
      {laatsteReactie(relatieId,k.objectId,contactMoments??[])&&
        <p className="mt-1 ml-6 text-xs text-muted-foreground">
          <strong className="text-foreground/80">Laatste reactie: </strong>
          {REACTIE_STATUS_LABELS[
            laatsteReactie(relatieId,k.objectId,contactMoments??[])!.aanbiedingReactie!.status
          ]}
          {laatsteReactie(relatieId,k.objectId,contactMoments??[])!.aanbiedingReactie!.redenen.length>0
            ?' · '+laatsteReactie(relatieId,k.objectId,contactMoments??[])!.aanbiedingReactie!.redenen.map(
              r=>REACTIE_REDEN_LABELS[r],
            ).join(', ')
            :''}
        </p>}
      {k.redenAfgevallen && <p className="mt-1 ml-6 text-xs text-muted-foreground">
        <strong className="text-foreground/80">Reden afgevallen:</strong> {k.redenAfgevallen}
      </p>}
      <div className="mt-2 ml-6 flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={()=>openReactie(k.objectId)}>
          <MessageSquareText className="h-3.5 w-3.5 mr-1.5"/> Reactie registreren
        </Button>
        <Button variant="outline" size="sm" onClick={()=>openAanbieding(k.objectId)}>
          <Send className="h-3.5 w-3.5 mr-1.5"/> Aanbieding registreren
        </Button>
      </div>
    </li>;
  };

  return (
    <section className="section-card p-5 sm:p-6 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="section-title">Aanbiedingshistorie en kandidaten</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {aangeboden.length} als aangeboden geregistreerd · {nogNietAangeboden.length} gekoppeld zonder geregistreerde aanbieding
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="outline" onClick={()=>openReactie()}>
            <MessageSquareText className="h-4 w-4 mr-1.5"/> Reactie registreren
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={()=>openAanbieding()}>
            <Send className="h-4 w-4 mr-1.5"/> Aanbieding registreren
          </Button>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Alleen expliciet vastgelegde teasers, gedeelde informatie of de bijbehorende
        pipelinefase gelden als aangeboden. Een match of kandidaat toevoegen
        is op zichzelf nog geen aanbieding.
      </p>

      <div>
        <h3 className="font-medium text-sm">Aangeboden objecten ({aangeboden.length})</h3>
        {aangeboden.length > 0
          ? <ul className="divide-y divide-border/70 -mx-2">{aangeboden.map(toonRij)}</ul>
          : <p className="text-sm text-muted-foreground mt-2">
              Nog geen aanbieding geregistreerd voor deze relatie.
            </p>}
      </div>

      {nogNietAangeboden.length > 0 && <div>
        <h3 className="font-medium text-sm">
          Gekoppelde kandidaten, nog niet als aangeboden geregistreerd ({nogNietAangeboden.length})
        </h3>
        <p className="text-xs text-muted-foreground mt-1">
          Controleer bij historische dossiers of een teaser of aanbod eerder
          buiten de CRM is gedeeld; dit wordt niet automatisch aangenomen.
        </p>
        <ul className="divide-y divide-border/70 -mx-2">{nogNietAangeboden.map(toonRij)}</ul>
      </div>}
      <AanbiedingRegistrerenDialog open={aanbiedOpen}
        onOpenChange={setAanbiedOpen}
        defaultRelatieId={relatieId}
        defaultObjectId={aanbiedObjectId}/>
      <AanbiedingsReactieDialog open={reactieOpen}
        onOpenChange={setReactieOpen}
        defaultRelatieId={relatieId}
        defaultObjectId={reactieObjectId}/>
    </section>
  );
}
