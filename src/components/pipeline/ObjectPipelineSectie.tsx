import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useDataStore } from '@/hooks/useDataStore';
import { Button } from '@/components/ui/button';
import { Plus, Trash2, Pencil, ExternalLink, Send, MessageSquareText } from 'lucide-react';
import { PipelineFaseBadge, InteresseNiveauBadge } from './PipelineBadges';
import PipelineKandidaatDialog from './PipelineKandidaatDialog';
import KandidaatSelectieDialog from './KandidaatSelectieDialog';
import AanbiedingRegistrerenDialog from '@/components/forms/AanbiedingRegistrerenDialog';
import AanbiedingsReactieDialog from '@/components/forms/AanbiedingsReactieDialog';
import { laatsteReactie, marktsignaalVoorObject, REACTIE_STATUS_LABELS } from '@/lib/relaties/aanbiedingsReacties';
import { VOLGENDE_ACTIE_LABELS, type PipelineKandidaat } from '@/data/mock-data';
import { toast } from 'sonner';
import { getRelatieDropdownLabel } from '@/lib/relatieNaam';
import { format } from 'date-fns';
import { nl } from 'date-fns/locale';

interface Props { objectId: string; }

const fmtDatum = (d?: string) => d ? format(new Date(d), 'd MMM yyyy', { locale: nl }) : '—';
const fmtBedrag = (n?: number) => n != null ? new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n) : '—';

