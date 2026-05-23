
# Beslisrapport — Object bewerken & Objectdetailpagina

Bron: `.lovable/plan.md` (inventarisatie). Doel: concreet verbeteradvies, geen code-wijzigingen.

---

## 1. Samenvatting belangrijkste bevindingen

### Wat is nu goed
- **Brede dekking**: vrijwel alle relevante vastgoedvelden zijn aanwezig in de modal en consequent in `ObjectVastgoed`.
- **Sterke modulekoppeling**: vraagprijs, oppervlakte, bouwjaar, type, plaats/provincie, verhuurstatus en energielabel worden hergebruikt in matching, PDF-brochure, dossier, Vastgoedrekenen en referentieanalyse.
- **Tabstructuur** (9 tabs) maakt de modal hanteerbaar; de Pand-tab is goed gegroepeerd rond oppervlakten en bouw.
- **Anonimiteit-laag** (anoniem / publieke naam / publieke regio) is consequent doorgevoerd tot in PDF en hero.
- **Auto-suggesties** voor BAR/NAR/factor en huur/m² werken in de modal — fundament is er.
- **Archiveer-flow** bij status `verkocht`/`ingetrokken`/`afgevallen` is correct losgekoppeld.

### Waar zit overlap
- **Legacy duplicaten**: `type` ↔ `propertyTypeId`, `subcategorie`/`subcategorieId` ↔ `propertySubtypeIds`, `energielabel` ↔ `energielabelV2`, `onderhoudsstaat` ↔ `onderhoudsstaatNiveau`. Vier velden bestaan in twee vormen → kans op divergentie.
- **Twee contactblokken**: `verkoperNaam/...` (Verkoper-tab) én `contactNaam/...` (IM-tab). Op detail twee aparte cards.
- **`aanbiedingswijze` en `bron`** worden 2× getoond in het Overzichtsblok op de detailpagina.
- **`marktwaardeIndicatie`** (handmatig) vs. mediaan uit referentieanalyse — twee bronnen, niet aan elkaar gekoppeld in UI.
- **`aantalHuurders` / `leegstandPct`** worden handmatig ingevoerd terwijl `huurders`-tabel ze kan afleiden.

### Waar zit inconsistentie
- **Maandhuur** is alleen UI-state in de modal, niet opgeslagen, niet zichtbaar op detail. Gebruiker mist de waarde achteraf.
- **Rendementen handmatig opgeslagen** kunnen afwijken van automatisch berekende waarden in matching of Vastgoedrekenen — twee "waarheden".
- **`huurPerM2`** wordt soms opgeslagen, soms afgeleid; bij oppervlakte-wijziging niet automatisch geherwaardeerd.
- **Tab IM** bevat zowel commerciële teksten als technische data (oppervlaktenPerVerdieping, marktwaarde, technische staat) — gemengde scopes.
- **`wozPeildatum`** wordt als jaar ingevoerd, opgeslagen als `YYYY-01-01`, soms volledig uitgeschreven in PDF.

### Velden ingevoerd maar niet goed zichtbaar
- `prijsindicatie` — alleen onder Financieel; niet als fallback in de hero wanneer vraagprijs ontbreekt.
- `subcategorie` (legacy free-text) — nergens leesbaar.
- `energielabel` (legacy) en `onderhoudsstaat` (legacy) — alleen fallback, niet bewerkbaar.
- `wozPeildatum` — alleen hint bij WOZ-tile.
- `imSectiesZichtbaar` — getoond als platte regel "Verborgen IM-secties", niet erg leesbaar.
- Maandhuur (afgeleid) — niet getoond op detail.

### Velden getoond maar niet logisch gekoppeld
- `documentenBeschikbaar` — getoond op detail, niet bewerkbaar in modal.
- `markeerAlsReferentie` — toggle in modal-header maar niet opgeslagen.
- `financieleScenarios` — staan onder Financieel maar overlappen functioneel met Vastgoedrekenen.
- `marktwaardeIndicatie` — KPI-tegel, maar geen visuele relatie met referentieanalyse-mediaan.
- `aantalHuurders` — KPI, maar `huurders`-lijst eronder geeft een ander getal als beide bestaan.

---

## 2. Veldenmatrix

