
# Inventarisatie Object bewerken & Objectdetail

Doel: alleen analyseren, niets wijzigen. Bron: `ObjectFormDialog.tsx`, `ObjectDetailPage.tsx`, `data/mock-data.ts` (`ObjectVastgoed`), dossier-catalogus, matching-engine, brochure-PDF en Vastgoedrekenen-tab.

---

## 1. Overzicht per tab

### Tab 1 — Algemeen
Secties: Identificatie · Anonimiteit · Locatie · Classificatie · Portefeuille & bron · Weergave.
- Identificatie: titel*, intern referentienummer, objectstatus, aanbiedingswijze.
- Anonimiteit: anoniem (checkbox), publieke naam, publieke regio.
- Locatie: adres, postcode, plaats, provincie.
- Classificatie: type vastgoed (nieuwe taxonomie), subcategorieën (multi), dealtypes (multi), beschikbaar vanaf, huidig gebruik.
- Portefeuille & bron: isPortefeuille, exclusief, parentObjectId, bron.
- Weergave: referentieanalyseZichtbaar (toggle).

### Tab 2 — Financieel
Secties: Prijs · Huur & rendement · Waarderingen.
- Prijs: vraagprijs, prijsindicatie (tekst).
- Huur & rendement: huurinkomsten (jaar), maandhuur (afgeleid/twee-weg), huurPerM2 (auto of manueel), servicekostenJaar, noi, brutoAanvangsrendement (auto), nettoAanvangsrendement (auto), kapitalisatiefactor (read-only auto).
- Waarderingen: wozWaarde, wozPeildatum (jaar → 1 jan), taxatiewaarde, taxatiedatum (volledige datum).

### Tab 3 — Verhuur
- Verhuurstatus (verhuurd/gedeeltelijk/leeg), aantalHuurders, leegstandPct.
- HuurdersPanel (aparte tabel `huurders`, niet in `objects`).

### Tab 4 — Pand
Secties: Oppervlakten (NEN 2580) · Bouw · Onderhoud · Potentie.
- Oppervlakten: oppervlakte (totaal), oppervlakteVvo, oppervlakteBvo, oppervlakteGbo, perceelOppervlakte.
- Bouw: bouwjaar, energielabelV2, aantalVerdiepingen, aantalUnits.
- Onderhoud: onderhoudsstaatNiveau, asbestinventarisatieAanwezig, recenteInvesteringen, achterstalligOnderhoud.
- Potentie: ontwikkelPotentie + transformatiePotentie (toggles). Bij aan → potentieOmschrijving, potentieStrategie, potentieOnderbouwingStatus, potentieExtraM2, potentieExtraUnits, totalen (auto), potentieBron, potentieAfhankelijkheden.

### Tab 5 — Juridisch
- Eigendomssituatie, erfpachtinformatie, bestemmingsinformatie.
- Kadaster: gemeente, sectie, perceel/kadastraal nummer.

### Tab 6 — Verkoper
- verkoperNaam, verkoperRol, verkoperVia, verkoperTelefoon, verkoperEmail, verkoopmotivatie.

### Tab 7 — Thesis
- samenvatting, investeringsthese, onderscheidendeKenmerken, risicos, opmerkingen, interneOpmerkingen.

### Tab 8 — IM & document
- propositie, objectomschrijving, locatieOmschrijving, technischeStaatOmschrijving, oppervlaktenPerVerdieping (lijst), financieleScenarios (huidig/marktconform/naRenovatie), marktwaardeIndicatie, marktwaardeBron, procesVoorwaarden, dataroomUrl, contactNaam/Functie/Telefoon/Email, documentatieStatus (per documenttype), imSectiesZichtbaar (toggle per IM-sectie).

### Tab 9 — Media
- Foto's (FotosPanel) en documenten (DocumentenPanel). Alleen na 1× opslaan.

### Modal-niveau (over alle tabs)
- Header-toggle "Ook bruikbaar als referentieobject" → UI-only, niet opgeslagen.
- Footer: status-wijziging naar `verkocht`/`ingetrokken`/`afgevallen` triggert ArchiveerDialog (isArchived, archivedAt, archivedReason, archivedNote).

---

## 2. Veldentabel (`ObjectVastgoed`)

