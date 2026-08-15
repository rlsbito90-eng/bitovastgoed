-- CRM MIG Build 1A: safe additive enums only.
-- Excludes object_status replacement and energielabel_v2 canonicalisation.

DO $$ BEGIN CREATE TYPE public.aanbiedingswijze AS ENUM ('off_market','stille_verkoop','openbaar','via_makelaar'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.acquisitie_status AS ENUM ('target_gevonden','eigenaar_achterhalen','eerste_benadering','follow_up_gepland','reactie_ontvangen','verkoopbereidheid_peilen','potentiele_verkooppositie','object_aangemaakt','niet_interessant'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.bieding_richting AS ENUM ('van_koper','van_verkoper','namens_verkoper','intern'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.biedingstatus AS ENUM ('concept','ontvangen','in_behandeling','tegenvoorstel_gedaan','aangepast_bod_gevraagd','geaccepteerd','afgewezen','ingetrokken','verlopen'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.biedingtype AS ENUM ('indicatief','openingsbod','voorwaardelijk','onvoorwaardelijk','eindbod','tegenvoorstel','verhoogd_bod','schriftelijk','mondeling'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.campagne_kanaal AS ENUM ('brief','bellen','linkedin','email','netwerk','anders'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.campagne_status AS ENUM ('concept','actief','gepauzeerd','afgerond'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.dealstructuur AS ENUM ('direct','jv','fonds','asset_deal','share_deal'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.eigenaar_bekend AS ENUM ('ja','nee','onbekend'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.transactietype AS ENUM ('losse_aankoop','portefeuille','jv','asset_deal','share_deal'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.voorbehoud_status AS ENUM ('geen','ja','onbekend','nader_te_bepalen'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE public.vr_calc_status AS ENUM ('concept','indicatief','gecontroleerd','voor_bieding','afgewezen','afgerond'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.vr_complexity_level AS ENUM ('laag','middel','hoog','zeer_hoog'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.vr_component_type AS ENUM ('woning','appartement','winkelruimte','kantoorruimte','bedrijfsruimte','bedrijfsunit','opslagruimte','kelder','parkeerplaats','garagebox','berging','horeca','maatschappelijk','ontwikkelgrond','overig','studio','kamer'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.vr_deal_score AS ENUM ('A','B','C','reject'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.vr_huurtype_voor_bieding AS ENUM ('huidig','markt','wws','handmatig'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.vr_input_reliability AS ENUM ('laag','middel','hoog'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.vr_object_type AS ENUM ('enkelvoudig','mixed_use'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.vr_ovb_allocation_method AS ENUM ('value','m2','manual','extern','strategy'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.vr_ovb_classification AS ENUM ('eigen_woning','woning_belegging','niet_woning','mixed_use','vrijgesteld','handmatig'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.vr_ovb_mode AS ENUM ('auto','manual','per_component'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.vr_quality_level AS ENUM ('eenvoudig','standaard','luxe','maatwerk'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.vr_rent_segment AS ENUM ('sociaal','middenhuur','vrije_sector','onbekend'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.vr_risk_level AS ENUM ('laag','middel','hoog'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.vr_strategy_type AS ENUM ('belegging','huur_optimaliseren','renoveren_verhuren','transformeren','splitsen','uitponden','verkopen_geheel','verkoop_per_unit','bedrijfsunits_los','buy_fix_hold','buy_fix_sell','buy_split_sell','buy_transform_hold','buy_transform_sell','sale_leaseback','herontwikkeling','overig'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.vr_view_mode AS ENUM ('begeleid','compact','expert'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TYPE public.taak_status ADD VALUE IF NOT EXISTS 'wacht_op_reactie';
ALTER TYPE public.taak_status ADD VALUE IF NOT EXISTS 'geannuleerd';
ALTER TYPE public.zoekprofiel_status ADD VALUE IF NOT EXISTS 'pauze';
ALTER TYPE public.off_market_status ADD VALUE IF NOT EXISTS 'interessant';
ALTER TYPE public.off_market_status ADD VALUE IF NOT EXISTS 'twijfel';
ALTER TYPE public.off_market_status ADD VALUE IF NOT EXISTS 'eigenaar_gevonden';
ALTER TYPE public.off_market_status ADD VALUE IF NOT EXISTS 'benaderd';
ALTER TYPE public.off_market_status ADD VALUE IF NOT EXISTS 'aanbod_ontvangen';
ALTER TYPE public.off_market_status ADD VALUE IF NOT EXISTS 'afgevallen';