## Doel

Op het Dashboard wordt "Verwachte fee" (gewogen) overal vervangen door **Potentiële commissie** (ongewogen, `pipelineBedragTotaal`) als hoofdwaarde. De gewogen verwachting (`pipelineBedragGewogen`) blijft zichtbaar als secundaire toelichting. Consistent met Deal Cockpit op ObjectDetailPage.

## Wijzigingen — alleen `src/pages/DashboardPage.tsx`

### 1. Hero-strip (regels ~296–315, "secondary KPI" onder Pipeline waarde)
Vervang het eerste tegel-blok "Verwachte fee":
- Label: `Potentiële commissie`
- Hoofdwaarde: `formatCurrencyCompact(commissieStats.pipelineBedragTotaal)`
- Subtekst eronder (klein, `text-[10px] text-muted-foreground`): `Gewogen: € X` met `pipelineBedragGewogen`

Layout blijft 3 koloms (Potentiële commissie · In closing · Actieve kopers).

### 2. KPICard-rij (regels ~327–334)
Vervang KPICard "Verwachte fee":
- `label="Potentiële commissie"`
- `value={formatCurrencyCompact(commissieStats.pipelineBedragTotaal)}`
- `hint={`Gewogen: ${formatCurrencyCompact(commissieStats.pipelineBedragGewogen)}`}`
- Icon/tone/href ongewijzigd.

### 3. Pipeline momentum (regels ~372–411)
Per-fase tegels tonen nu `fee ~ {gewogen}`. Dit is per-fase gewogen forecast en blijft functioneel correct (granulair, niet de hoofd-KPI). **Label aanpassen** naar `fee gew. ~` om duidelijk te maken dat het de gewogen variant is. Hotspot-logica blijft op `gewogen`.

### 4. Forecast 30/60/90 (regel ~786)
Sectiekop "Verwachte fee (gewogen)" blijft ongewijzigd — dit is een expliciet gewogen-forecast-blok en zelf-gelabeld, niet de dominante hoofd-KPI.

## Niet aangeraakt

- `CommissieWidget.tsx` (eigen "gerealiseerd + gewogen pipeline" blok, gebruikt al duidelijke labels)
- `RapportagePage.tsx` (rapportage-context, gewogen daar gewenst)
- Deal-derivations / mock-data berekeningen
- ObjectDetailPage Deal Cockpit (al correct)

## Acceptatie

- Geen hoofd-KPI op Dashboard met label "Verwachte fee" meer.
- Beide fee-plekken (hero-strip tegel + KPICard) tonen Potentiële commissie als primair, gewogen als subtekst.
- Pipeline momentum behoudt gewogen per-fase weergave met verduidelijkt label.