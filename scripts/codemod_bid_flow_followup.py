from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    p = Path(path)
    s = p.read_text()
    if old not in s:
        raise SystemExit(f"Expected fragment not found in {path}: {old[:140]!r}")
    p.write_text(s.replace(old, new, 1))


# Candidate dialog must not overwrite canonical bid projections.
replace_once(
    "src/components/pipeline/PipelineKandidaatDialog.tsx",
    "        'bezichtigingDatum', 'biedingBedrag', 'biedingVoorwaarden', 'gewensteLevering',",
    "        'bezichtigingDatum',",
)
replace_once(
    "src/components/pipeline/PipelineKandidaatDialog.tsx",
    '''          <TabsContent value="bieding" className="space-y-4 pt-4">
            <div className="rounded-md border border-border bg-muted/30 p-4 space-y-3">''',
    '''          <TabsContent value="bieding" className="space-y-4 pt-4">
            <div className="max-w-sm">
              <Label>Bezichtiging-datum</Label>
              <Input type="date" value={form.bezichtigingDatum ?? ''} onChange={e => set('bezichtigingDatum', e.target.value)} />
              <p className="text-[11px] text-muted-foreground mt-1">Kandidaatvoortgang; staat los van biedingsvoorwaarden.</p>
            </div>
            <div className="rounded-md border border-border bg-muted/30 p-4 space-y-3">''',
)

# Deal picker in offer form may not leak legacy deal.fase.
replace_once(
    "src/components/biedingen/OfferFormDialog.tsx",
    "      secundair: d.fase,\n      searchHaystack: norm([obj?.titel, obj?.adres, d.fase].filter(Boolean).join(' ')),",
    "      secundair: 'Concrete transactie',\n      searchHaystack: norm([obj?.titel, obj?.adres, 'concrete transactie'].filter(Boolean).join(' ')),",
)

# Projection is always based on the latest buyer position, even when editing old history.
replace_once(
    "src/hooks/useBiedingen.tsx",
    "import { getOfferProgressTarget, shouldAdvanceCandidate } from '@/lib/biedingen/progression';",
    "import { getNegotiationPositions, getOfferProgressTarget, shouldAdvanceCandidate } from '@/lib/biedingen/progression';",
)
replace_once(
    "src/hooks/useBiedingen.tsx",
    '''    const existing = pipelineKandidaten.find(k => k.objectId === bieding.objectId && k.relatieId === bieding.relatieId);
    const buyerProjection: Partial<PipelineKandidaat> = bieding.richting === 'van_koper'
      ? {
          biedingBedrag: bieding.bedrag ?? undefined,
          biedingVoorwaarden: bieding.voorwaarden ?? undefined,
          gewensteLevering: bieding.gewensteLevering ?? undefined,
          ...(bieding.financieringsvoorbehoud === 'ja' ? { financieringsvoorbehoud: true } : {}),
          ...(bieding.financieringsvoorbehoud === 'geen' ? { financieringsvoorbehoud: false } : {}),
        }
      : {};''',
    '''    const existing = pipelineKandidaten.find(k => k.objectId === bieding.objectId && k.relatieId === bieding.relatieId);
    const offerUniverse = [...items.filter(item => item.id !== bieding.id), bieding];
    const latestBuyer = getNegotiationPositions(offerUniverse)
      .find(position => position.relatieId === bieding.relatieId)?.latestBuyer ?? null;
    const buyerProjection: Partial<PipelineKandidaat> = latestBuyer
      ? {
          biedingBedrag: latestBuyer.bedrag ?? undefined,
          biedingVoorwaarden: latestBuyer.voorwaarden ?? undefined,
          gewensteLevering: latestBuyer.gewensteLevering ?? undefined,
          ...(latestBuyer.financieringsvoorbehoud === 'ja' ? { financieringsvoorbehoud: true } : {}),
          ...(latestBuyer.financieringsvoorbehoud === 'geen' ? { financieringsvoorbehoud: false } : {}),
        }
      : {};''',
)
replace_once(
    "src/hooks/useBiedingen.tsx",
    "  }, [pipelineKandidaten, addPipelineKandidaat, updatePipelineKandidaat]);\n\n  const create",
    '''  }, [items, pipelineKandidaten, addPipelineKandidaat, updatePipelineKandidaat]);

  const syncKandidaatVeilig = useCallback(async (bieding: Bieding) => {
    try {
      await syncKandidaatUitBieding(bieding);
    } catch (e) {
      // De bieding zelf is de bron en moet nooit dubbel worden aangemaakt omdat
      // een afgeleide pipelineprojectie faalt. Laat de save slagen en log de drift.
      console.warn('Bieding opgeslagen; kandidaat-pipeline synchronisatie overgeslagen:', e);
    }
  }, [syncKandidaatUitBieding]);

  const create''',
)
replace_once("src/hooks/useBiedingen.tsx", "await syncKandidaatUitBieding(created);", "await syncKandidaatVeilig(created);")
replace_once("src/hooks/useBiedingen.tsx", "  }, [fetch, syncKandidaatUitBieding]);\n\n  const update", "  }, [fetch, syncKandidaatVeilig]);\n\n  const update")
replace_once("src/hooks/useBiedingen.tsx", "await syncKandidaatUitBieding(updated);", "await syncKandidaatVeilig(updated);")
replace_once("src/hooks/useBiedingen.tsx", "  }, [fetch, syncKandidaatUitBieding]);\n\n  const remove", "  }, [fetch, syncKandidaatVeilig]);\n\n  const remove")
replace_once("src/hooks/useBiedingen.tsx", "await syncKandidaatUitBieding({ ...bieding, status: 'geaccepteerd' });", "await syncKandidaatVeilig({ ...bieding, status: 'geaccepteerd' });")
replace_once("src/hooks/useBiedingen.tsx", "  }, [items, fetch, syncKandidaatUitBieding]);", "  }, [items, fetch, syncKandidaatVeilig]);")

print('Bid-flow follow-up codemod completed')
