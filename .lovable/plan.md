# Plan: Mobiele UX & Dataveiligheid app-breed

Grote, app-brede UX-ronde. Geen rekenlogica of businesslogica wijzigen. Focus op het veilig maken van mobiel bewerken en het beschermen van bestaande data tegen ongewenst overschrijven.

## Aanpak in 5 fases

### Fase 1 — Infrastructuur (nieuwe helpers/hooks)

Nieuwe bestanden:
- `src/hooks/useIsTouch.tsx` — detecteert touch-only devices via `(hover: none) and (pointer: coarse)` media query. Aparter dan `useIsMobile` (die alleen op breedte kijkt) zodat ook tablets in touch-mode correct gedetecteerd worden.
- `src/hooks/useDirtyGuard.tsx` — centrale dirty-state hook:
  - `markDirty()` / `markClean()`
  - `confirmDiscard(): Promise<boolean>` — toont native `confirm()` dialog met NL tekst "Je hebt niet-opgeslagen wijzigingen. Wil je deze verwerpen?"
  - `beforeunload`-listener voor browser refresh/close
- `src/hooks/useTapVsScroll.tsx` — geeft `onTouchStart/onTouchMove/onTouchEnd` handlers terug die een callback alleen vuren als er een echte tap is (movement < 10px, duur < 500ms). Voorkomt dat scrollen een card opent.

### Fase 2 — App-breed: select-on-focus uitschakelen op touch

Bestanden te patchen:
- `src/components/vastgoedrekenen/RawInputs.tsx` — `RawNumberInput`/`RawTextInput`: in de `onFocus` handler `e.target.select()` overslaan als touch-device.
- `src/components/ui/input.tsx` — geen auto-select aanwezig, maar voor de zekerheid wrapper-comment. (geen wijziging nodig tenzij we het centraal willen toevoegen).
- Eventueel `src/components/vastgoedrekenen/cockpit/ValueField.tsx` als die select-on-focus heeft.

### Fase 3 — Dirty-state bescherming op modals/drawers

Componenten met `Sheet`/`Dialog`/`Drawer` die bestaande data bewerken:
- `src/components/vastgoedrekenen/cockpit/ComponentenTable.tsx` (Sheet)
- `src/components/forms/ObjectFormDialog.tsx`
- `src/components/forms/RelatieFormDialog.tsx`
- `src/components/forms/DealFormDialog.tsx`
- `src/components/forms/ContactMomentFormDialog.tsx`
- `src/components/forms/TaakFormDialog.tsx`
- `src/components/forms/ZoekprofielFormDialog.tsx`
- `src/components/forms/ReferentieObjectFormDialog.tsx`
- `src/components/forms/AcquisitieTargetFormDialog.tsx`
- `src/components/forms/AcquisitieCampagneFormDialog.tsx`
- `src/components/biedingen/OfferFormDialog.tsx`

Patroon per dialog:
1. Hou `baselineRef` bij van originele waarden bij open
2. `isDirty = !shallowEqual(form, baseline)`
3. `onOpenChange(false)` → als dirty, eerst `confirmDiscard()`; zo nee, sluiten reset naar baseline
4. Duidelijke "Annuleren" knop = baseline herstellen + sluiten; "Opslaan" = bestaande save flow

### Fase 4 — Mobiel: tap vs scroll + read-only preview

Risicovolle tabellen waar een row-click direct in edit-mode opent:
- `src/components/vastgoedrekenen/cockpit/ComponentenTable.tsx` — rij `onClick` → `useTapVsScroll`. Op mobiel: drawer opent in **read-only mode** met "Bewerken"-knop bovenin. Op desktop: huidig gedrag (direct bewerkbaar).
- `src/components/vastgoedrekenen/cockpit/WwsUnitsTable.tsx` — zelfde patroon
- `src/components/vastgoedrekenen/ComponentStrategyTable.tsx` — zelfde patroon
- `src/components/object/HuurdersPanel.tsx` — read-only-first op mobiel
- `src/components/relatie/ContactpersonenPanel.tsx` — read-only-first op mobiel

Patroon in drawer:
```tsx
const [editMode, setEditMode] = useState(!isTouch);
// Velden disabled={!editMode}
// Op mobiel: <Button onClick={() => setEditMode(true)}>Bewerken</Button>
```

### Fase 5 — Verificatie

- `bunx vitest run` — alle 165 tests groen
- Spot-check `useDirtyGuard` met een mini-test
- Visuele check niet nodig in CI

## Buiten scope

- Geen wijzigingen in `compute.ts`, `financialCalc.ts`, derivations, of audit-logica
- Geen wijzigingen in DB-schema of save-guards
- Inline-edit op desktop blijft ongewijzigd
- Mobile-first redesign van forms zelf (alleen het bescherm-laagje)

## Technische details

`useIsTouch`:
```ts
export function useIsTouch() {
  const [touch, setTouch] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia('(hover: none) and (pointer: coarse)');
    setTouch(mql.matches);
    const h = (e: MediaQueryListEvent) => setTouch(e.matches);
    mql.addEventListener('change', h);
    return () => mql.removeEventListener('change', h);
  }, []);
  return touch;
}
```

`useTapVsScroll`:
```ts
const start = useRef<{x:number;y:number;t:number}|null>(null);
const onTouchStart = (e) => { const t = e.touches[0]; start.current = {x:t.clientX,y:t.clientY,t:Date.now()}; };
const onTouchEnd = (e) => {
  const s = start.current; if (!s) return;
  const t = e.changedTouches[0];
  const dx = Math.abs(t.clientX - s.x), dy = Math.abs(t.clientY - s.y);
  if (dx < 10 && dy < 10 && Date.now() - s.t < 500) onTap();
};
```

Dirty-guard gebruikt `window.confirm()` voor minimale dependency-impact (geen extra dialog-state in elke parent).

## Impact

- Nieuwe bestanden: 3 hooks
- Gewijzigde bestanden: ~12 (form-dialogs + 5 tabellen + RawInputs)
- Geen migraties, geen schema-wijzigingen
- Verwachte tijdsbesteding: 1 ronde
