import type { Component, SellOffUnit } from '@/lib/vastgoedrekenen/types';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import ComponentStrategyTableLegacy from './ComponentStrategyTableLegacy';
import ComponentAllocationValuationSummary from './ComponentAllocationValuationSummary';
import ComponentPeriodicCashflowWorkspace from './ComponentPeriodicCashflowWorkspace';
import ComponentAllocationTimingWorkspace from './ComponentAllocationTimingWorkspace';
import ScenarioUnleveredCashflowWorkspace from './ScenarioUnleveredCashflowWorkspace';
import ScenarioDcfWorkspace from './ScenarioDcfWorkspace';
import ScenarioFinancingWorkspace from './ScenarioFinancingWorkspace';
import PlainLanguageHelp from './PlainLanguageHelp';

type Props = {
  units: SellOffUnit[];
  components: Component[];
  onCreate: (patch?: Record<string, unknown>) => Promise<unknown>;
  onUpdate: (id: string, patch: Record<string, unknown>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onImport: (mode?: 'default' | 'hybrid') => Promise<void>;
};

const WORKSPACE_TABS = [
  { value: 'strategy', step: '1', label: 'Strategie & allocatie' },
  { value: 'timing', step: '2', label: 'Timing' },
  { value: 'cashflow', step: '3', label: 'Kasstroom' },
  { value: 'returns', step: '4', label: 'Rendement' },
  { value: 'financing', step: '5', label: 'Financiering' },
] as const;

export default function ComponentStrategyTable(props: Props) {
  return (
    <Tabs defaultValue="strategy" className="space-y-4">
      <div className="rounded-lg border bg-card/70 p-2 shadow-sm backdrop-blur-sm">
        <div className="mb-2 px-1">
          <p className="text-sm font-medium">Scenario uitwerken</p>
          <p className="text-xs text-muted-foreground">
            Werk van links naar rechts. Alleen het gekozen onderdeel staat open, zodat de Quickscan overzichtelijk blijft.
          </p>
        </div>
        <div className="overflow-x-auto pb-1">
          <TabsList className="inline-grid h-auto min-w-max grid-cols-5 gap-1 bg-muted/50 p-1">
            {WORKSPACE_TABS.map((tab) => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="min-h-10 gap-1.5 whitespace-nowrap px-3 text-xs data-[state=active]:shadow-sm"
              >
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border text-[10px] font-semibold">
                  {tab.step}
                </span>
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
      </div>

      <TabsContent value="strategy" className="mt-0 space-y-3">
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
          Complete allocatiegroepen van exact 100% worden financieel gewogen. Onder- of oververdeelde groepen blijven
          tijdelijk ongewogen en tonen een waarschuwing. Timing, kasstroom, rendement en financiering staan in de volgende
          werkbladen.
        </div>
      </TabsContent>

      <TabsContent value="timing" className="mt-0 space-y-3">
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
      </TabsContent>

      <TabsContent value="cashflow" className="mt-0 space-y-4">
        <section className="space-y-3" aria-labelledby="component-cashflow-heading">
          <h3 id="component-cashflow-heading" className="text-sm font-semibold">Componentkasstroom</h3>
          <PlainLanguageHelp
            title="Uitleg periodieke componentkasstroom"
            what={<>Dit overzicht laat per maand of jaar zien welk geld binnenkomt en uitgaat voor de gekozen componentstrategieën.</>}
            why={<>Een project kan op papier winstgevend zijn en toch tussentijds veel geld nodig hebben. De tijdlijn maakt zichtbaar wanneer kosten worden betaald en wanneer huur of verkoopopbrengst binnenkomt.</>}
            action={<>Maak de allocatie compleet en vul de relevante start-, opleverings-, huur-, verkoop- en exitmaanden in. Ontbrekende timing blokkeert de preview.</>}
            example={<>€ 120.000 ontwikkelkosten van maand 1 tot en met 12 worden voorlopig verdeeld als ongeveer € 10.000 per maand.</>}
            warning={<>Dit onderdeel bevat alleen de componenten. Aankoopprijs, overdrachtsbelasting en algemene projectkosten staan in de volledige scenariokasstroom.</>}
          />
          <ComponentPeriodicCashflowWorkspace units={props.units} />
        </section>

        <section className="space-y-3 border-t pt-4" aria-labelledby="scenario-cashflow-heading">
          <h3 id="scenario-cashflow-heading" className="text-sm font-semibold">Volledige scenariokasstroom</h3>
          <PlainLanguageHelp
            title="Uitleg volledige scenariokasstroom"
            what={<>Dit is de volledige projecttijdlijn vóór financiering. De CRM combineert aankoop, overdrachtsbelasting, aankoopkosten, algemene projectkosten en alle componentkasstromen.</>}
            why={<>Hiermee zie je of het vastgoedproject zelf geld oplevert en hoeveel kapitaal onderweg nodig is, zonder dat een lening de beoordeling mooier of slechter maakt.</>}
            action={<>Sla het scenario op, geef iedere positieve algemene kostenpost een timing en controleer of de investering uit de tijdlijn aansluit op de bestaande totale investering.</>}
            example={<>Aankoop € 1.000.000 in maand 0, € 120.000 projectkosten verspreid over jaar 1 en € 1.500.000 verkoopopbrengst in maand 24.</>}
            warning={<>Het nominale projectresultaat is nog niet hetzelfde als NCW, IRR of rendement op je eigen geld. Rente, lening en aflossing zijn hier nog niet opgenomen.</>}
          />
          <ScenarioUnleveredCashflowWorkspace units={props.units} components={props.components} />
        </section>
      </TabsContent>

      <TabsContent value="returns" className="mt-0 space-y-3">
        <PlainLanguageHelp
          title="Uitleg DCF en rendement"
          what={<>DCF rekent toekomstige inkomsten en uitgaven terug naar wat ze vandaag waard zijn. NCW is het bedrag dat na die terugrekening overblijft; unlevered IRR is het jaarlijkse rendement van het project zonder lening.</>}
          why={<>Geld dat je pas later ontvangt is vandaag minder waard. De disconteringsvoet verwerkt tijd, risico en jouw minimale rendementseis in de beoordeling.</>}
          action={<>Vul een jaarlijkse disconteringsvoet in en leg kort vast waar die vandaan komt. Lees een positieve NCW als “boven mijn gekozen rendementseis” en een negatieve NCW als “onder mijn gekozen rendementseis”.</>}
          example={<>Bij een jaarlijkse voet van 10% is € 121.000 die je over twee jaar ontvangt vandaag ongeveer € 100.000 waard.</>}
          warning={<>Een positieve NCW of hoge IRR is geen garantie. Controleer vooral aannames over kosten, verkoopwaarde, huur, looptijd en terminale waarde.</>}
        />
        <ScenarioDcfWorkspace units={props.units} components={props.components} />
      </TabsContent>

      <TabsContent value="financing" className="mt-0 space-y-3">
        <PlainLanguageHelp
          title="Uitleg financiering en eigen geld"
          what={<>De financieringslaag laat zien welk deel van de projectuitgaven met geleend geld wordt betaald en welk deel je zelf moet inleggen. Ook rente, afsluitkosten en aflossing worden per maand zichtbaar.</>}
          why={<>Een lening kan het rendement op je eigen geld verhogen, maar maakt het project ook gevoeliger voor rente, timing en tegenvallende opbrengsten. Daarom blijven het vastgoedrendement zonder lening en het rendement op eigen geld naast elkaar staan.</>}
          action={<>Leg per lening het maximale bedrag, de opnamemethode, rente, afsluitkosten en eindmaand vast. Controleer daarna de piekschuld, piek eigen geld, LTC en levered IRR.</>}
          example={<>Bij € 1.000.000 projectuitgaven en € 600.000 werkelijk opgenomen schuld moet vóór rente en kosten ongeveer € 400.000 uit eigen middelen komen.</>}
          warning={<>De maximale leenruimte is niet automatisch een opname. Alleen negatieve projectkasstromen worden gefinancierd. Bij het dupliceren van een scenario worden financieringsfaciliteiten bewust niet automatisch overgenomen. LTV en DSCR volgen pas zodra de waardebasis en netto exploitatiekasstroom per periode betrouwbaar zijn.</>}
        />
        <ScenarioFinancingWorkspace units={props.units} components={props.components} />
      </TabsContent>
    </Tabs>
  );
}
