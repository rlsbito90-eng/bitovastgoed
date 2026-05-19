# Module "Vastgoedrekenen" — V1 implementatieplan

Dit is een grote, modulaire toevoeging aan de bestaande CRM. Niets bestaands wordt aangepast of verwijderd. Hieronder beschrijf ik wat ik in V1 ga bouwen, in welke volgorde, en welke bewuste scope-keuzes ik maak om dit beheersbaar en kwalitatief te houden.

## Scope-keuzes voor V1

Het volledige document beschrijft de eindvisie. Voor een werkbare, stabiele V1 stel ik voor om in deze ronde te leveren:

**In V1 (deze opdracht):**
- Datamodel (alle 11 Supabase-tabellen + RLS)
- Navigatie-item "Vastgoedrekenen" + tabblad op ObjectDetailPage
- Quickscan + meerdere Scenario's per object
- Componenten/Units (mixed-use)
- Aankoopanalyse incl. automatische OVB met classificatie
- Huuranalyse (basis: huidige/markt/gecorrigeerd, BAR, factor, NOI)
- Handmatige kosten per scenario
- Totale investering + kengetallen
- Biedingsadvies (conservatief/realistisch/agressief)
- Scenariovergelijking-tabel
- Deal Snapshot bovenaan elk scenario
- Risicoanalyse incl. automatische risicoregels
- Deal score / risicoscore / complexiteitsscore / inputbetrouwbaarheid
- Automatische conclusie + vervolgstapadvies
- Weergavemodus (Begeleid/Compact/Expert) in Gebruikersbeheer
- OVB-tarieven instelbaar onder Gebruikersbeheer → "Vastgoedrekenen instellingen"
- Helpteksten/tooltips en "Hoe wordt dit berekend?" uitleg
- Begeleide SOP (12 stappen) in Begeleid-modus

**In V1 lichter (minimale variant, uitbreidbaar):**
- WWS-blok: kernvelden + indicatieve puntenberekening (vereenvoudigde formule op basis van m², WOZ, energielabel, kwaliteit) + segmentclassificatie + WWS-gecorrigeerde huur. Géén officiële WWS-calculator.
- Uitpond-/splitsanalyse: blok met `sell_off_units` en kernberekeningen (bruto opbrengst, netto, marge), zonder gevoeligheidsanalyse-grafiek.
- Transformatiescenario: extra velden binnen scenario + outputs (marge, BAR na transformatie). Geen aparte vergunningsworkflow.
- Hold-vs-Sell-vergelijking: opgenomen in de scenariovergelijkingstabel (geen separate matrix).
- Bedrijfsunits: ondersteund als component-type met de relevante velden; geen apart bedrijfsverzamel-dashboard.

**Expliciet later (niet in V1):**
- Bouwkostenbibliotheek
- DCF / IRR / cashflow-projectie meerjarig
- Officiële WWS-puntencalculator (alle 200+ regels)
- PDF-export
- Financieringsmodule
- Sensitiviteitsgrafieken
- Portefeuilleanalyse

Als je liever wilt dat ik iets uit "later" tóch in V1 meeneem, of iets uit V1 juist uitstel, hoor ik dat graag vóór ik begin.

## Architectuur

```text
src/
├── pages/
│   └── VastgoedrekenenPage.tsx          (hoofdmenu-pagina: lijst van quickscans)
├── components/vastgoedrekenen/
│   ├── VastgoedrekenenTab.tsx           (tabblad op ObjectDetailPage)
│   ├── QuickscanList.tsx
│   ├── QuickscanDetail.tsx
│   ├── ScenarioCard.tsx
│   ├── ScenarioEditor.tsx
│   ├── DealSnapshot.tsx
│   ├── ComponentenSectie.tsx
│   ├── ComponentEditor.tsx
│   ├── WwsUnitSectie.tsx
│   ├── WwsUnitEditor.tsx
│   ├── AankoopAnalyse.tsx
│   ├── HuurAnalyse.tsx
│   ├── KostenBlok.tsx
│   ├── BiedingsAdvies.tsx
│   ├── RisicoAnalyse.tsx
│   ├── SellOffSectie.tsx
│   ├── ScenarioVergelijking.tsx
│   ├── AutomatischeConclusie.tsx
│   ├── SOPStapper.tsx                   (begeleide modus)
│   ├── HelpTooltip.tsx
│   └── BerekeningUitleg.tsx
├── lib/vastgoedrekenen/
│   ├── types.ts                         (TS-types per tabel)
│   ├── ovb.ts                           (OVB-classificatie + berekening, mixed-use toerekening)
│   ├── huur.ts                          (BAR, factor, NOI, gecorrigeerde huur)
│   ├── wws.ts                           (indicatieve puntenberekening + segment)
│   ├── investering.ts                   (totale investering, prijs/m²)
│   ├── bieding.ts                       (max bid, ranges)
│   ├── scores.ts                        (deal/risico/complexiteit/betrouwbaarheid)
│   ├── conclusie.ts                     (automatische conclusie + vervolgstap)
│   ├── waarschuwingen.ts                (automatische warnings)
│   └── defaults.ts                      (standaardwaarden, ranges)
└── hooks/
    ├── useVastgoedrekenen.tsx           (data-hook per object/calculation)
    └── useVastgoedrekenenPrefs.tsx      (weergavemodus + user defaults)
```

