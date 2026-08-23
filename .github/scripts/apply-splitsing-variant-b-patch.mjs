import fs from 'node:fs';

const path = 'src/components/offmarket/BriefVoorbereidenDialog.tsx';
let src = fs.readFileSync(path, 'utf8');

const from = "              Testvariant {initialBrief?.copy_variant_code ?? copyToewijzing.variantCode} · {initialBrief?.copy_variant_code ? 'vastgelegd' : 'controle'}\n";
const to = "              Testvariant {initialBrief?.copy_variant_code ?? copyToewijzing.variantCode} · {initialBrief?.copy_variant_code ? 'vastgelegd' : copyToewijzing.variantNaam.toLowerCase()}\n";

if (!src.includes(from)) throw new Error('Patchanker ontbreekt: testvariant rol-label');
src = src.replace(from, to);
fs.writeFileSync(path, src);