Kolomlegenda: **Veld** · type · verplicht · auto? · in detail? · gebruik elders (M = matching, V = vastgoedrekenen, D = dossier, P = PDF/brochure, R = referentie-analyse, K = KPI-strip).

### Identificatie / status
- `titel` — tekst — **verplicht** — manueel — detail: hero — P,K.
- `internReferentienummer` — tekst — opt — auto bij nieuw (`genereerRefnummer`) maar overschrijfbaar — detail: Overzicht/Identificatie — P.
- `status` — select (7 waardes) — verplicht (default `te_beoordelen`) — manueel — detail: badge & Identificatie — D (triggert archief), filters.
- `aanbiedingswijze` — select — opt (default `off_market`) — manueel — detail: ja, 2× getoond (zie dubbelingen).
- `bron` — tekst — opt — manueel — detail: 2× (zie dubbelingen) — R (nuttig).
- `exclusief` — toggle — opt — manueel — detail: ja — P.
- `datumToegevoegd`, `updatedAt`, `softDeletedAt`, `isArchived`, `archivedAt`, `archivedReason`, `archivedNote` — systeem.

### Anonimiteit
- `anoniem` — toggle — default **true** — manueel — detail: Identificatie + P (publieke fallback).
- `publiekeNaam` — tekst — opt — manueel — detail: ja — P.
- `publiekeRegio` — tekst — opt — manueel — detail: Locatie — P.

### Locatie
- `adres`, `postcode`, `plaats`*, `provincie`* — tekst/select — `plaats` en `provincie` verplicht in type, niet gevalideerd in form — manueel — detail: Locatie — M (regio), R (sterk), P, D (auto-veld `adres`).

### Classificatie (taxonomie)
- `propertyTypeId` — fk select — opt (sterk aangeraden) — manueel; synct `type` (legacy AssetClass) — detail: ja — **M (sleutelveld)**.
- `propertySubtypeIds` — multi-select — opt — manueel — detail: ja — M.
- `dealTypeIds` — multi-select — opt — manueel — detail: ja — M.
- `type` (AssetClass legacy) — afgeleid van propertyType — detail: badges — M (fallback), P.
- `subcategorie`, `subcategorieId` — **legacy** — niet meer in form-UI direct, behalve via taxonomie-keten — detail: gebruikt via `useSubcategorieen`.
- `huidigGebruik` — tekst — opt — manueel — detail: Overzicht — P.
- `beschikbaarVanaf` — datum — opt — manueel — detail: ja.

### Portefeuille
- `isPortefeuille` — toggle — manueel — detail: ja.
- `parentObjectId` — select — manueel — detail: link naar parent.

### Financieel
- `vraagprijs` — bedrag — opt — manueel — detail: hero KPI + Financieel — **M (prijsfilter), V, D, P, R, K**.
- `prijsindicatie` — tekst — opt — manueel — detail: Financieel — P (fallback).
- `huurinkomsten` (jaar) — bedrag — opt — manueel — detail: KPI/hero/financieel — V, D, P, K.
- *(maandhuur)* — UI-only state, NIET opgeslagen — afgeleid jaar÷12.
- `huurPerM2` — bedrag — opt — auto uit jaarhuur÷m² óf manueel — detail: KPI strip — R (nuttig), P (fallback berekening), K.
- `servicekostenJaar` — bedrag — opt — manueel — detail: ja — P.
- `noi` — bedrag — opt — manueel — detail: ja — P.
- `brutoAanvangsrendement` — % — opt — auto-suggestie, opslag handmatig — detail: KPI — D, P, K.
- `nettoAanvangsrendement` — % — opt — auto-suggestie, opslag handmatig — detail: ja — P.
- *kapitalisatiefactor* — niet opgeslagen, alleen weergave (vraagprijs÷jaarhuur) — detail: KPI.
- `wozWaarde` — bedrag — opt — manueel — detail: ja — V (apart prop), P, D.
- `wozPeildatum` — datum (opgeslagen 1-jan) — opt — manueel jaar-input — detail: hint bij WOZ-tile — P.
- `taxatiewaarde`, `taxatiedatum` — bedrag/datum — opt — manueel — detail: ja — P.
- `marktwaardeIndicatie`, `marktwaardeBron` — bedrag/tekst — opt — manueel — detail: KPI Financieel — P, R (fallback mediaan).

