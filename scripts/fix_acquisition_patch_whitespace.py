from pathlib import Path

path = Path('scripts/apply_acquisition_structure.py')
source = path.read_text()
old = """def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text()
    if old not in text:
        raise SystemExit(f'Pattern not found in {path}: {old[:120]!r}')
    file.write_text(text.replace(old, new, 1))
"""
new = """def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text()
    match = old
    if match not in text:
        # Enkele bestaande JSX-blokken zijn één spatie minder ingesprongen.
        # Accepteer uitsluitend die uniforme whitespace-drift; inhoud blijft strikt.
        one_space_less = '\\n'.join(
            line[1:] if line.startswith(' ') else line
            for line in old.split('\\n')
        )
        if one_space_less in text:
            match = one_space_less
        else:
            raise SystemExit(f'Pattern not found in {path}: {old[:120]!r}')
    file.write_text(text.replace(match, new, 1))
"""
if old not in source:
    raise SystemExit('replace_once helper not found')
path.write_text(source.replace(old, new, 1))