Alle berekeningen zijn pure functions in `src/lib/vastgoedrekenen/`. UI-componenten zijn presentational. Outputs worden zowel client-side berekend (live preview tijdens invoer) als opgeslagen in `calculation_outputs` bij save (zodat scenariovergelijking en lijsten snel zijn zonder herberekening).

## Database (Supabase-migratie)

Eén migratie met de 11 tabellen exact volgens spec, plus:
- RLS aan, vier policies per tabel via `is_intern_gebruiker(auth.uid())` (zelfde patroon als bestaande tabellen).
- `user_calculation_preferences` en `feed_tokens`-stijl: select/insert/update/delete eigen rijen (`user_id = auth.uid()`).
- `vastgoedrekenen_tax_settings`: select voor intern, insert/update/delete alleen admin.
- Triggers voor `updated_at` via bestaande `update_updated_at_column()`.
- Geen FK's naar `auth.users`; wel logische FK's tussen calc-tabellen (zachte koppeling via uuid, conform projectstijl).
- Indexen op alle `*_id` koppel-kolommen en op `object_id`.
- Seed: 1 rij in `vastgoedrekenen_tax_settings` met defaults (2 / 8 / 10.4).

## Belangrijkste rekenlogica

**OVB (`lib/vastgoedrekenen/ovb.ts`):**
- Per scenario: classificatie → percentage uit settings → bedrag = grondslag × pct.
- Mixed-use: som per component. Methode `value` (componentwaarde × pct), `m2` (pro rata aankoopprijs op basis van m², dan × pct) of `manual`.
- Handmatige override per scenario en per component.

**Huur:**
- `gecorrigeerde_huur`: keuze (huidig / markt / wws / handmatig). Bij wonen + segment ≠ vrije sector standaard min(markt, wws-max).
- BAR = jaarhuur / grondslag × 100. Factor = grondslag / jaarhuur. NOI = brutohuur − leegstand − exploitatie − onderhoud − beheer − overige.

**WWS (vereenvoudigde V1):**
- Punten ≈ woonopp×1 + overige inpandig×0.75 + buiten×0.35 + WOZ-component (WOZ/m² → punten via vereenvoudigde staffel) + keuken/badkamer/verwarming/energielabel-bonussen + monument-bonus.
- Segment: ≤143 sociaal, 144–186 midden, ≥187 vrij. Max huur ≈ punten × tarief uit settings (default €6,00/punt voor V1, instelbaar).
- Duidelijk gelabeld als "indicatief" met waarschuwing dat officiële WWS-toetsing nodig is.

**Biedingsadvies:**
- Max all-in = gecorr. jaarhuur / gewenste BAR.
- Max bod = max all-in − aankoopkosten − kosten − onvoorzien − financieringskosten − veiligheidsmarge.
- Conservatief/realistisch/agressief via gewenste BAR ± stap (default 0,5%-punt).

**Scores:**
- Inputbetrouwbaarheid: % ingevulde kernvelden (vraagprijs, opp, huur, WOZ, label, bouwjaar, kosten).
- Risicoscore: weighted sum van risicoflags; ≥2 hoog → hoog.
- Complexiteit: regels op strategie/mixed-use/transformatie/splitsen/fundering/monument.
- Deal score (A/B/C/Reject): BAR-totale-investering, marge, risico, betrouwbaarheid.

## Integratie in bestaande app

- `src/App.tsx`: route `/vastgoedrekenen` toevoegen.
- `src/components/AppLayout.tsx`: nav-item "Vastgoedrekenen" (Calculator-icoon) — geplaatst tussen Objecten-groep en Acquisitie, met `groupEnd`.
- `src/pages/ObjectDetailPage.tsx`: extra tab "Vastgoedrekenen" toegevoegd na bestaande tabs. Alle bestaande tabs/secties blijven onveranderd.
- `src/pages/AdminPage.tsx`: nieuwe sectie "Vastgoedrekenen-instellingen" met OVB-tarieven (admin only) en "Vastgoedrekenen-weergave" per gebruiker.

Geen wijzigingen aan bestaande tabellen, RLS, pipelines, matching, of relatie-/object-velden.

## Huisstijl

Bestaande tokens uit `index.css` worden hergebruikt (de huisstijlkleuren navy/goud/wit zitten daar al). Geen nieuwe kleuren hardcoded; alleen semantische tokens en bestaande badge/card-componenten.

## Volgorde van implementatie

1. Supabase-migratie (11 tabellen + RLS + seed defaults).
2. Types + pure rekenfuncties in `lib/vastgoedrekenen/` met basistests.
3. Data-hook + preferences-hook.
4. UI-bouwstenen: HelpTooltip, BerekeningUitleg, SOPStapper.
5. Scenario-editor met alle blokken (aankoop, huur, componenten, WWS, kosten, biedingsadvies, risico, conclusie).
6. Quickscan-detail + scenariovergelijking + Deal Snapshot.
7. Tabblad op ObjectDetailPage + hoofdmenu-pagina.
8. AdminPage-uitbreiding (OVB-settings + weergavemodus).
9. Sanity-pass: build schoon, responsive check mobiel/desktop, waarschuwingen valideren.

Ben je akkoord met deze scope en aanpak? Bij akkoord begin ik bij stap 1 (migratie).
