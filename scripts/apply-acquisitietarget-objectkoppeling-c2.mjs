import fs from 'node:fs';

const path = 'src/pages/AcquisitieTargetDetailPage.tsx';
let source = fs.readFileSync(path, 'utf8');

const replace = (from, to) => {
  if (!source.includes(from)) throw new Error(`Pattern ontbreekt: ${from.slice(0, 100)}`);
  source = source.replace(from, to);
};

replace(
  "import AcquisitieTargetFormDialog from '@/components/forms/AcquisitieTargetFormDialog';",
  "import AcquisitieTargetFormDialog from '@/components/forms/AcquisitieTargetFormDialog';\nimport AcquisitieObjectPreflightDialog from '@/components/acquisitie/AcquisitieObjectPreflightDialog';",
);

replace(
  "  const { targets, campagnes, deleteTarget, converteerNaarObject } = useAcquisitie();",
  "  const { targets, campagnes, deleteTarget } = useAcquisitie();",
);

replace(
  "  const [bezig, setBezig] = useState(false);",
  "  const [preflightOpen, setPreflightOpen] = useState(false);",
);

const maakObjectStart = source.indexOf("  const maakObject = async () => {");
const verwijderStart = source.indexOf("  const verwijder = async () => {");
if (maakObjectStart === -1 || verwijderStart === -1 || verwijderStart <= maakObjectStart) {
  throw new Error('maakObject-functie niet gevonden');
}
source = source.slice(0, maakObjectStart) + source.slice(verwijderStart);

replace(
  "              <Button onClick={maakObject} disabled={bezig}><Building2 className=\"h-4 w-4 mr-1.5\" /> Maak Object</Button>",
  "              <Button onClick={() => setPreflightOpen(true)}><Building2 className=\"h-4 w-4 mr-1.5\" /> Naar Objecten</Button>",
);

replace(
  "      <AcquisitieTargetFormDialog open={editOpen} onOpenChange={setEditOpen} target={target} />",
  "      <AcquisitieTargetFormDialog open={editOpen} onOpenChange={setEditOpen} target={target} />\n      <AcquisitieObjectPreflightDialog open={preflightOpen} onOpenChange={setPreflightOpen} target={target} />",
);

fs.writeFileSync(path, source);
