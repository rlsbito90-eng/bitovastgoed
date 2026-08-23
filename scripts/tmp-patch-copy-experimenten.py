from pathlib import Path


def replace(path: str, old: str, new: str):
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f'PATTERN NOT FOUND in {path}: {old[:120]!r}')
    p.write_text(text.replace(old, new, 1))

# 1. Brief-model + insertcontract
replace(
    'src/hooks/useOffMarketBrieven.tsx',
    "  respons_samenvatting?: string | null;\n}\n\nexport interface BriefInsert {",
    "  respons_samenvatting?: string | null;\n  // Copy-experimentidentiteit — nullable voor historische communicatie.\n  copy_profiel?: string | null;\n  copy_variant_key?: string | null;\n  copy_variant_code?: string | null;\n  copy_hypothese?: string | null;\n}\n\nexport interface BriefInsert {",
)
replace(
    'src/hooks/useOffMarketBrieven.tsx',
    "  verzendstatus?: Verzendstatus | null;\n}\n\nconst TABLE",
    "  verzendstatus?: Verzendstatus | null;\n  copy_profiel?: string | null;\n  copy_variant_key?: string | null;\n  copy_variant_code?: string | null;\n  copy_hypothese?: string | null;\n}\n\nconst TABLE",
)
replace(
    'src/hooks/useOffMarketBrieven.tsx',
    "        verzendstatus: input.verzendstatus ?? 'concept',\n      };\n      if (input.id) {",
    "        verzendstatus: input.verzendstatus ?? 'concept',\n      };\n      // Variantvelden worden alleen geraakt wanneer de voorbereidingsflow ze\n      // expliciet meegeeft. Zo blijven historische/verstuurde records immutable.\n      if (input.copy_profiel !== undefined) payload.copy_profiel = input.copy_profiel;\n      if (input.copy_variant_key !== undefined) payload.copy_variant_key = input.copy_variant_key;\n      if (input.copy_variant_code !== undefined) payload.copy_variant_code = input.copy_variant_code;\n      if (input.copy_hypothese !== undefined) payload.copy_hypothese = input.copy_hypothese;\n      if (input.id) {",
)

# 2. Voorbereidingsdialog: vaste varianttoewijzing + zichtbaarheid
replace(
    'src/components/offmarket/BriefVoorbereidenDialog.tsx',
    "import type { Kanaal } from '@/lib/offMarket/brieven/verzendstatus';",
    "import type { Kanaal } from '@/lib/offMarket/brieven/verzendstatus';\nimport { bepaalCopyProfiel, kiesCopyVariant, copyProfielLabel } from '@/lib/acquisitie/copyExperimenten';",
)
replace(
    'src/components/offmarket/BriefVoorbereidenDialog.tsx',
    "  const huidigeCampagneStap = useMemo<string>(() => {\n    if (initialBrief?.campagne_stap) return initialBrief.campagne_stap as string;\n    if (kanaal === 'email') return volgendeEmailStap(signaalBrieven);\n    return 'brief_1';\n  }, [initialBrief, kanaal, signaalBrieven]);\n\n  const ensureBriefOpgeslagen",
    "  const huidigeCampagneStap = useMemo<string>(() => {\n    if (initialBrief?.campagne_stap) return initialBrief.campagne_stap as string;\n    if (kanaal === 'email') return volgendeEmailStap(signaalBrieven);\n    return 'brief_1';\n  }, [initialBrief, kanaal, signaalBrieven]);\n\n  const copyToewijzing = useMemo(() => {\n    const profiel = bepaalCopyProfiel({ signaal, kanaal, emailProfiel });\n    return kiesCopyVariant({\n      profiel, kanaal, campagneStap: huidigeCampagneStap, signaalId: signaal.id,\n      geadresseerdeKey: initialBrief?.geadresseerde_key ?? kandidaatLabel ?? null,\n    });\n  }, [signaal, kanaal, emailProfiel, huidigeCampagneStap, initialBrief?.geadresseerde_key, kandidaatLabel]);\n\n  const ensureBriefOpgeslagen",
)
replace(
    'src/components/offmarket/BriefVoorbereidenDialog.tsx',
    "        campagne_stap: huidigeCampagneStap as any,\n      });",
    "        campagne_stap: huidigeCampagneStap as any,\n        ...(initialBrief?.status === 'verstuurd' && !initialBrief.copy_variant_key ? {} : {\n          copy_profiel: initialBrief?.copy_profiel ?? copyToewijzing.profiel,\n          copy_variant_key: initialBrief?.copy_variant_key ?? copyToewijzing.variantKey,\n          copy_variant_code: initialBrief?.copy_variant_code ?? copyToewijzing.variantCode,\n          copy_hypothese: initialBrief?.copy_hypothese ?? copyToewijzing.hypothese,\n        }),\n      });",
)
replace(
    'src/components/offmarket/BriefVoorbereidenDialog.tsx',
    "          {kanaal === 'email' && (\n            <div className=\"space-y-1.5\" data-testid=\"brief-email-profiel\">",
    "          <div className=\"rounded-md border border-dashed border-border bg-muted/10 px-3 py-2 text-xs\" data-testid=\"brief-copy-variant\">\n            <div className=\"font-medium text-foreground\">\n              Testvariant {initialBrief?.copy_variant_code ?? copyToewijzing.variantCode} · {initialBrief?.copy_variant_code ? 'vastgelegd' : 'controle'}\n            </div>\n            <div className=\"mt-0.5 text-muted-foreground\">\n              {copyProfielLabel(initialBrief?.copy_profiel ?? copyToewijzing.profiel)} · {initialBrief?.copy_hypothese ?? copyToewijzing.hypothese}\n            </div>\n          </div>\n\n          {kanaal === 'email' && (\n            <div className=\"space-y-1.5\" data-testid=\"brief-email-profiel\">",
)

