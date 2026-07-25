from pathlib import Path

validation_path = Path('src/lib/vastgoedrekenen/validation.ts')
source = validation_path.read_text()
old = "message: `De module vond een automatische tekstmatch op ${matchedText}. Dit is nog geen bevestigde dubbeling. Controleer of de algemene kostenpost dezelfde werkzaamheden en grondslag bevat als de componentkosten.`,"
new = "message: `Mogelijke dubbele kosteninvoer: de module vond een automatische tekstmatch op ${matchedText}. Dit is nog geen bevestigde dubbeling. Controleer of de algemene kostenpost dezelfde werkzaamheden en grondslag bevat als de componentkosten.`,"
if old not in source:
    raise SystemExit('duplicate-cost message not found')
validation_path.write_text(source.replace(old, new, 1))

ux_path = Path('src/test/ui/actionableValidationUx.test.ts')
ux = ux_path.read_text()
old_test = "    expect(list).toContain('Waarom gemeld');\n"
new_test = "    expect(list).toContain('detail.label');\n    expect(list).toContain('detail.value');\n"
if old_test not in ux:
    raise SystemExit('UI detail expectation not found')
ux_path.write_text(ux.replace(old_test, new_test, 1))
