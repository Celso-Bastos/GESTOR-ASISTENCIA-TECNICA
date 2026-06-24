-- Seed seguro da Fase 1.
-- Nao coloque dados reais, telefones reais, tokens reais ou chaves do Supabase aqui.
-- Este seed pode ser executado depois da migration. Se ainda nao existir nenhuma
-- organizacao, ele nao insere linhas em message_templates.

with default_templates (type, title, body) as (
  values
    (
      'maintenance_received'::public.message_type,
      'Manutencao recebida',
      'Ola, {{customer_name}}! Recebemos seu aparelho {{device_model}} para manutencao. Numero da ordem: {{order_number}}.'
    ),
    (
      'maintenance_ready'::public.message_type,
      'Manutencao pronta',
      'Ola, {{customer_name}}! Seu aparelho {{device_model}} esta pronto para retirada. Ordem: {{order_number}}.'
    ),
    (
      'maintenance_reminder'::public.message_type,
      'Lembrete de retirada',
      'Ola, {{customer_name}}! Passando para lembrar que sua manutencao da ordem {{order_number}} esta aguardando retirada.'
    ),
    (
      'delivery_today'::public.message_type,
      'Entrega prevista para hoje',
      'Ola, {{customer_name}}! A previsao de entrega da ordem {{order_number}} e hoje. Avisaremos se houver qualquer mudanca.'
    ),
    (
      'promotion_future'::public.message_type,
      'Promocao futura',
      'Template reservado para campanhas promocionais futuras. Use somente com consentimento adequado.'
    ),
    (
      'sales_future'::public.message_type,
      'Vendas futuras',
      'Template reservado para mensagens futuras de vendas. Nao usar no MVP 1.'
    )
)
insert into public.message_templates (organization_id, type, title, body)
select
  organizations.id,
  default_templates.type,
  default_templates.title,
  default_templates.body
from public.organizations
cross join default_templates
on conflict (organization_id, type) do nothing;