# 3. Dashboarddata: variantmeta ophalen
replace(
    'src/hooks/useAcquisitieConversieDashboard.ts',
    ".select('id,campagne_stap')",
    ".select('id,campagne_stap,copy_profiel,copy_variant_key,copy_variant_code,copy_hypothese')",
)

# 4. Conversiemodel: variantgroep
p = Path('src/lib/acquisitie/conversieDashboard.ts')
text = p.read_text()
text = "import { copyProfielLabel } from '@/lib/acquisitie/copyExperimenten';\n\n" + text
text = text.replace(
    "export interface AcquisitieBriefMeta {\n  id: string;\n  campagne_stap: string | null;\n}",
    "export interface AcquisitieBriefMeta {\n  id: string;\n  campagne_stap: string | null;\n  copy_profiel?: string | null;\n  copy_variant_key?: string | null;\n  copy_variant_code?: string | null;\n  copy_hypothese?: string | null;\n}",
    1,
)
text = text.replace(
    "  perMaand: ConversieRij[];\n  reactiesZonderVerzending: number;",
    "  perMaand: ConversieRij[];\n  perVariant: ConversieRij[];\n  variantGelabeld: number;\n  variantOngelabeld: number;\n  reactiesZonderVerzending: number;",
    1,
)
text = text.replace(
    "  const groepen = (sleutelFn: (briefId: string, event: AcquisitieConversieEvent) => [string, string]) => {",
    "  const groepen = (\n    sleutelFn: (briefId: string, event: AcquisitieConversieEvent) => [string, string],\n    bron: Array<[string, AcquisitieConversieEvent]> = jaarVerzendingen,\n  ) => {",
    1,
)
text = text.replace(
    "    for (const [briefId, event] of jaarVerzendingen) {",
    "    for (const [briefId, event] of bron) {",
    1,
)
text = text.replace(
    "  const totaalVerzonden = jaarVerzendingen.length;",
    "  const gelabeldeVarianten = jaarVerzendingen.filter(([briefId]) => !!metaPerBrief.get(briefId)?.copy_variant_key);\n  const perVariant = groepen((briefId) => {\n    const meta = metaPerBrief.get(briefId);\n    const sleutel = meta?.copy_variant_key || 'onbekend';\n    const profiel = copyProfielLabel(meta?.copy_profiel);\n    const stap = touchpointLabel(meta?.campagne_stap || 'onbekend');\n    const code = meta?.copy_variant_code || '?';\n    return [sleutel, `${profiel} · ${stap} · Variant ${code}`];\n  }, gelabeldeVarianten).sort((a, b) => b.verzonden - a.verzonden);\n\n  const totaalVerzonden = jaarVerzendingen.length;",
    1,
)
text = text.replace(
    "    perMaand,\n    reactiesZonderVerzending,",
    "    perMaand,\n    perVariant,\n    variantGelabeld: gelabeldeVarianten.length,\n    variantOngelabeld: totaalVerzonden - gelabeldeVarianten.length,\n    reactiesZonderVerzending,",
    1,
)
p.write_text(text)

