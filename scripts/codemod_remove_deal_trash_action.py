from pathlib import Path

page = Path('src/pages/DealDetailPage.tsx')
test = Path('src/test/unifiedVisibleTrajectory.test.ts')
s = page.read_text()

def one(old: str, new: str, label: str):
    global s
    count = s.count(old)
    if count != 1:
        raise RuntimeError(f'{label}: verwacht exact 1 match, kreeg {count}')
    s = s.replace(old, new, 1)

one(
    "import { useParams, Link, useNavigate } from 'react-router-dom';",
    "import { useParams, Link } from 'react-router-dom';",
    'useNavigate import',
)
one(
    "  ArrowLeft, Pencil, Trash2, Star, Trophy, AlertCircle,",
    "  ArrowLeft, Pencil, Star, Trophy, AlertCircle,",
    'Trash2 import',
)
one(
    "import {\n  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,\n  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,\n} from '@/components/ui/alert-dialog';\n",
    "",
    'destructive dialog import',
)
one(
    "  const navigate = useNavigate();\n",
    "",
    'navigate const',
)
one(
    "  const handleDelete = async () => {\n    try {\n      await store.deleteDeal(deal.id);\n      toast.success('Deal gearchiveerd');\n      navigate('/deals');\n    } catch (err: any) {\n      toast.error(`Verwijderen mislukt: ${err.message ?? 'onbekende fout'}`);\n    }\n  };\n\n",
    "",
    'handleDelete',
)
one(
    "          <AlertDialog>\n            <AlertDialogTrigger asChild>\n              <button className=\"inline-flex items-center justify-center px-2.5 py-2 text-sm border border-destructive/30 rounded-md hover:bg-destructive/10 transition-colors text-destructive\" aria-label=\"Verwijderen\">\n                <Trash2 className=\"h-4 w-4\" />\n              </button>\n            </AlertDialogTrigger>\n            <AlertDialogContent>\n              <AlertDialogHeader>\n                <AlertDialogTitle>Deal verwijderen?</AlertDialogTitle>\n                <AlertDialogDescription>Verwijdert deze deal uit alle lijsten (soft delete). Het record blijft in de database staan voor herstel.</AlertDialogDescription>\n              </AlertDialogHeader>\n              <AlertDialogFooter>\n                <AlertDialogCancel>Annuleren</AlertDialogCancel>\n                <AlertDialogAction onClick={handleDelete} className=\"bg-destructive text-destructive-foreground hover:bg-destructive/90\">Verwijderen</AlertDialogAction>\n              </AlertDialogFooter>\n            </AlertDialogContent>\n          </AlertDialog>\n",
    "",
    'destructive delete UI',
)
page.write_text(s)

# Regressie: Deal-detail heeft één duidelijke lifecycle-actie: archiveren/herstellen.
t = test.read_text()
needle = "    expect(source).not.toContain('DealKandidatenSectie');\n"
if t.count(needle) != 1:
    raise RuntimeError(f'test insertion point: verwacht 1, kreeg {t.count(needle)}')
replacement = needle + "    expect(source).toContain('Archiveer deal');\n    expect(source).not.toContain('Deal verwijderen?');\n    expect(source).not.toContain('Trash2');\n    expect(source).not.toContain('handleDelete');\n"
t = t.replace(needle, replacement, 1)
test.write_text(t)
