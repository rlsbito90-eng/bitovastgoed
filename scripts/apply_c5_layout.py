from pathlib import Path

path = Path('src/components/vastgoedrekenen/ScenarioEditor.tsx')
source = path.read_text()
old = 'className="grid grid-cols-1 lg:grid-cols-[220px_minmax(0,1fr)] xl:grid-cols-[240px_minmax(0,1fr)] gap-4 xl:gap-6 items-start"'
new = 'className="grid grid-cols-1 lg:grid-cols-[auto_minmax(0,1fr)] gap-3 xl:gap-4 items-start"'
if old not in source:
    raise SystemExit('desktop grid marker not found')
path.write_text(source.replace(old, new, 1))