### Verhuur
- `verhuurStatus` — select — verplicht (default `leeg`) — manueel — detail: ja — **M**, R (nuttig), P.
- `aantalHuurders` — nummer — opt — manueel (zou afgeleid moeten zijn van HuurdersPanel) — detail: ja.
- `leegstandPct` — % — opt — manueel — detail: ja.
- *(huurders zelf)* — aparte tabel; getoond als sub-card onder Financieel.

### Oppervlakten
- `oppervlakte` — m² — opt — manueel — detail: hero KPI — **M, V, D, P**, R (sterk).
- `oppervlakteVvo`, `oppervlakteBvo`, `oppervlakteGbo` — m² — opt — manueel — detail: NEN-blok — P, V (area).
- `perceelOppervlakte` — m² — opt — manueel — detail: ja — P, R (nuttig).
- `oppervlaktenPerVerdieping[]` — lijst (verdieping/vvo/bvo/bestemming) — opt — manueel — detail: tabel — P (IM-sectie).

### Bouw
- `bouwjaar` — nummer (jaar) — opt — manueel — detail: ja — **M, V (apart prop), D, P, R**.
- `energielabelV2` — select — opt — manueel — detail: ja — M, V, D, P, R (nuttig).
- `energielabel` — string (legacy) — opt — wordt niet meer in form bewerkt — detail: fallback.
- `aantalVerdiepingen` — nummer — opt — manueel — detail: ja — P.
- `aantalUnits` — nummer — opt — manueel — detail: ja, basis voor potentie totalen — P.

### Onderhoud / risico op pand-tab
- `onderhoudsstaatNiveau` — select — opt — manueel — detail: ja — P, R (nuttig).
- `onderhoudsstaat` — string (legacy) — opt — alleen fallback in detail.
- `recenteInvesteringen`, `achterstalligOnderhoud` — textarea — opt — manueel — detail: aparte card "Onderhoud & investeringen" — P.
- `asbestinventarisatieAanwezig` — toggle — opt — manueel — detail: ja indien true.

### Potentie
- `ontwikkelPotentie`, `transformatiePotentie` — toggle — default false — manueel — detail: badges in Potentie-blok.
- `potentieOmschrijving`, `potentieStrategie`, `potentieOnderbouwingStatus`, `potentieAfhankelijkheden`, `potentieBron` — tekst/select — opt — manueel — detail: Potentie-blok.
- `potentieExtraM2`, `potentieExtraUnits` — nummer — opt — manueel — detail: 3-koloms KPI (huidig/extra/totaal).

### Juridisch
- `eigendomssituatie`, `erfpachtinformatie`, `bestemmingsinformatie` — tekst/textarea — opt — manueel — detail: "Juridisch & kadastraal" sub-card — P, D.
- `kadastraleGemeente`, `kadastraleSectie`, `kadastraalNummer` — tekst — opt — manueel — detail: ja — P.

### Verkoper
- `verkoperNaam`, `verkoperRol`, `verkoperVia` (select), `verkoperTelefoon`, `verkoperEmail`, `verkoopmotivatie` — opt — manueel — detail: Verkoper sub-card — P (fallback contact).

### Thesis / commentaar
- `samenvatting`, `investeringsthese`, `onderscheidendeKenmerken`, `risicos`, `opmerkingen`, `interneOpmerkingen` — textarea — opt — manueel — detail: Overzicht (bullets) — P.

### IM-content
- `propositie`, `objectomschrijving`, `locatieOmschrijving`, `technischeStaatOmschrijving`, `procesVoorwaarden`, `dataroomUrl` — opt — manueel — detail: "Aanbieding & proces" sub-card — P.
- `financieleScenarios` (huidig/marktconform/naRenovatie) — gestructureerd — opt — manueel — detail: tabel onder Financieel — P.
- `contactNaam/Functie/Telefoon/Email` — opt — manueel — detail: "Contactpersoon" sub-card — P (primair).
- `documentatieStatus` (map) — opt — manueel — detail: badges in Aanbieding & proces — P.
- `imSectiesZichtbaar` (map) — opt — manueel — detail: "Verborgen IM-secties" tekst — P.

