# Vastgoedrekenen — componentallocatie en timing Fase 4A

## Doel

Deze fase legt het additieve opslag- en domeincontract vast dat nodig is om binnen één scenario per component:

- volledig of gedeeltelijk aan te houden;
- volledig of gedeeltelijk te verkopen;
- ontwikkeling en oplevering in de tijd te plaatsen;
- huurstart, verkoopontvangst en een eventuele latere exit vast te leggen.

De fase activeert nog geen DCF-, IRR- of financieringsberekening en verandert de bestaande scenariowaarde niet.

## Canoniek model per `sell_off_units`-regel

| Veld | Betekenis |
|---|---|
| `allocation_percentage` | Aandeel van het gekoppelde component dat deze regel vertegenwoordigt |
| `development_start_month` | Start fysieke ingreep, in maanden na de Quickscan-peildatum |
| `development_end_month` | Oplevering/einde fysieke ingreep |
| `rent_start_month` | Start van huurkasstromen |
| `expected_sale_period_months` | Maand waarin verkoopopbrengst wordt ontvangen |
| `hold_exit_month` | Optionele terminale verkoop van het aangehouden deel |
| `allocation_timing_schema_version` | Versie van het expliciet opgeslagen contract |

`expected_sale_period_months` bestond al. Fase 4A geeft dit veld één expliciete betekenis en voorkomt daarmee een tweede, parallel verkoopmaandveld.

## Gemengde strategie

Een component kan over meerdere strategieregels worden verdeeld. Bijvoorbeeld:

| Regel | Allocatie | Strategie | Timing |
|---|---:|---|---|
| Woningen verkoop | 60% | Verkopen | verkoop in maand 18 |
| Woningen aanhouden | 40% | Aanhouden | huurstart maand 12, exit maand 60 |

Alle regels met hetzelfde `component_id` moeten gezamenlijk 100% vormen. Overallocatie blokkeert toekomstige periodieke kasstroomberekeningen; onderallocatie blijft zichtbaar als onverdeeld programma.

## Legacycompatibiliteit

Bestaande rijen blijven onaangeraakt:

- `allocation_percentage = null` wordt read-only als 100% geïnterpreteerd;
- er vindt geen backfill plaats;
- timingvelden blijven `null` totdat de gebruiker deze expliciet opslaat;
- `computeScenario()` en de huidige componentwaardering blijven ongewijzigd.

## Voorbereide gebeurtenissen

De pure domeinmodule kan de volgende gebeurtenissen leveren:

- `development_start`;
- `development_end`;
- `rent_start`;
- `sale_receipt`;
- `terminal_exit`.

Deze gebeurtenissen worden in een volgende fase gebruikt om periodieke vastgoedkasstromen op te bouwen. Pas daarna worden DCF/NPV, unlevered IRR en vervolgens de financieringslaag aangesloten.

## Volgende fase

Fase 4B maakt het contract bedienbaar in de CRM:

1. allocatie en timing tonen in de componentstrategietabel;
2. een bestaande strategieregel veilig kunnen splitsen;
3. validatie tegen de Quickscan-horizon;
4. geen automatische wijziging van de huidige rekenuitkomst;
5. pas na afzonderlijke validatie allocatiegewogen waardering activeren.
