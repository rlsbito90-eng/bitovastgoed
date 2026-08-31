from pathlib import Path

p = Path('src/pages/RapportagePage.tsx')
s = p.read_text()
old = '''      {/* Conversiefunnel */}
      <div className="section-card p-5 sm:p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="section-title">Object Pipeline momentum · {jaar}</h2>
          <span className="text-xs text-muted-foreground">
            {funnel[0].aantal} leads → {funnel[funnel.length - 1].aantal} closes ({conversiePct}%)
          </span>
        </div>
        <div className="space-y-1.5">
          {funnel.map((rij, idx) => {
            const max = funnel[0].aantal || 1;
            const pct = (rij.aantal / max) * 100;
            const dropoff = idx > 0 && funnel[idx - 1].aantal > 0
              ? Math.round(((funnel[idx - 1].aantal - rij.aantal) / funnel[idx - 1].aantal) * 100)
              : null;
            return (
              <div key={rij.fase}>
                {idx > 0 && dropoff != null && dropoff > 0 && (
                  <div className="flex items-center gap-1 pl-4 text-[10px] text-muted-foreground -mt-0.5 mb-0.5">
                    <ArrowDown className="h-2.5 w-2.5" /> -{dropoff}%
                  </div>
                )}
                <div className="flex items-center gap-3">
                  <div className="w-28 sm:w-32 text-xs text-muted-foreground shrink-0">{rij.fase}</div>
                  <div className="flex-1 h-7 bg-muted/40 rounded-md overflow-hidden">
                    <div
                      className={`h-full flex items-center px-2 text-xs font-medium font-mono-data transition-all ${
                        idx === funnel.length - 1
                          ? 'bg-green-500/80 text-white'
                          : 'bg-accent/70 text-accent-foreground'
                      }`}
                      style={{ width: `${Math.max(pct, 4)}%` }}
                    >
                      {rij.aantal}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
'''
new = '''      {/* Huidige Object Pipeline-verdeling — géén historische conversiefunnel. */}
      <div className="section-card p-5 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="section-title">Object Pipeline momentum</h2>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Huidige verdeling van actieve objecten over de commerciële trajectfase.
            </p>
          </div>
          <span className="text-xs text-muted-foreground">
            {store.objecten.filter(object => !object.isArchived).length} actieve objecten · {funnel.length} bezette fases
          </span>
        </div>
        {funnel.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">Geen actieve objecten in de Object Pipeline.</p>
        ) : (
          <div className="space-y-2">
            {funnel.map((rij) => {
              const max = Math.max(1, ...funnel.map(item => item.aantal));
              const pct = (rij.aantal / max) * 100;
              return (
                <div key={rij.fase} className="flex items-center gap-3">
                  <div className="w-32 sm:w-44 text-xs text-muted-foreground shrink-0 truncate" title={rij.fase}>{rij.fase}</div>
                  <div className="flex-1 h-7 bg-muted/40 rounded-md overflow-hidden">
                    <div
                      className="h-full flex items-center px-2 text-xs font-medium font-mono-data bg-accent/70 text-accent-foreground transition-all"
                      style={{ width: `${Math.max(pct, 4)}%` }}
                    >
                      {rij.aantal}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
'''
if s.count(old) != 1:
    raise SystemExit(f'expected 1 reporting block, got {s.count(old)}')
s = s.replace(old, new, 1)
s = s.replace('  TrendingUp, Award, Target, Activity, Users, Building2, Trophy, ArrowDown,\n', '  TrendingUp, Award, Target, Activity, Users, Building2, Trophy,\n')
p.write_text(s)

# Strengthen source regression.
t = Path('src/test/unifiedVisibleTrajectory.test.ts')
ts = t.read_text()
needle = "    expect(source).not.toContain('DEAL_FASE_LABELS');\n"
replacement = "    expect(source).not.toContain('DEAL_FASE_LABELS');\n    expect(source).not.toContain('conversiePct');\n    expect(source).not.toContain('leads →');\n    expect(source).toContain('Huidige verdeling van actieve objecten');\n"
if ts.count(needle) != 1:
    raise SystemExit('report test anchor missing')
ts = ts.replace(needle, replacement, 1)
t.write_text(ts)