### Overig
- `referentieanalyseZichtbaar` — toggle — default true — manueel — detail: stuurt zichtbaarheid van `ObjectReferentieAnalyseSectie`.
- `documentenBeschikbaar` — toggle — bestaat in type maar wordt **niet bewerkt in modal**; wel getoond op detail ("Documentatie beschikbaar: Ja/Nee").
- Pipeline-velden (`pipelineId`, `pipelineStageId`, …) — beheerd via pipeline-component, niet in form.

---

## 3. Velden die ontbreken op detailpagina

- `prijsindicatie` — staat alleen onder "Prijsindicatie / toelichting" als aanwezig; **niet getoond als fallback in hero KPI** (alleen vraagprijs).
- `subcategorie` (legacy free-text) — niet meer ergens leesbaar.
- `subcategorieId` (legacy fk) — niet zichtbaar.
- `energielabel` (legacy string) — alleen fallback wanneer V2 leeg; geen UI om aan te passen → de-facto onbewerkbaar.
- `onderhoudsstaat` (legacy string) — idem, alleen fallback.
- `parentObjectId` aanmaak-flow vanuit detail: wel getoond, niet inline bewerkbaar.
- `wozPeildatum` los — alleen hint bij WOZ-tile, niet apart leesbaar als waarde leeg is.
- `imSectiesZichtbaar` — getoond als platte lijst "Verborgen IM-secties"; niet erg leesbaar.

## 4. Velden die zichtbaar zijn op detail maar slecht bewerkbaar

- `documentenBeschikbaar` — getoond, maar niet in modal-form.
- Hero/sticky deal-cockpit-velden komen uit dezelfde data; geen inline editing.
- WALT/WALB — afgeleid uit huurders, geen direct veld op object (correct).

## 5. Velden die dubbel of overlappend lijken

- `type` (AssetClass) vs `propertyTypeId` — bewust legacy parallel; risico op divergentie als data van extern komt.
- `subcategorie` (string) + `subcategorieId` (legacy fk) + `propertySubtypeIds` (nieuw multi) — drie wegen, twee legacy.
- `energielabel` (string) + `energielabelV2` (enum) — legacy duplicaat.
- `onderhoudsstaat` (string) + `onderhoudsstaatNiveau` (enum) — legacy duplicaat.
- `aanbiedingswijze` — **2× weergegeven in Overzicht** (Identificatie-card én onderste meta-grid).
- `bron` — **2× weergegeven** (Identificatie-card én onderste meta-grid).
- `verkoperNaam/...` (Verkoper-tab) vs `contactNaam/...` (IM-tab) — twee contactblokken; gewenst gedrag is fallback, maar in UI staan twee aparte cards naast elkaar. Verwarrend.
- `marktwaardeIndicatie` (handmatig) vs mediaan uit referentie-analyse — bewust twee bronnen, maar onderling niet duidelijk gelinkt in UI.
- Maandhuur (UI-only) — input bestaat naast `huurinkomsten`; lijkt veld maar wordt nergens opgeslagen — kan verwarrend zijn voor gebruiker die "maandhuur" terug verwacht te zien.
- `noi` (handmatig) vs servicekosten/huurinkomsten — er is geen auto-berekende NOI = jaarhuur − servicekosten − exploitatielast; gebruiker moet handmatig.

## 6. Velden die mogelijk verkeerd geplaatst zijn

- **Potentie** zit nu in tab **Pand**. Past beter in een eigen tab "Potentie & strategie" of als deel van Thesis (gegeven business-impact en de uitgebreidheid).
- **WOZ/Taxatie** in tab Financieel is correct, maar `wozPeildatum`-jaarselectie zou natuurlijker bij Juridisch/Waardering passen. Acceptabel.
- **`referentieanalyseZichtbaar`** zit in tab Algemeen onder "Weergave". Past beter bij IM/document of een algemeen "Zichtbaarheid"-blok.
- **`huidigGebruik`** zit onder Classificatie (Algemeen). Hoort eerder bij Verhuur of Pand.
- **`marktwaardeIndicatie` + `marktwaardeBron`** staan in IM-tab; horen logisch onder Financieel/Waarderingen.
- **`oppervlaktenPerVerdieping`** zit in IM-tab. Hoort qua data thuis bij Pand/oppervlakten.
- **`technischeStaatOmschrijving`** zit in IM. Hoort bij Pand/Onderhoud (vrije tekst aanvulling op `onderhoudsstaatNiveau`).
- **`contactNaam/Functie/...`** (IM) versus Verkoper-tab — overweeg samenvoegen in één "Contact & verkoper" tab.

