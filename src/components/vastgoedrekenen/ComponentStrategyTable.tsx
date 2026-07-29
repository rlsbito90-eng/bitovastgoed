import type { Component, SellOffUnit } from '@/lib/vastgoedrekenen/types';
import ComponentStrategyTableLegacy from './ComponentStrategyTableLegacy';
import ComponentAllocationValuationSummary from './ComponentAllocationValuationSummary';
import ComponentPeriodicCashflowWorkspace from './ComponentPeriodicCashflowWorkspace';
import ComponentAllocationTimingWorkspace from './ComponentAllocationTimingWorkspace';
import ScenarioUnleveredCashflowWorkspace from './ScenarioUnleveredCashflowWorkspace';
import ScenarioDcfWorkspace from './ScenarioDcfWorkspace';
import PlainLanguageHelp from './PlainLanguageHelp';

type Props = {
  units: SellOffUnit[];
  components: Component[];
  onCreate: (patch?: Record<string, unknown>) => Promise<unknown>;
  onUpdate: (id: string, patch: Record<string, unknown>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onImport: (mode?: 'default' | 'hybrid') => Promise<void>;
};

export default function ComponentStrategyTable(props: Props) {
  return (
    <div className="space-y-3">
      <ComponentStrategyTableLegacy {...props} />

      <PlainLanguageHelp
        title="Uitleg componentallocatie"
        what={<>Je verdeelt één onderdeel van het pand over één of meer plannen. Bijvoorbeeld: een deel verkopen en een deel aanhouden voor verhuur.</>}
        why={<>Zo voorkom je dat hetzelfde onderdeel twee keer volledig meetelt. De CRM kan pas eerlijk wegen wanneer alle regels voor dat onderdeel samen precies 100% zijn.</>}
        action={<>Controleer per onderdeel of de percentages samen 100% vormen. Gebruik alleen meerdere regels wanneer je echt verschillende strategieën voor hetzelfde onderdeel wilt combineren.</>}
        example={<>Een onderdeel met een waarde van € 500.000 wordt 60% verkocht en 40% aangehouden. De verkoopcase telt dan voor € 300.000 mee en de aanhoudcase voor € 200.000.</>}
        warning={<>Bij minder of meer dan 100% blijft de bestaande ongewogen uitkomst actief. De CRM waarschuwt dan, zodat een onvolledige verdeling de waarde niet stilzwijgend verandert.</>}
      />
      <ComponentAllocationValuationSummary units={props.units} />

      <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-xs text-emerald-900 dark:text-emerald-200">
        Complete allocatiegroepen van exact 100% worden financieel gewogen. Onder- of oververdeelde
        groepen blijven tijdelijk ongewogen en tonen een waarschuwing, zodat onvolledige invoer de
        nominale scenariowaarde niet stilzwijgend verandert. Vastgelegde timing voedt de periodieke
        componentkasstroom, de ongefinancierde scenariokasstroom en — na een expliciet opgeslagen
        disconteringsvoet — de DCF- en unlevered-IRR-analyse.
      </div>

      <PlainLanguageHelp
        title="Uitleg periodieke componentkasstroom"
        what={<>Dit overzicht laat per maand of jaar zien welk geld binnenkomt en uitgaat voor de gekozen componentstrategieën.</>}
        why={<>Een project kan op papier winstgevend zijn en toch tussentijds veel geld nodig hebben. De tijdlijn maakt zichtbaar wanneer kosten worden betaald en wanneer huur of verkoopopbrengst binnenkomt.</>}
        action={<>Maak de allocatie compleet en vul de relevante start-, opleverings-, huur-, verkoop- en exitmaanden in. Ontbrekende timing blokkeert de preview.</>}
        example={<>€ 120.000 ontwikkelkosten van maand 1 tot en met 12 worden voorlopig verdeeld als ongeveer € 10.000 per maand.</>}
        warning={<>Dit onderdeel bevat alleen de componenten. Aankoopprijs, overdrachtsbelasting en algemene projectkosten staan in de volledige scenariokasstroom.</>}
      />
      <ComponentPeriodicCashflowWorkspace units={props.units} />

      <PlainLanguageHelp
        title="Uitleg timing"
        what={<>Timing betekent dat je vastlegt in welke maand een verbouwing begint, wanneer deze klaar is, wanneer huur start en wanneer verkoop of exit plaatsvindt.</>}
        why={<>€ 500.000 ontvangen in maand 6 is gunstiger dan hetzelfde bedrag pas in maand 36 ontvangen. Timing bepaalt daarom de kasstroom en later ook de contante waarde.</>}
        action={<>Reken vanaf de peildatum van de Quickscan. Vul alleen momenten in die echt bij de gekozen strategie horen en controleer dat de volgorde logisch is.</>}
        example={<>Ontwikkeling start in maand 1, oplevering in maand 12, huur start in maand 13 en verkoop vindt plaats in maand 36.</>}
        warning={<>Een maand buiten de Quickscan-horizon wordt niet automatisch aangepast. Verleng de horizon of corrigeer het moment bewust.</>}
      />
      <ComponentAllocationTimingWorkspace
        units={props.units}
        onCreate={props.onCreate}
        onUpdate={props.onUpdate}
      />

      <PlainLanguageHelp
        title="Uitleg volledige scenariokasstroom"
        what={<>Dit is de volledige projecttijdlijn vóór financiering. De CRM combineert aankoop, overdrachtsbelasting, aankoopkosten, algemene projectkosten en alle componentkasstromen.</>}
        why={<>Hiermee zie je of het vastgoedproject zelf geld oplevert en hoeveel kapitaal onderweg nodig is, zonder dat een lening de beoordeling mooier of slechter maakt.</>}
        action={<>Sla het scenario op, geef iedere positieve algemene kostenpost een timing en controleer of de investering uit de tijdlijn aansluit op de bestaande totale investering.</>}
        example={<>Aankoop € 1.000.000 in maand 0, € 120.000 projectkosten verspreid over jaar 1 en € 1.500.000 verkoopopbrengst in maand 24.</>}
        warning={<>Het nominale projectresultaat is nog niet hetzelfde als NCW, IRR of rendement op je eigen geld. Rente, lening en aflossing zijn hier nog niet opgenomen.</>}
      />
      <ScenarioUnleveredCashflowWorkspace units={props.units} components={props.components} />

      <PlainLanguageHelp
        title="Uitleg DCF en rendement"
        what={<>DCF rekent toekomstige inkomsten en uitgaven terug naar wat ze vandaag waard zijn. NCW is het bedrag dat na die terugrekening overblijft; unlevered IRR is het jaarlijkse rendement van het project zonder lening.</>}
        why={<>Geld dat je pas later ontvangt is vandaag minder waard. De disconteringsvoet verwerkt tijd, risico en jouw minimale rendementseis in de beoordeling.</>}
        action={<>Vul een jaarlijkse disconteringsvoet in en leg kort vast waar die vandaan komt. Lees een positieve NCW als “boven mijn gekozen rendementseis” en een negatieve NCW als “onder mijn gekozen rendementseis”.</>}
        example={<>Bij een jaarlijkse voet van 10% is € 121.000 die je over twee jaar ontvangt vandaag ongeveer € 100.000 waard.</>}
        warning={<>Een positieve NCW of hoge IRR is geen garantie. Controleer vooral aannames over kosten, verkoopwaarde, huur, looptijd en terminale waarde.</>}
      />
      <ScenarioDcfWorkspace units={props.units} components={props.components} />
    </div>
  );
}
