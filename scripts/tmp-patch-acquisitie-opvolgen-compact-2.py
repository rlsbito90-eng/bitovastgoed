from pathlib import Path

path = Path('src/components/offmarket/acquisitie/AcquisitieSelectieTab.tsx')
text = path.read_text()

replacements = [
    (
        '''<span className="text-[10px] text-accent whitespace-nowrap">\n                                Opvolging nodig\n                              </span>''',
        '''<span\n                                data-testid="acquisitie-rij-opvolging-nodig"\n                                className="text-[10px] text-accent whitespace-nowrap"\n                              >\n                                Opvolging nodig\n                              </span>''',
    ),
    (
        '''<span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium rounded border border-border bg-card text-muted-foreground whitespace-nowrap">\n                            <Sparkles className="h-3 w-3" /> AI {signaal.ai_score}\n                          </span>''',
        '''<span\n                            data-testid="acquisitie-rij-ai-score"\n                            className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium rounded border border-border bg-card text-muted-foreground whitespace-nowrap"\n                          >\n                            <Sparkles className="h-3 w-3" /> AI {signaal.ai_score}\n                          </span>''',
    ),
    (
        '''<p className="text-[11px] text-muted-foreground break-words">\n                        {r.blokkadeReden ?? r.info.reden}\n                      </p>''',
        '''<p\n                        data-testid="acquisitie-rij-redentekst"\n                        className="text-[11px] text-muted-foreground break-words"\n                      >\n                        {r.blokkadeReden ?? r.info.reden}\n                      </p>''',
    ),
    (
        '''size="sm"\n                      variant="secondary"\n                      onClick={() => openSignaalMetContext(signaal.id)}\n                      data-testid="acquisitie-selectie-open"''',
        '''size="sm"\n                      variant="outline"\n                      onClick={() => openSignaalMetContext(signaal.id)}\n                      data-testid="acquisitie-selectie-open"''',
    ),
]

for old, new in replacements:
    if old not in text:
        raise SystemExit(f'Expected fragment not found:\n{old}')
    text = text.replace(old, new, 1)

path.write_text(text)
