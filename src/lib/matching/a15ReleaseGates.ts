import type { A15Impact } from './a15ImpactPreview';
import type { CrmRelatieInput } from './rolMandaatAdapter';
import type { A15ReferentieAudit } from './a15ReferentieAudit';

/** A15.6 — uitsluitend read-only releasevoorbereiding, nooit een mergebesluit. */
export type VrijgaveControle={
  id:string;
  naam:string;
  aantal:number|null;
  toelichting:string;
  open:boolean;
  soort:'data'|'handmatig';
};
export type A15VrijgaveBeoordeling={
  veiligVoorAutomatischeOpschoning:false;
  openDatacontroles:number;
  openHandmatigeControles:number;
  controles:VrijgaveControle[];
};

/**
 * We bewaren geen goedkeuringsstatus in het relatieprofiel, de pipeline of
 * localStorage. Het ontbreken van risico-indicatoren is geen akkoord op
 * een destructieve migratie: backup, dry-run en expliciete vrijgave zijn
 * zelfstandige handmatige releasevoorwaarden.
 */
export function beoordeelA15Vrijgave(
  impact:Pick<A15Impact,
    'pipelineTeBeoordelen'|'pipelineZonderGegenereerdeMatch'|
    'pipelineWegvallendeRoutes'|'pipelineGewijzigdeKoperverwijzingen'|
    'lopendePipelineBuitenVergelijking'|'veranderdeKoperidentiteiten'|
    'verdwenenKoppelingen'>,
  relaties:readonly Pick<CrmRelatieInput,'partijprofiel'|'softDeletedAt'>[],
  referenties?:A15ReferentieAudit,
):A15VrijgaveBeoordeling{
  const nogNietGeclassificeerd=relaties.filter(r=>!r.softDeletedAt&&!r.partijprofiel).length;
  const data:VrijgaveControle[]=[
    {
      id:'classificatie',naam:'Relaties zonder bevestigd Partijprofiel',
      aantal:nogNietGeclassificeerd,soort:'data',open:nogNietGeclassificeerd>0,
      toelichting:'Controleer de bestaande relatie-informatie. Historisch Belegger is geen betrouwbare automatische classificatie.',
    },
    {
      id:'pipeline_review',naam:'Lopende kandidaatposities met aandachtspunt',
      aantal:impact.pipelineTeBeoordelen,soort:'data',open:impact.pipelineTeBeoordelen>0,
      toelichting:'Bestaande kandidaatposities blijven behouden en moeten per object en relatie worden beoordeeld.',
    },
    {
      id:'zonder_match',naam:'Bestaande posities zonder gegenereerde match',
      aantal:impact.pipelineZonderGegenereerdeMatch,soort:'data',open:impact.pipelineZonderGegenereerdeMatch>0,
      toelichting:'Het ontbreken van een automatisch voorstel is nooit bewijs dat een kandidaat moet worden verwijderd.',
    },
    {
      id:'wegvallende_route',naam:'Wegvallende routes bij bestaande kandidaten',
      aantal:impact.pipelineWegvallendeRoutes,soort:'data',open:impact.pipelineWegvallendeRoutes>0,
      toelichting:'Niet automatisch afwijzen of uit de pipeline halen na wijziging van het matchbeleid.',
    },
    {
      id:'koperidentiteit',naam:'Veranderde berekende koperverwijzingen',
      aantal:impact.veranderdeKoperidentiteiten,soort:'data',open:impact.veranderdeKoperidentiteiten>0,
      toelichting:'De uiteindelijke koper is een transactiedossierfeit; een simulatie mag die identiteit niet overschrijven.',
    },
    {
      id:'niet_beschikbaar',naam:'Lopende pipeline buiten de matchvergelijking',
      aantal:impact.lopendePipelineBuitenVergelijking,soort:'data',
      open:impact.lopendePipelineBuitenVergelijking>0,
      toelichting:'Ook posities op on-hold en andere niet-aanbiedbare objecten blijven onderdeel van de bewaarplicht.',
    },
    {
      id:'nieuwe_match',naam:'Weggevallen gegenereerde kandidaten',
      aantal:impact.verdwenenKoppelingen,soort:'data',open:impact.verdwenenKoppelingen>0,
      toelichting:'Beoordeel verschillen in prospectieve matching afzonderlijk van reeds bestaande pipelineposities.',
    },
  ];
  if(referenties){
    data.push(
      {
        id:'archief_object',naam:'Lopende posities op gearchiveerde objecten',
        aantal:referenties.positiesOpGearchiveerdeObjecten,soort:'data',
        open:referenties.positiesOpGearchiveerdeObjecten>0,
        toelichting:'Niet als actuele acquisitiekans meetellen; controleer eerst dossier en objectarchief. Verwijder nooit automatisch de kandidaathistorie.',
      },
      {
        id:'object_ontbreekt',naam:'Kandidaatposities met een niet-geladen object',
        aantal:referenties.positiesZonderGeladenObject,soort:'data',
        open:referenties.positiesZonderGeladenObject>0,
        toelichting:'Niet geladen betekent niet noodzakelijk verwijderd. Controleer de bron, archiefstatus en eventuele gedeeltelijke synchronisatie.',
      },
      {
        id:'relatie_ontbreekt',naam:'Kandidaatposities met een ontbrekende of gearchiveerde relatie',
        aantal:referenties.positiesZonderGeladenRelatie+referenties.positiesMetGearchiveerdeRelatie,
        soort:'data',open:referenties.positiesZonderGeladenRelatie+referenties.positiesMetGearchiveerdeRelatie>0,
        toelichting:'Controleer of de referentie nog geldig is, zonder kandidaten of kopers automatisch te verplaatsen.',
      },
    );
  }
  const handmatig:VrijgaveControle[]=[
    {
      id:'schema',naam:'Databaseschema en reversibele migratie gecontroleerd',
      aantal:null,soort:'handmatig',open:true,
      toelichting:'A14-uitbreiding en latere verwijdering van legacyvelden zijn afzonderlijke migratiestappen.',
    },
    {
      id:'backup',naam:'Backup, herstelproef en terugvalplan gecontroleerd',
      aantal:null,soort:'handmatig',open:true,
      toelichting:'Voer een restore-test en controle van aantallen, relaties, zoekprofielen en pipeline uit vóór destructieve opschoning.',
    },
    {
      id:'fiat',naam:'Expliciete inhoudelijke en technische vrijgave',
      aantal:null,soort:'handmatig',open:true,
      toelichting:'Pas na gecontroleerde review en toestemming kan een afzonderlijk releasebesluit worden genomen.',
    },
  ];
  return {
    veiligVoorAutomatischeOpschoning:false,
    openDatacontroles:data.filter(c=>c.open).length,
    openHandmatigeControles:handmatig.filter(c=>c.open).length,
    controles:[...data,...handmatig],
  };
}
