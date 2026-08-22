from pathlib import Path

path = Path('src/components/offmarket/acquisitie/AcquisitieDossierRij.tsx')
text = path.read_text()

old = '''        "[&_[data-testid='acquisitie-rij-redentekst']]:hidden",\n        "[&_[data-testid='kadasteradvies-badge']]:hidden",\n        "[&_[data-testid='bag-kaart-badge']]:hidden",\n        "[&_span:has(.lucide-sparkles)]:hidden",'''
new = '''        "[&_[data-testid='acquisitie-rij-redentekst']]:hidden",\n        "[&_[data-testid='acquisitie-rij-opvolging-nodig']]:hidden",\n        "[&_[data-testid='acquisitie-rij-ai-score']]:hidden",\n        "[&_[data-testid='kadasteradvies-badge']]:hidden",\n        "[&_[data-testid='bag-kaart-badge']]:hidden",'''

if old not in text:
    raise SystemExit('Expected selector block not found')
text = text.replace(old, new, 1)
path.write_text(text)
