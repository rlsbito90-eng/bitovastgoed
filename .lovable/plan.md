## Aanbeveling: Optie C (Hybride) — Workspace Layout V1

Optie A (alles inklapbaar) lost het probleem niet op: pagina blijft één lange DOM, scroll-state blijft rommelig, en gebruikers moeten elke sessie opnieuw open/dicht klikken. Optie B (pure tabs) is rustig maar verbergt context die je vaak naast elkaar nodig hebt (bv. Dealflow + Kandidaten + Cockpit). **Optie C** combineert het beste: minder DOM tegelijk gerenderd, vaste cockpit-context, en deep links blijven werken.

### Evaluatie kort

| Criterium | A inklapbaar | B tabs | **C hybride** |
|---|---|---|---|
| Gebruiksvriendelijk | matig | goed | **best** |
| Rustig beeld | matig | best | **best** |
| Dagelijks gebruik | matig | goed | **best** |
| Technisch risico | laag | hoog | **midden** |
| Deep links | best | risico | **goed (met shim)** |
| Geen scroll-marathon | nee | ja | **ja** |
| Desktop + mobiel | matig | goed | **best** |

---

## Workspace Layout V1

### Vaste structuur (altijd zichtbaar, niet in tab)
- **PageHeader** (titel, status, acties)
- **KPI-strip** (BAR, factor, €/m², WALT/WALB — bestaand)
- **Workspace tabs** (sticky, horizontaal scrollbaar — bestaande `SectionNav` hergebruikt)
- **Rechterkolom desktop**: Deal Cockpit + Next action + Quick actions blijven sticky náást de tab-content (zoals nu). Op mobiel verschijnen ze als laatste tab "Cockpit".

### Tabindeling (7 hoofdtabs + Meer)

1. **Overzicht** — `overzicht` (asset-info, beschrijving, foto's-thumb)
2. **Dealflow** — `dealflow` + `biedingen` + `activiteit`
3. **Kandidaten** — `kandidaten` + (conditioneel) `referenties`
4. **Vastgoedrekenen** — `vastgoedrekenen` (audit dialog blijft binnen tab)
5. **Financieel** — `financieel` + (conditioneel) `verhuur` als subsectie
6. **Dossier** — `dossier` + `aanbieding` + `documenten`
7. **Pand** — `pand` + (conditioneel) `potentie`
8. **Meer** (dropdown) — `juridisch`, `verkoper`, eventueel `activiteit` als losse view

### Tab badges
- Dealflow: aantal actieve deals
- Kandidaten: aantal sterke matches + pipeline-rijen (gededupliceerd, hergebruik `countKandidaten`)
- Dossier: readiness-percentage of rode dot bij ontbrekende kerngegevens
- Biedingen (in Dealflow): klein subscript bij sectiekop
- Vastgoedrekenen: dot wanneer audit warnings/errors

### Binnen-tab inklapbaar
Alleen subkaarten die echt lang zijn én vaak overgeslagen:
- Financieel → "Volledige NOI-opbouw" inklapbaar
- Dossier → per categorie collapsible (bestaat al)
- Pand → "Technische staat detail" inklapbaar
- Activiteit → standaard laatste 10, "Toon meer" knop

Top-level secties (h2) zijn **niet** inklapbaar — die zijn nu tabs.

---

## Deep links & migratie

### Anchors blijven werken (kritisch)
Huidige URL's: `/objecten/:id#kandidaten`, `#vastgoedrekenen`, `#deal-cockpit` etc.

**Shim-mechanisme:**
```ts
const ANCHOR_TO_TAB: Record<string, TabId> = {
  overzicht: 'overzicht',
  dealflow: 'dealflow', biedingen: 'dealflow', activiteit: 'dealflow',
  kandidaten: 'kandidaten', referenties: 'kandidaten',
  vastgoedrekenen: 'vastgoedrekenen',
  financieel: 'financieel', verhuur: 'financieel',
  dossier: 'dossier', aanbieding: 'dossier', documenten: 'dossier',
  pand: 'pand', potentie: 'pand',
  juridisch: 'meer', verkoper: 'meer',
};
```

Bij mount: lees `location.hash`, kies tab via map, scroll na render naar het anchor-id binnen die tab. Anchors blijven in DOM op zelfde id's → externe links blijven werken.

### Tab-state in URL
- Primaire bron: `?tab=dealflow` query param (shareable, terug-knop werkt).
- Fallback: hash naar tab-map.
- Geen tab in URL: gebruik laatst-geopende tab uit `localStorage` key `object-detail:last-tab`, anders `overzicht`.

### Laatst geopende tab
- `localStorage.setItem('object-detail:last-tab', tabId)` bij tab-switch.
- Niet per object onthouden (te onvoorspelbaar); één globale voorkeur.

---

## Technische aanpak

### Bestanden
- **`src/pages/ObjectDetailPage.tsx`** — alleen layout/routing van content per tab. Tab-state hook + URL sync.
- **Geen splitsing** van JSX-blokken naar nieuwe componenten in V1 (te risicovol). Tabs worden gerenderd via conditionele `{activeTab === 'dealflow' && <>…</>}` om DOM-kost te verlagen. Inhoud van elk anchor-blok blijft 1-op-1 gelijk.

### Performance winst
Niet-actieve tabs worden niet gerenderd → grote winst bij Vastgoedrekenen en Dossier (zware sub-trees). Forms/dialogs binnen tabs hoeven niet meer onnodig te mounten.

### Mobiel
- Tabs scrollen horizontaal (bestaand mechanisme met edges/wheel).
- Cockpit/Next action/Quick actions verschijnen als laatste tab "Cockpit" i.p.v. sticky kolom.

### Risico's & mitigatie
- **Risico**: deep links breken → mitigatie via shim + smoke-test van bestaande hashes.
- **Risico**: tab-renders verliezen scroll-positie binnen sectie → bewust `scroll-mt-24` + `scrollIntoView` alleen bij hash-navigatie, niet bij tab-switch.
- **Risico**: dirty form state in Vastgoedrekenen verloren bij tab-switch → audit/dirty-state check tonen `confirm` voordat tab wisselt (zoals al bestaat bij navigate-away).
- **Risico**: `SectionNav` was scroll-spy → wordt simpele tab-list (geen IntersectionObserver meer nodig).

---

## Migratieplan (3 stappen, los te shippen)

**Stap 1 — Workspace skeleton (deze ronde)**
- Tab-state + URL sync + localStorage memo.
- Anchor-shim map.
- Bestaande `BASE_SECTIONS` herbenoemd naar tabs.
- Render alleen actieve tab-content.
- Cockpit-kolom op desktop blijft sticky; op mobiel als "Cockpit" tab.

**Stap 2 — Badges & polish**
- Badge-counts per tab (deals, kandidaten, audit-warnings).
- Dirty-state guard bij tab-switch in Vastgoedrekenen.
- "Meer" dropdown voor juridisch/verkoper.

**Stap 3 — Binnen-tab collapsibles** (later, optioneel)
- Inklapbare subkaarten in Financieel, Pand, Activiteit "toon meer".

---

## Acceptatie V1

- Geen scroll-marathon meer: max 1 tab content tegelijk zichtbaar.
- Cockpit altijd zichtbaar (desktop sticky, mobiel laatste tab).
- Alle bestaande `#anchor` links openen juiste tab + scrollen ernaartoe.
- Tab-keuze overleeft refresh (via URL of localStorage).
- Geen bestaande functionaliteit gebroken; alle dialogs/forms werken identiek.
- Werkt 1280px desktop én 375px mobiel.

Niet bouwen — wacht op akkoord voor Stap 1.