## 7. Velden die beter automatisch berekend kunnen worden

- `huurPerM2` — feitelijk al auto, maar nog steeds opgeslagen als handmatige override. Overweeg volledig afgeleid te maken (kolom = computed) tenzij gebruiker bewust een markthuur per m² wil noteren.
- `brutoAanvangsrendement`, `nettoAanvangsrendement`, kapitalisatiefactor — kunnen 100% auto zijn met override-knop. Nu is opslag handmatig, suggestie auto.
- `aantalHuurders` — kan afgeleid worden uit `huurders`-tabel; nu dubbel beheer.
- `leegstandPct` — kan afgeleid uit huurders×m² / totale m².
- Totaal m²/units na plan — al auto in form, maar **niet opgeslagen**; oké als puur derived view.
- NOI — kan auto = huur − servicekosten − exploitatielast (mits exploitatielast veld bestaat; nu niet).

## 8. Velden die handmatig moeten blijven

- `vraagprijs`, `huurinkomsten`, oppervlakten, bouwjaar, energielabel, eigendomssituatie, kadastraal: harde brondata.
- `samenvatting`, `propositie`, `investeringsthese`, `risicos`, IM-tekstvelden: copy.
- `potentie*` toggles + omschrijvingen: strategisch oordeel.
- `marktwaardeIndicatie`: bewust handmatig naast mediaan.
- Verkoper-info + contact: handmatig.

## 9. Velden die beter naar een andere module kunnen

- Pipeline-velden — al apart beheerd, prima zo.
- `documentenBeschikbaar` (vlag) — best vervangen door bestaande dossier-readiness (catalogus heeft al per-document-status). Veld is feitelijk overbodig.
- `financieleScenarios` — past mogelijk beter in Vastgoedrekenen (gevoeligheid/scenario) dan in IM. Nu zijn het simpele 3-veld snapshots; Vastgoedrekenen kent een vollediger model.
- `aantalHuurders` / `leegstandPct` — naar Verhuur-module afgeleid uit huurders.
- `recenteInvesteringen` / `achterstalligOnderhoud` / `asbestinventarisatieAanwezig` — passen in een "Technische staat / dossier" module met links naar bouwkundige documenten.
- `procesVoorwaarden`, `dataroomUrl`, `documentatieStatus` — passen logisch bij Dealflow / Aanbieding in plaats van object-master.

## 10. Categorisering per gebruik

- **Dagelijks gebruik / sleutelvelden:** titel, status, plaats, provincie, propertyTypeId, vraagprijs, huurinkomsten, oppervlakte, bouwjaar, verhuurStatus, energielabelV2, propositie, samenvatting.
- **Administratief:** internReferentienummer, datumToegevoegd, updatedAt, isArchived, imSectiesZichtbaar, documentatieStatus.
- **Belangrijk voor matching:** propertyTypeId, propertySubtypeIds, dealTypeIds (en legacy `type`), provincie/plaats, vraagprijs, oppervlakte, bouwjaar, verhuurStatus, energielabelV2.
- **Belangrijk voor underwriting / Vastgoedrekenen:** vraagprijs, huurinkomsten, servicekostenJaar, noi, wozWaarde, oppervlakteGbo/VVO, bouwjaar, energielabelV2 (V2), `type` als raw-type.
- **Belangrijk voor verkoop / dossier / teaser:** propositie, samenvatting, objectomschrijving, locatieOmschrijving, technischeStaatOmschrijving, investeringsthese, onderscheidendeKenmerken, risicos, marktwaardeIndicatie/Bron, financieleScenarios, contactNaam c.s., dataroomUrl, documentatieStatus, foto's/documenten, oppervlaktenPerVerdieping.