Legenda module: **V**=Vastgoedrekenen · **M**=Matching · **D**=Dossier · **R**=Referentieanalyse · **P**=PDF/Brochure · **F**=Filters/Overzicht.
Prio: H=Hoog · Mi=Middel · L=Laag.

### Identificatie & status

| Veld | Locatie nu | Detail nu | Modules | Advies | Prio |
|---|---|---|---|---|---|
| titel | Algemeen | Hero | P, F | Behouden (verplicht) | H |
| internReferentienummer | Algemeen | Overzicht | P, F | Behouden, auto-suggestie blijft | Mi |
| status | Algemeen | Badge + Overzicht | D, F | Behouden | H |
| aanbiedingswijze | Algemeen | **2×** | P, F | Behouden, **dedupliceren detail** | H |
| bron | Algemeen | **2×** | R, F | Behouden, **dedupliceren detail** | Mi |
| exclusief | Algemeen | Overzicht | P, F | Behouden | L |
| anoniem | Algemeen | Identificatie + alle outputs | P | Behouden | H |
| publiekeNaam / publiekeRegio | Algemeen | Identificatie / Locatie | P | Behouden, **alleen tonen indien gevuld** | Mi |

### Locatie

| Veld | Locatie nu | Detail | Modules | Advies | Prio |
|---|---|---|---|---|---|
| adres / postcode / plaats / provincie | Algemeen | Locatie-blok | M, R, P, D, F | Behouden; plaats+provincie hard verplicht maken in form | H |

### Classificatie

| Veld | Locatie nu | Detail | Modules | Advies | Prio |
|---|---|---|---|---|---|
| propertyTypeId | Algemeen | Badge | M, V, P, F | Behouden — **leidend** | H |
| propertySubtypeIds | Algemeen | Badge | M | Behouden | Mi |
| dealTypeIds | Algemeen | Badge | M | Behouden | Mi |
| type (AssetClass legacy) | auto-sync | Badge | M, P | **Behouden als afgeleid**, niet meer bewerkbaar tonen | Mi |
| subcategorie (legacy) | — | — | — | **Archiveren** in UI; alleen lezen op detail indien aanwezig | L |
| subcategorieId (legacy) | — | — | — | **Archiveren** in UI | L |
| huidigGebruik | Algemeen | Overzicht | P | **Verplaatsen** naar Verhuur of Pand | Mi |
| beschikbaarVanaf | Algemeen | Overzicht | F | Behouden | L |

### Portefeuille

| Veld | Locatie nu | Detail | Advies | Prio |
|---|---|---|---|---|
| isPortefeuille | Algemeen | Badge | Behouden | Mi |
| parentObjectId | Algemeen | Link | Behouden | Mi |

### Financieel

| Veld | Locatie nu | Detail | Modules | Advies | Prio |
|---|---|---|---|---|---|
| vraagprijs | Financieel | Hero + KPI | V, M, D, P, R, F | Behouden | H |
| prijsindicatie | Financieel | Toelichting | P | Behouden; **fallback in Hero tonen** indien geen vraagprijs | Mi |
| huurinkomsten (jaar) | Financieel | Hero + KPI | V, D, P, F | Behouden | H |
| (maandhuur) | Financieel UI-only | — | — | **Tonen op detail** als afgeleide KPI "Huur/mnd"; niet opslaan | Mi |
| huurPerM2 | Financieel | KPI | R, P | **Volledig auto** met override-toggle | H |
| servicekostenJaar | Financieel | KPI | P, V | Behouden | Mi |
| noi | Financieel | KPI | V, P | **Auto** (huur − servicekosten) met override | H |
| brutoAanvangsrendement | Financieel | KPI | M, P, D | **Auto** met override | H |
| nettoAanvangsrendement | Financieel | KPI | P | **Auto** met override | Mi |
| (kapitalisatiefactor) | Financieel afgeleid | KPI | P | Behouden auto | Mi |
| wozWaarde | Financieel | KPI | V, P, D | Behouden | Mi |
| wozPeildatum | Financieel (jaar) | Hint | P | Behouden, **als losse jaar-tag tonen** | L |
| taxatiewaarde / taxatiedatum | Financieel | KPI | P | Behouden | Mi |
| marktwaardeIndicatie / marktwaardeBron | IM-tab | KPI | P, R | **Verplaatsen** naar Financieel/Waarderingen | Mi |
| financieleScenarios (3 stuks) | IM-tab | Tabel onder Financieel | P | **Verplaatsen** naar Vastgoedrekenen (of laten en label "snapshot") | Mi |