export default function ObjectPipelineSectie({ objectId }: Props) {
  const {
    relaties, contactpersonen, contactMoments, getPipelineVoorObject, removePipelineKandidaat,
  } = useDataStore();

  const kandidaten = getPipelineVoorObject(objectId);
  const [adding, setAdding] = useState(false);
  const [bewerken, setBewerken] = useState<PipelineKandidaat | null>(null);
  const [aanbiedOpen,setAanbiedOpen]=useState(false);
  const [aanbiedRelatieId,setAanbiedRelatieId]=useState('');
  const [reactieOpen,setReactieOpen]=useState(false);
  const [reactieRelatieId,setReactieRelatieId]=useState('');
  const openReactie=(relatieId='')=>{
    setReactieRelatieId(relatieId);setReactieOpen(true);
  };
  const marktsignaal=marktsignaalVoorObject(objectId,contactMoments??[]);
  const openAanbieding=(relatieId='')=>{
    setAanbiedRelatieId(relatieId);
    setAanbiedOpen(true);
  };

  const reedsGekoppeld = useMemo(
    () => new Set(kandidaten.map(k => k.relatieId)),
    [kandidaten],
  );

  const handleRemove = async (id: string) => {
    if (!confirm('Kandidaat uit pipeline verwijderen?')) return;
    try {
      await removePipelineKandidaat(id);
      toast.success('Verwijderd');
    } catch (err: any) {
      toast.error(`Verwijderen mislukt: ${err.message ?? 'onbekende fout'}`);
    }
  };

  return (
    <section className="section-card relative z-10 p-5 sm:p-6 space-y-4 min-w-0 max-w-full">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="section-title">Kandidaten / dealtraject</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {kandidaten.length === 0 ? 'Nog geen kandidaten in de pipeline.' : `${kandidaten.length} kandida${kandidaten.length === 1 ? 'at' : 'ten'} in pipeline`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={()=>openReactie()}>
            <MessageSquareText className="h-4 w-4 mr-1"/> Reactie registreren
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={()=>openAanbieding()}>
            <Send className="h-4 w-4 mr-1"/> Aanbieding registreren
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => setAdding(true)} disabled={relaties.length === reedsGekoppeld.size}>
            <Plus className="h-4 w-4 mr-1" /> Kandidaat toevoegen
          </Button>
        </div>
      </div>

      {marktsignaal.reacties>0&&<div className="border-t border-border/70 pt-3 text-xs text-muted-foreground space-y-1">
        <p>{marktsignaal.reacties} unieke beleggers met geregistreerde reactie
          {' · '}{marktsignaal.afwijzingen} afwijzingen
          {marktsignaal.zonderReactie>0?' · '+marktsignaal.zonderReactie+' nog zonder reactie':''}
        </p>
        {marktsignaal.andersAantal>0&&<p>
          {marktsignaal.andersAantal} afwijzing(en) onder ‘Andere reden’.
          Bekijk de toelichtingen voordat je een nieuwe categorie overweegt.
        </p>}
        {marktsignaal.patronen.map(p=><p key={p.reden} className="text-foreground">
          Markttoets: {p.aantal} van {p.reacties} reagerende beleggers noemt
          {' '}{p.label.toLowerCase()}. Beoordeel zelf of de propositie aanpassing vraagt.
        </p>)}
      </div>}
      <KandidaatSelectieDialog
        open={adding}
        onOpenChange={setAdding}
        objectId={objectId}
        reedsGekoppeld={reedsGekoppeld}
      />

      {kandidaten.length > 0 && (
        <>
          {/* Mobiele lijstweergave */}
          <div className="lg:hidden space-y-3">
            {kandidaten.map(k => {
              const rel = relaties.find(r => r.id === k.relatieId);
              return (
                <div
                  key={k.id}
                  onClick={() => setBewerken(k)}
                  className="bg-background border border-border rounded-lg p-3 cursor-pointer active:bg-muted/40"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground leading-snug">
                        {rel ? getRelatieDropdownLabel(rel, contactpersonen) : '(verwijderd)'}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button type="button"
                        onClick={(e)=>{e.stopPropagation();openReactie(k.relatieId);}}
                        className="p-2 text-muted-foreground hover:text-primary rounded-md transition-colors"
                        aria-label="Reactie registreren" title="Reactie registreren">
                        <MessageSquareText className="h-4 w-4"/>
                      </button>
                      <button type="button"
                        onClick={(e)=>{e.stopPropagation();openAanbieding(k.relatieId);}}
                        className="p-2 text-muted-foreground hover:text-primary rounded-md transition-colors"
                        aria-label="Aanbieding registreren" title="Aanbieding registreren">
                        <Send className="h-4 w-4"/>
                      </button>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setBewerken(k); }}
                        className="p-2 text-muted-foreground hover:text-primary rounded-md transition-colors"
                        aria-label="Bewerken"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handleRemove(k.id); }}
                        className="p-2 text-muted-foreground hover:text-destructive rounded-md transition-colors"
                        aria-label="Verwijderen"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    <PipelineFaseBadge fase={k.pipelineFase} />
                    <InteresseNiveauBadge niveau={k.interesseNiveau} />
                    {k.matchscore != null && (
                      <span className="text-xs text-muted-foreground font-mono-data">
                        {k.matchscore}% match
                      </span>
                    )}
                  </div>
                  {laatsteReactie(k.relatieId,objectId,contactMoments??[])&&
                    <p className="text-xs text-muted-foreground mt-1.5">
                      Laatste reactieregistratie: {REACTIE_STATUS_LABELS[
                        laatsteReactie(k.relatieId,objectId,contactMoments??[])!.aanbiedingReactie!.status
                      ]}
                    </p>}
                  {k.volgendeActie && (
                    <p className="text-xs text-muted-foreground mt-1.5">
                      <span className="font-medium text-foreground">{VOLGENDE_ACTIE_LABELS[k.volgendeActie]}</span>
                      {k.volgendeActieDatum && <span> · {fmtDatum(k.volgendeActieDatum)}</span>}
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          {/* Desktop tabelweergave */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground border-b border-border">
                <tr>
                  <th className="text-left font-medium py-2 px-2">Relatie</th>
                  <th className="text-left font-medium py-2 px-2">Fase</th>
                  <th className="text-left font-medium py-2 px-2">Interesse</th>
                  <th className="text-right font-medium py-2 px-2">Match</th>
                  <th className="text-right font-medium py-2 px-2">Bieding</th>
                  <th className="text-left font-medium py-2 px-2">Volgende actie</th>
                  <th className="text-left font-medium py-2 px-2">Laatste pipeline-activiteit</th>
                  <th className="text-right font-medium py-2 px-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/70">
                {kandidaten.map(k => {
                  const rel = relaties.find(r => r.id === k.relatieId);
                  return (
                    <tr
                      key={k.id}
                      onClick={() => setBewerken(k)}
                      className="hover:bg-muted/40 cursor-pointer transition-colors"
                    >
                      <td className="py-2 px-2">
                        <Link
                          to={`/relaties/${k.relatieId}`}
                          onClick={(e) => e.stopPropagation()}
                          className="font-medium hover:text-primary inline-flex items-center gap-1"
                        >
                          {rel ? getRelatieDropdownLabel(rel, contactpersonen) : '(verwijderd)'}
                          <ExternalLink className="h-3 w-3 opacity-60" />
                        </Link>
                      </td>
                      <td className="py-2 px-2"><PipelineFaseBadge fase={k.pipelineFase} /></td>
                      <td className="py-2 px-2"><InteresseNiveauBadge niveau={k.interesseNiveau} /></td>
                      <td className="py-2 px-2 text-right font-mono-data text-xs">
                        {k.matchscore != null ? `${k.matchscore}%` : '—'}
                      </td>
                      <td className="py-2 px-2 text-right font-mono-data text-xs">{fmtBedrag(k.biedingBedrag)}</td>
                      <td className="py-2 px-2 text-xs">
                        {k.volgendeActie ? (
                          <span>
                            <span className="font-medium">{VOLGENDE_ACTIE_LABELS[k.volgendeActie]}</span>
                            {k.volgendeActieDatum && <span className="text-muted-foreground"> · {fmtDatum(k.volgendeActieDatum)}</span>}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="py-2 px-2 text-xs text-muted-foreground">
                        {fmtDatum(k.laatsteContactdatum)}
                        {laatsteReactie(k.relatieId,objectId,contactMoments??[])&&
                          <span className="block mt-1">
                            {REACTIE_STATUS_LABELS[
                              laatsteReactie(k.relatieId,objectId,contactMoments??[])!.aanbiedingReactie!.status
                            ]}
                          </span>}
                      </td>
                      <td className="py-2 px-2 text-right" onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="sm" onClick={()=>openReactie(k.relatieId)}
                          title="Reactie registreren" aria-label="Reactie registreren"
                          className="h-8 w-8 p-0">
                          <MessageSquareText className="h-3.5 w-3.5"/>
                        </Button>
                        <Button variant="ghost" size="sm" onClick={()=>openAanbieding(k.relatieId)}
                          title="Aanbieding registreren" aria-label="Aanbieding registreren"
                          className="h-8 w-8 p-0">
                          <Send className="h-3.5 w-3.5"/>
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setBewerken(k)} className="h-8 w-8 p-0">
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleRemove(k.id)} className="h-8 w-8 p-0 text-destructive">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      <AanbiedingRegistrerenDialog open={aanbiedOpen} onOpenChange={setAanbiedOpen}
        defaultObjectId={objectId} defaultRelatieId={aanbiedRelatieId}/>
      <AanbiedingsReactieDialog open={reactieOpen} onOpenChange={setReactieOpen}
        defaultObjectId={objectId} defaultRelatieId={reactieRelatieId}/>
      {bewerken && (
        <PipelineKandidaatDialog
          open={!!bewerken}
          onOpenChange={(o) => { if (!o) setBewerken(null); }}
          kandidaat={bewerken}
        />
      )}
    </section>
  );
}
