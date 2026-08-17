-- Reaplica as categorias aceitas nas saidas/vendas modulares.
-- Corrige bancos em que a categoria privacy_screen_protector ainda nao esta nas CHECK constraints.

alter table public.product_model_templates
  drop constraint if exists product_model_templates_category_chk;

alter table public.product_model_templates
  add constraint product_model_templates_category_chk
  check (category in (
    'charger',
    'earphone',
    'bluetooth_earphone',
    'screen_protector',
    'privacy_screen_protector',
    'cable',
    'case',
    'keyboard',
    'other'
  ));

alter table public.product_outflows
  drop constraint if exists product_outflows_category_chk;

alter table public.product_outflows
  add constraint product_outflows_category_chk
  check (category in (
    'charger',
    'earphone',
    'bluetooth_earphone',
    'screen_protector',
    'privacy_screen_protector',
    'cable',
    'case',
    'keyboard',
    'other'
  ));
