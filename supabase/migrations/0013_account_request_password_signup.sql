-- Aplicação manual após 0012. Não altera usuários ou solicitações existentes.
begin;

alter table public.account_requests add column approval_email_sent_at timestamptz null;
comment on column public.account_requests.approval_email_sent_at is
  'Envio do aviso de acesso aprovado pelo Resend; não representa convite.';
comment on column public.account_requests.invite_sent_at is
  'Histórico de convites do fluxo antigo. Não usado em novos cadastros.';

create index account_requests_auth_user_created_idx
  on public.account_requests (auth_user_id, created_at desc, id desc)
  where auth_user_id is not null;

-- Sem parâmetros: o usuário só consulta seu próprio acesso. Consulta o Auth
-- atual, não claims antigos do JWT nem user_metadata editável pelo usuário.
create function public.get_account_access_status()
returns text language plpgsql stable security definer set search_path = '' as $$
declare
  metadata_status text;
  request_status text;
  review_started timestamptz;
begin
  if auth.uid() is null then return 'blocked'; end if;
  select raw_app_meta_data ->> 'account_status' into metadata_status
    from auth.users where id = auth.uid();
  if not found then return 'blocked'; end if;

  select status, review_started_at into request_status, review_started
    from public.account_requests where auth_user_id = auth.uid()
    order by created_at desc, id desc limit 1;

  if metadata_status = 'rejected' or request_status = 'rejected' then return 'rejected'; end if;
  if metadata_status = 'pending' or request_status = 'pending' then return 'pending'; end if;
  if review_started is not null then return 'blocked'; end if;
  -- Compatibilidade com contas anteriores à fase que não possuem metadata.
  if metadata_status is null then
    if request_status is null or request_status = 'approved' then return 'approved'; end if;
  elsif metadata_status = 'approved' and request_status = 'approved' then
    return 'approved';
  end if;
  return 'blocked';
end;
$$;
revoke all on function public.get_account_access_status() from public, anon;
grant execute on function public.get_account_access_status() to authenticated;

commit;
