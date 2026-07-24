from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    p = Path(path)
    source = p.read_text()
    if old not in source:
        raise SystemExit(f'Pattern not found in {path}: {old[:120]!r}')
    p.write_text(source.replace(old, new, 1))


replace_once(
    'src/lib/vastgoedrekenen/compute.ts',
    """  const insufficientlySupportedCosts = costs.filter((cost) => {
    if (effectiveCostAmount(cost) <= 0) return false;
    const notes = String((cost as unknown as Record<string, unknown>).notes ?? '').trim();
    return cost.reliability_status !== 'hoog' || !notes;
  });
""",
    """  const insufficientlySupportedCosts = costs.filter(
    (cost) => effectiveCostAmount(cost) > 0 && cost.reliability_status !== 'hoog',
  );
""",
)
replace_once(
    'src/lib/vastgoedrekenen/compute.ts',
    "Algemene projectkosten nog niet volledig onderbouwd:",
    "Algemene projectkosten hebben nog geen betrouwbaarheid Hoog:",
)

replace_once(
    'src/lib/vastgoedrekenen/validation.ts',
    """  const costsNeedingSupport = c.costs.filter((cost) => {
    if (costAmount(cost) <= 0) return false;
    const notes = String((cost as unknown as Record<string, unknown>).notes ?? '').trim();
    return cost.reliability_status !== 'hoog' || !notes;
  });
  for (const cost of costsNeedingSupport) {
    const notes = String((cost as unknown as Record<string, unknown>).notes ?? '').trim();
    const status = cost.reliability_status == null
      ? 'niet beoordeeld'
      : cost.reliability_status;
    out.push({
      level: 'warning',
      title: notes || cost.reliability_status !== 'hoog'
        ? 'Kostenpost onderbouwen'
        : 'Bron van kostenpost invullen',
      message: cost.reliability_status === 'hoog' && !notes
        ? `“${costLabel(cost)}” (${formatEur(costAmount(cost))}) staat op Hoog, maar Bron / onderbouwing is leeg. Vul bijvoorbeeld de begroting, offerte of referentie met datum in.`
        : `“${costLabel(cost)}” (${formatEur(costAmount(cost))}) staat op ${status}. Controleer bedrag en scope, vul Bron / onderbouwing in en kies daarna de passende betrouwbaarheid.`,
""",
    """  const costsNeedingSupport = c.costs.filter(
    (cost) => costAmount(cost) > 0 && cost.reliability_status !== 'hoog',
  );
  for (const cost of costsNeedingSupport) {
    const status = cost.reliability_status == null
      ? 'niet beoordeeld'
      : cost.reliability_status;
    out.push({
      level: 'warning',
      title: 'Kostenpost onderbouwen',
      message: `“${costLabel(cost)}” (${formatEur(costAmount(cost))}) staat op ${status}. Controleer bedrag en scope, vul Bron / onderbouwing in en kies daarna de passende betrouwbaarheid.`,
""",
)
replace_once(
    'src/lib/vastgoedrekenen/validation.ts',
    "message: `Algemene kostenpost “${centralNames}” (${formatEur(detail.centralAmount)}) lijkt dezelfde kostensoort te bevatten als ${componentDescription} in de componentstrategie (${formatEur(detail.componentAmount)}). Onvoorzien (%) wordt hierbij niet als dubbele kostenpost behandeld.`,",
    "message: `Mogelijke dubbele kosteninvoer: algemene kostenpost “${centralNames}” (${formatEur(detail.centralAmount)}) lijkt dezelfde kostensoort te bevatten als ${componentDescription} in de componentstrategie (${formatEur(detail.componentAmount)}). Onvoorzien (%) wordt hierbij niet als dubbele kostenpost behandeld.`,",
)

replace_once(
    'src/test/ui/actionableValidationUx.test.ts',
    "expect(editor).toContain('Projectspecifiek gecontroleerd');",
    "expect(editor.toLowerCase()).toContain('projectspecifiek gecontroleerd');",
)