---

## 11. Aanbevolen verbeteringen (geen acties nu, alleen advies)

1. Detail-pagina: dedupliceer `aanbiedingswijze` en `bron` (nu 2×).
2. Toon `prijsindicatie` als fallback in hero-KPI "Vraagprijs" wanneer er geen numerieke vraagprijs is.
3. Voeg `documentenBeschikbaar` toggle toe aan modal, óf vervang door derived uit dossier-readiness en verberg het veld in detail.
4. Maak een aparte tab/sectie **Potentie & strategie** (uit Pand); voorkomt dat strategische blokken in een technische tab leven.
5. Verplaats `marktwaardeIndicatie/Bron`, `oppervlaktenPerVerdieping`, `technischeStaatOmschrijving` van IM-tab naar respectievelijk Financieel, Pand, Pand/Onderhoud.
6. Voeg een visuele waarschuwing/legacy-badge bij `subcategorie`, `energielabel`, `onderhoudsstaat`, `type`; op termijn migratiepad naar enkel taxonomie + V2-enums.
7. Maak rendementen (`BAR`, `NAR`, `factor`) standaard auto met een expliciete "Overschrijven"-toggle, zodat opgeslagen waarden niet stilletjes afwijken van berekende.
8. Maak `aantalHuurders` en `leegstandPct` derived uit `huurders`-tabel; behoud handmatige override alleen wanneer geen huurders zijn ingevoerd.
9. Splits IM-tab in twee tabs ("IM-content" + "Document & proces") of breng `contactNaam/...` samen met Verkoper.
10. Sla maandhuur niet alleen UI-state op; toon ergens read-only op detail (KPI "Huur/mnd") zodat gebruikers de berekende waarde terugvinden.

## 12. Risico's & technische aandachtspunten

- **Legacy duplicaten** (`type`/`subcategorie`/`energielabel`/`onderhoudsstaat`) blijven nu door zowel auto-sync als handmatige paden gevuld → kans op divergentie bij imports.
- **`huurPerM2` opslag** kan afwijken van auto-berekening wanneer `oppervlakteGbo`/`Vvo` later wijzigt; geen invalidation.
- **Rendementen handmatig opgeslagen** worden in detail getoond als waarheid; matching/Vastgoedrekenen kan andere waarde berekenen → inconsistent gevoel.
- **`markeerAlsReferentie`** is UI-only (niet in DB). Indien later persistentie gewenst is, ontstaat extra kolom.
- **`wozPeildatum`** wordt opgeslagen als `YYYY-01-01`; bij export/PDF wordt soms volledige datum getoond.
- **Tab Verhuur** verwijst voor huurders naar aparte tabel; bij nieuwe (ongesavde) objecten is dit blok niet bruikbaar — verwacht UX, maar gebruiker moet eerst opslaan.
- **`aanbiedingswijze` 2× tonen** is een louter UI-bug op detail.
- **Dossier-catalog** dupliceert veel object-velden onder eigen keys (vraagprijs, huurinkomsten, bouwjaar, energielabel, eigendomssituatie, …) → check op consistentie wanneer object-velden wijzigen.

## 13. Concrete vervolgstappen (in volgorde van impact)

1. Bug-fix detailpagina: verwijder dubbele weergaves van `aanbiedingswijze` en `bron`.
2. Beslis met product wat met legacy-velden (`type`/`subcategorie`/`energielabel`/`onderhoudsstaat`) moet gebeuren — migratie of bewust laten staan met disclaimer.
3. Beslis of rendementen volledig auto (met override) worden.
4. Beslis of `aantalHuurders`/`leegstandPct` derived worden uit huurders.
5. Reorganiseer modal-tabs: aparte Potentie-tab, verplaats Marktwaarde naar Financieel, verplaats `oppervlaktenPerVerdieping` naar Pand, IM-tab opschonen.
6. Voeg `documentenBeschikbaar` toe aan modal of vervang door derived dossier-status.
7. Schrijf één centrale "field-map" (object-veld → tabs / detailsecties / matching / V&R / dossier / PDF) — handig voor toekomstige audits en testen.
8. QA-ronde over PDF/brochure en referentieanalyse na elke veld-herindeling om regressies te vangen.