### Verhuur

| Veld | Locatie nu | Detail | Modules | Advies | Prio |
|---|---|---|---|---|---|
| verhuurStatus | Verhuur | KPI/badge | M, R, P, F | Behouden | H |
| aantalHuurders | Verhuur | KPI | F | **Auto** uit huurders-tabel, manuele override alleen bij 0 rijen | Mi |
| leegstandPct | Verhuur | KPI | F | **Auto** uit huurders×m² | Mi |
| huurders[] | aparte tabel | sub-card onder Financieel | V, P | Behouden | H |

### Oppervlakten & bouw

| Veld | Locatie nu | Detail | Modules | Advies | Prio |
|---|---|---|---|---|---|
| oppervlakte | Pand | Hero KPI | M, V, D, P, R, F | Behouden | H |
| oppervlakteVvo / Bvo / Gbo | Pand | NEN-blok | V, P | Behouden | Mi |
| perceelOppervlakte | Pand | NEN-blok | P, R | Behouden | Mi |
| oppervlaktenPerVerdieping[] | IM-tab | tabel | P | **Verplaatsen** naar Pand/Oppervlakten | Mi |
| bouwjaar | Pand | KPI | M, V, D, P, R, F | Behouden | H |
| energielabelV2 | Pand | KPI | M, V, D, P, R | Behouden | H |
| energielabel (legacy) | — | fallback | — | **Archiveren** in UI | L |
| aantalVerdiepingen / aantalUnits | Pand | KPI | P | Behouden | Mi |

### Onderhoud

| Veld | Locatie nu | Detail | Modules | Advies | Prio |
|---|---|---|---|---|---|
| onderhoudsstaatNiveau | Pand | KPI | P, R | Behouden | Mi |
| onderhoudsstaat (legacy) | — | fallback | — | **Archiveren** in UI | L |
| recenteInvesteringen / achterstalligOnderhoud | Pand | sub-card | P | Behouden | Mi |
| asbestinventarisatieAanwezig | Pand | flag | — | Behouden | L |
| technischeStaatOmschrijving | IM-tab | sub-card | P | **Verplaatsen** naar Pand/Onderhoud | Mi |

### Potentie

| Veld | Locatie nu | Detail | Advies | Prio |
|---|---|---|---|---|
| ontwikkelPotentie / transformatiePotentie | Pand | badges | Behouden, **verplaatsen** naar eigen tab "Potentie" | Mi |
| potentieOmschrijving / Strategie / OnderbouwingStatus | Pand | Potentie-blok | Behouden, eigen tab | Mi |
| potentieExtraM2 / potentieExtraUnits | Pand | KPI (huidig/extra/totaal) | Behouden, eigen tab | Mi |
| potentieBron / Afhankelijkheden | Pand | Potentie-blok | Behouden, eigen tab | L |

### Juridisch

| Veld | Locatie nu | Detail | Advies | Prio |
|---|---|---|---|---|
| eigendomssituatie | Juridisch | sub-card | Behouden | H |
| erfpachtinformatie | Juridisch | sub-card | Behouden | Mi |
| bestemmingsinformatie | Juridisch | sub-card | Behouden | Mi |
| kadastraleGemeente/Sectie/Nummer | Juridisch | sub-card | Behouden | L |

### Verkoper / contact

| Veld | Locatie nu | Detail | Advies | Prio |
|---|---|---|---|---|
| verkoperNaam/Rol/Via/Tel/Email | Verkoper | sub-card | Behouden | H |
| verkoopmotivatie | Verkoper | sub-card | Behouden | Mi |
| contactNaam/Functie/Tel/Email | IM-tab | sub-card | **Samenvoegen** met Verkoper-tab als "Contacten" met rol-veld | Mi |

### Thesis / IM / dossier

