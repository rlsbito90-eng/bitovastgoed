from pathlib import Path
import re

path = Path('src/components/vastgoedrekenen/ResultaatKaart.tsx')
source = path.read_text()

import_anchor = "import { buildScenarioReadiness } from '@/lib/vastgoedrekenen/readiness';\n"
if "import UitkomstOpbouw from './UitkomstOpbouw';" not in source:
    if import_anchor not in source:
        raise SystemExit('import anchor not found')
    source = source.replace(import_anchor, import_anchor + "import UitkomstOpbouw from './UitkomstOpbouw';\n", 1)

binding_pattern = re.compile(
    r"\n  const residualBindingLabel = residual\?\.bindingTarget === 'winst_op_kosten'.*?\n        : 'Geen doelwinst';",
    re.S,
)
source, binding_count = binding_pattern.subn('', source, count=1)
if binding_count not in (0, 1):
    raise SystemExit(f'unexpected binding label replacement count: {binding_count}')

block_pattern = re.compile(
    r"\n        \{residual && \(\n          <div className=\"rounded-md border border-primary/30 bg-primary/5 p-3 space-y-3\">.*?\n        \)\}\n\n        \{!compact &&",
    re.S,
)
replacement = "\n        <UitkomstOpbouw scenario={s} outputs={o} />\n\n        {!compact &&"
source, block_count = block_pattern.subn(replacement, source, count=1)
if block_count != 1:
    raise SystemExit(f'outcome block replacement count: {block_count}')

path.write_text(source)