# 5. Centraal dashboard: echte varianttabel + dekking
replace(
    'src/components/acquisitie/AcquisitieConversieDashboard.tsx',
    "      <div className=\"rounded-md border border-dashed border-border bg-muted/10 p-4 flex gap-3\">\n        <FlaskConical className=\"mt-0.5 h-4 w-4 shrink-0 text-muted-foreground\" />\n        <div>\n          <div className=\"text-sm font-medium text-foreground\">A/B-testlaag voorbereid</div>\n          <p className=\"mt-1 text-xs leading-relaxed text-muted-foreground\">\n            Het dashboard is nu de centrale analyseplek. Tekstvariant A/B is nog niet als afzonderlijk meetveld gemodelleerd; daarom toont de app bewust nog geen schijnwinnaar. De volgende tranche koppelt iedere verzending aan een vaste variant en hypothese, waarna dezelfde tabel automatisch per variant kan vergelijken.\n          </p>\n        </div>\n      </div>",
    "      <ConversieTabel\n        titel=\"Per tekstvariant\"\n        toelichting=\"Nieuwe communicaties krijgen een vaste variantidentiteit. Historische verzendingen zonder variant blijven buiten deze vergelijking.\"\n        rijen={model.perVariant}\n      />\n\n      <div className=\"rounded-md border border-dashed border-border bg-muted/10 p-4 flex gap-3\">\n        <FlaskConical className=\"mt-0.5 h-4 w-4 shrink-0 text-muted-foreground\" />\n        <div>\n          <div className=\"text-sm font-medium text-foreground\">Experimentdekking · {model.variantGelabeld}/{model.totaal.verzonden}</div>\n          <p className=\"mt-1 text-xs leading-relaxed text-muted-foreground\">\n            Vanaf deze release wordt de toegewezen variant per communicatie vastgelegd. {model.variantOngelabeld > 0 ? `${model.variantOngelabeld} historische verzending(en) hebben bewust geen variantlabel.` : 'Alle gemeten verzendingen hebben een variantlabel.'} Er wordt pas een winnaarstatus toegevoegd wanneer er meerdere inhoudelijke varianten actief zijn en voldoende datavolume is.\n          </p>\n        </div>\n      </div>",
)

# 6. Regressietest variantaggregatie
replace(
    'src/test/acquisitie/conversieDashboard.test.ts',
    "  it('neemt verzendingen buiten het gekozen jaar niet mee', () => {",
    "  it('groepeert gelabelde communicatie centraal per tekstvariant', () => {\n    const model = bouwAcquisitieConversieDashboard([\n      event(),\n      event({ occurred_at: '2026-07-05T10:00:00Z', event_type: 'reactie_ontvangen', telt_verzonden_communicatie: false, telt_reactie: true }),\n    ], [{\n      id: 'b1', campagne_stap: 'brief_1', copy_profiel: 'woonvorming',\n      copy_variant_key: 'woonvorming:post:brief_1:A', copy_variant_code: 'A',\n    }], 2026);\n\n    expect(model.perVariant).toHaveLength(1);\n    expect(model.perVariant[0]).toMatchObject({ verzonden: 1, reacties: 1, responspercentage: 100 });\n    expect(model.variantGelabeld).toBe(1);\n    expect(model.variantOngelabeld).toBe(0);\n  });\n\n  it('neemt verzendingen buiten het gekozen jaar niet mee', () => {",
)

print('copy experiment patch applied')