| Veld | Locatie nu | Detail | Advies | Prio |
|---|---|---|---|---|
| samenvatting | Thesis | Overzicht | Behouden | H |
| investeringsthese | Thesis | Overzicht | Behouden | H |
| onderscheidendeKenmerken / risicos / opmerkingen | Thesis | Overzicht | Behouden | Mi |
| interneOpmerkingen | Thesis | warn-card | Behouden | Mi |
| propositie / objectomschrijving / locatieOmschrijving | IM-tab | sub-card | Behouden | Mi |
| procesVoorwaarden / dataroomUrl | IM-tab | sub-card | **Verplaatsen** naar Dossier & aanbieding | Mi |
| documentatieStatus (map) | IM-tab | badges | **Verplaatsen** naar Dossier-module (afleiden uit catalog) | Mi |
| imSectiesZichtbaar (map) | IM-tab | "Verborgen IM-secties" | Behouden, **leesbaarder weergeven** of verplaatsen naar PDF-instellingen | L |
| referentieanalyseZichtbaar | Algemeen/Weergave | stuurt sectie | **Verplaatsen** naar één "Zichtbaarheid" blok onder Dossier | L |
| documentenBeschikbaar | — | "Ja/Nee" | **Vervangen** door dossier-readiness derived | L |
| markeerAlsReferentie | header (UI-only) | — | Beslissen: schrappen of persisteren als kolom | L |

---

## 3. Aanbevolen structuur Object bewerken

Voorstel: **8 tabs** (van 9), scopes scherper.

1. **Algemeen** — Identificatie · Anonimiteit · Locatie · Classificatie · Portefeuille · Bron.
2. **Financieel** — Prijs · Huur & rendement · Waarderingen · **Marktwaarde-indicatie** (verplaatst uit IM).
3. **Verhuur** — Status · (auto) aantalHuurders & leegstand · Huurders-panel · `huidigGebruik`.
4. **Pand** — Oppervlakten (incl. **Per verdieping**) · Bouw · Onderhoud (incl. **technische staat omschrijving**) · asbest-flag.
5. **Potentie** *(nieuw losgetrokken uit Pand)* — Toggles, omschrijving, strategie, extra m²/units, bron, risico's.
6. **Juridisch** — Eigendom · Erfpacht · Bestemming · Kadaster.
7. **Contacten** *(samenvoeging Verkoper + IM-contact)* — Verkoper · Contactpersoon object · Verkoopmotivatie.
8. **Aanbieding & dossier** *(was Thesis + IM)* — Samenvatting · Investeringsthese · Risico's · Propositie · Object-/locatie-omschrijving · Procesvoorwaarden · Dataroom · Document-/IM-zichtbaarheid.

