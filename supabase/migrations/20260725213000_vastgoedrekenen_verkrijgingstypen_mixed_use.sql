-- Beschrijvende mixed-use typen voor de huidige situatie bij verkrijging.
-- Deze typen bepalen geen OVB-tarief; de fiscale classificatie blijft afzonderlijk.

alter table public.calculation_acquisition_components
  drop constraint if exists calculation_acquisition_components_component_type_check;

alter table public.calculation_acquisition_components
  add constraint calculation_acquisition_components_component_type_check
  check (component_type in (
    'woning', 'appartement', 'studio', 'kamer',
    'winkelruimte', 'kantoorruimte', 'bedrijfsruimte', 'bedrijfsunit',
    'opslagruimte', 'kelder', 'parkeerplaats', 'garagebox', 'berging',
    'horeca', 'maatschappelijk', 'ontwikkelgrond',
    'woon_winkelpand', 'woon_kantoorpand', 'woon_bedrijfspand',
    'winkel_kantoorpand', 'mixed_use', 'mixed_use_overig', 'overig'
  ));

comment on column public.calculation_acquisition_components.component_type is
  'Beschrijvend huidig pand-/gebruikstype bij verkrijging; bepaalt niet automatisch de OVB-classificatie.';
