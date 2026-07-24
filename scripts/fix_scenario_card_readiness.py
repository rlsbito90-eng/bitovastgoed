from pathlib import Path

comparison_path = Path('src/components/vastgoedrekenen/ScenarioVergelijking.tsx')
test_path = Path('src/test/ui/vastgoedrekenenAcceptanceLayout.test.ts')

source = comparison_path.read_text()
old = '''        <div className={`rounded-md border p-2 text-[11px] ${
          readiness.status === 'voor_bieding'
            ? 'border-emerald-500/30 bg-emerald-500/5'
            : 'border-amber-500/30 bg-amber-500/5'
        }`}>
          <p className="font-medium">{readiness.title}</p>
          {readiness.items.slice(0, 2).map((item) => (
            <p key={`${item.category}-${item.message}`} className="mt-1 leading-snug text-muted-foreground">
              {item.label}: {item.message}
            </p>
          ))}
        </div>'''
new = '''        <div className={`rounded-md border p-2 text-[11px] ${
          readiness.status === 'voor_bieding'
            ? 'border-emerald-500/30 bg-emerald-500/5'
            : 'border-amber-500/30 bg-amber-500/5'
        }`}>
          <p className="font-medium">{readiness.title}</p>
          {readiness.items.length > 0 && (
            <ol className="mt-2 space-y-2">
              {readiness.items.slice(0, 2).map((item, index) => (
                <li key={`${item.category}-${item.message}`} className="flex gap-2 rounded border bg-background/60 p-2 leading-snug">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border font-semibold" aria-label={`Aandachtspunt ${index + 1}`}>
                    {index + 1}
                  </span>
                  <span className="min-w-0">
                    <span className="block font-medium text-foreground">{item.label}</span>
                    <span className="block mt-0.5 text-muted-foreground">{item.message}</span>
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>'''
if old not in source:
    raise SystemExit('compact readiness block not found')
comparison_path.write_text(source.replace(old, new, 1))

source = test_path.read_text()
source = source.replace(
    "expect(comparison).toContain('Aandachtspunt ${index + 1}');",
    "expect(comparison).toContain('aria-label={`Aandachtspunt');",
)
source = source.replace(
    "expect(result).toContain('Aandachtspunt ${index + 1}');",
    "expect(result).toContain('aria-label={`Aandachtspunt');",
)
test_path.write_text(source)