> **Tab Media** blijft beschikbaar als sub-tab onder Aanbieding & dossier (foto's + documenten) — anders worden het 9 tabs.

---

## 4. Aanbevolen structuur Objectdetailpagina

Sectievolgorde (sectiebar):

1. **Cockpit / Next action / Quick actions** (mobiel + desktop).
2. **Identificatie & locatie** — titel, ref, status, badges, adres-chip, klikbare maps-link.
3. **Classificatie** — type, subtypes, dealtypes, huidig gebruik, beschikbaarheid.
4. **Financieel** — KPI-strip (vraagprijs of prijsindicatie als fallback, BAR, NAR, factor, huur/jr, **huur/mnd** afgeleid, NOI, €/m², huur/m², WOZ, taxatie, marktwaarde-indicatie).
5. **Verhuur** — status, aantal huurders (auto), leegstand, huurders-tabel, WALT/WALB.
6. **Pand & technische staat** — oppervlakten + per verdieping, bouw, energielabel, onderhoud, recente investeringen, achterstallig onderhoud, technische staat omschrijving, asbest.
7. **Potentie & mogelijkheden** — toggles, strategie, extra m²/units, onderbouwing-status, bron, risico's.
8. **Juridisch & kadastraal** — eigendom, erfpacht, bestemming, kadaster.
9. **Contacten** — verkoper + object-contact (één blok, twee kolommen).
10. **Aanbieding & proces** — propositie, object-/locatie-omschrijving, technische staat (lang), procesvoorwaarden, dataroom, IM-zichtbaarheid.
11. **Dossierstatus** — readiness (uit catalog), documentatie-overzicht (derived), foto's, documenten.
12. **Referentieanalyse** — alleen indien aan.
13. **Vastgoedrekenen** — scenario's en max-bieding.
14. **Biedingen / Pipeline** — bestaand.

Detail-regels:
- **Dedupliceer** `aanbiedingswijze` en `bron` (1× tonen).
- KPI-strips bovenaan elk blok, met **"Huur/mnd"** auto-afgeleid.
- "Marktwaarde-indicatie" + mediaan referentieanalyse zichtbaar **naast elkaar** met label-bron.
- Alles wat leeg is: **collapsen of weglaten** (niet "—" tonen waar geen waarde verwacht wordt).

---

## 5. Velden die uit Object bewerken kunnen

| Veld(en) | Verplaatsen naar | Reden |
|---|---|---|
| `financieleScenarios` (huidig/marktconform/naRenovatie) | **Vastgoedrekenen** | Echte scenario-engine bestaat al; snapshot wordt redundant. |
| `aantalHuurders`, `leegstandPct` | **Verhuurmodule (derived)** | Afleidbaar uit `huurders`. |
| `documentatieStatus`, `documentenBeschikbaar` | **Dossier & aanbieding** | Dossier-catalog kent al per-doc status. |
| `procesVoorwaarden`, `dataroomUrl` | **Dossier & aanbieding** | Hoort bij dealflow/aanbiedingsfase, niet bij object-master. |
| `markeerAlsReferentie` (toggle) | **Referentieanalyse** (of schrappen) | Nu UI-only — beslissing nodig. |
| `imSectiesZichtbaar` | **PDF-instellingen / aanbieding** | Stuurt outputs, niet object-data. |
| `pipeline*`, `taken`, `biedingen` | (al apart) | Reeds elders beheerd — geen actie. |
| Verplaatsing binnen modal (geen module-shift): `marktwaardeIndicatie/Bron`, `technischeStaatOmschrijving`, `oppervlaktenPerVerdieping` | Naar Financieel / Pand | Scope-zuivering. |

---

## 6. Automatische berekeningen

| Veld | Advies | Formule / regel | Override mogelijk |
|---|---|---|---|
| Maandhuur | **Auto-afleiden** uit jaarhuur (÷12), tonen op detail | `huurinkomsten / 12` | Nee — alleen weergave |
| Jaarhuur | Handmatig (brondata) | — | Ja |
| Huur per m² | **Auto** uit jaarhuur ÷ (Gbo of VVO of totaal) | bidirectioneel toegestaan in modal | Ja, met expliciete toggle |
| BAR | **Auto** = jaarhuur / vraagprijs × 100 | Toon "auto" badge | Ja, met override |
| NAR | **Auto** = NOI / vraagprijs × 100 | Idem | Ja |
| Kapitalisatiefactor | **Auto** = vraagprijs / jaarhuur | Read-only KPI | Nee |
| NOI | **Auto** = jaarhuur − servicekosten (− exploitatielast indien veld bestaat) | Indicatief | Ja |
| €/m² (prijs) | **Auto** = vraagprijs / Gbo (of VVO, dan oppervlakte) | Toon bron-basis | Nee |
| Potentie totaal m² | **Auto** = oppervlakte + extraM² | Read-only | Nee |
| Potentie totaal units | **Auto** = aantalUnits + extraUnits | Read-only | Nee |
| WOZ-peildatum | **Handmatig** (jaar-input), opslaan als `YYYY-01-01`, **uniform tonen als jaar** | Geen formule | n.v.t. |
| Aantal huurders / leegstand% | **Auto** uit huurders | Handmatig alleen als geen rijen | Ja |
| Marktwaarde-indicatie | **Handmatig** (bewust naast referentie-mediaan) | — | n.v.t. |

Regel: handmatige overschrijving moet visueel zichtbaar zijn (badge "handmatig"), zodat afwijking van de berekende waarde controleerbaar is.

---

## 7. Dagelijks gebruik

### Must-have (bovenaan + sticky cockpit)
titel · status · plaats/provincie · propertyType · vraagprijs (of prijsindicatie) · huurinkomsten · oppervlakte · bouwjaar · verhuurStatus · energielabelV2 · BAR · €/m² · next action.

### Handig maar secundair (KPI/blok-niveau)
NAR · factor · huur/m² · NOI · WOZ · taxatie · marktwaarde · servicekosten · perceel · aantalUnits/verdiepingen · onderhoudsstaatNiveau · aantalHuurders (auto) · WALT/WALB.

### Alleen tonen indien gevuld
publiekeNaam · publiekeRegio · prijsindicatie (anders niet) · huidigGebruik · recenteInvesteringen · achterstalligOnderhoud · asbest · alle potentievelden · kadaster-detail · verkoopmotivatie · procesvoorwaarden · dataroomUrl · interneOpmerkingen · marktwaardeBron · imSectiesZichtbaar.

### Alleen nodig in bewerkmodal (niet prominenten op detail)
internReferentienummer (klein in header) · documentatieStatus (in dossier-tab) · imSectiesZichtbaar · referentieanalyseZichtbaar · `type`/`subcategorie`/`energielabel`/`onderhoudsstaat` (legacy, alleen voor migratie).

---

## 8. Concrete vervolgstappen

### Fase 1 — Quick wins (zonder schemawijziging)
1. Dedupliceer `aanbiedingswijze` en `bron` op detailpagina.
2. Toon `prijsindicatie` als fallback in Hero-KPI "Vraagprijs".
3. Toon afgeleide **"Huur/mnd"** KPI op detail (puur afgeleid).
4. Verberg legacy-velden (`type`/`subcategorie`/`energielabel`/`onderhoudsstaat`) in de modal-UI; behoud onder de motorkap.
5. Pas "Alleen tonen indien gevuld"-regel consistent toe (geen lege "—" op secundaire velden).
6. Voeg "auto" / "handmatig" badges toe bij BAR, NAR, huur/m², NOI in KPI-strip.
7. Verbeter weergave `imSectiesZichtbaar` (chip-lijst) of verberg helemaal.

### Fase 2 — Herstructurering UI/detailpagina
1. Modal-tabs herindelen: **Potentie** loskoppelen, **Contacten** samenvoegen, **IM-tab** opsplitsen.
2. Detail-sectievolgorde gelijktrekken met §4 (sectiebar updaten, anchors herzien).
3. Verplaats binnen modal: `marktwaardeIndicatie/Bron` → Financieel, `oppervlaktenPerVerdieping` → Pand, `technischeStaatOmschrijving` → Pand/Onderhoud, `procesVoorwaarden`+`dataroomUrl`+`documentatieStatus` → Aanbieding & dossier.
4. KPI-strips uniformeren (zelfde tile-component, zelfde volgorde) over alle blokken.

### Fase 3 — Schema / datamodel
1. Maak rendementen (BAR/NAR/factor/NOI/huurPerM2) **derived columns** of view; bewaar handmatige override apart (`bar_manual_override` etc.).
2. Maak `aantalHuurders` en `leegstandPct` derived uit `huurders`; behoud override-veld bij 0 rijen.
3. Beslis legacy-migratie: `type` → afgeleid van `propertyTypeId`; verwijder `subcategorie`/`energielabel`/`onderhoudsstaat` strings uit edit-paden.
4. Beslis lot van `markeerAlsReferentie`: kolom toevoegen of UI-toggle verwijderen.
5. Beslis lot van `documentenBeschikbaar`: derived uit dossier-readiness.

### Fase 4 — Module-koppeling
1. **Vastgoedrekenen**: importeer `financieleScenarios` éénmalig als startwaarde; daarna scenario-engine als enige bron.
2. **Matching**: schakel matching over op derived rendementen (consistentie met detail).
3. **Dossier**: koppel `documentatieStatus` aan catalog (één bron van waarheid voor readiness).
4. **PDF/brochure**: stel `imSectiesZichtbaar` in via dedicated PDF-instellingenpaneel ipv object-master.
5. **Referentieanalyse**: visualiseer relatie tussen handmatige `marktwaardeIndicatie` en mediaan (delta-chip).
6. **Centrale field-map** documenteren (object-veld → modal-tab → detail-blok → modules) voor toekomstige audits.

---

## Bijlage — Beslissingen die nu gemaakt moeten worden

1. Worden rendementen **derived (auto)** met override of blijven ze handmatige snapshots?
2. Worden `aantalHuurders`/`leegstandPct` **derived** of blijft het handmatig?
3. Wat doen we met legacy-velden: **migreren** (data overzetten + kolommen droppen) of **bevriezen** (alleen lezen)?
4. `markeerAlsReferentie`: **persisteren** of **verwijderen**?
5. `financieleScenarios`: **verplaatsen** naar Vastgoedrekenen of houden als snapshot?
6. `documentenBeschikbaar`: **vervangen** door dossier-readiness derived of behouden als toggle?

Na akkoord op deze 6 keuzes kan Fase 1+2 risicovrij uitgevoerd worden; Fase 3+4 volgen daarna.

