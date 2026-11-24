-- Atualização 2. Aplicar manualmente após 0017, com Supabase Storage instalado.
begin;

alter table public.organizations
  add column warranty_document_path text,
  add column warranty_document_name text,
  add column warranty_document_updated_at timestamptz,
  add constraint organization_warranty_document_complete check (
    (warranty_document_path is null and warranty_document_name is null and warranty_document_updated_at is null)
    or (warranty_document_path is not null and warranty_document_name is not null
      and warranty_document_updated_at is not null
      and warranty_document_path ~ ('^' || id::text || '/warranty/[0-9a-f-]{36}\.pdf$')
      and warranty_document_name ~ '^[a-zA-Z0-9][a-zA-Z0-9._-]{0,119}\.pdf$')
  );

-- Bucket exclusivo para documentos das organizações, nunca público.
insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('organization-documents', 'organization-documents', false, 4194304, array['application/pdf'])
on conflict (id) do update set public = false, file_size_limit = 4194304,
  allowed_mime_types = array['application/pdf'];

create policy organization_documents_read on storage.objects
  for select to authenticated using (
    bucket_id = 'organization-documents' and exists (
      select 1 from public.organization_members m
      where m.user_id = (select auth.uid()) and m.organization_id::text = split_part(name, '/', 1)
    )
  );
create policy organization_documents_insert on storage.objects
  for insert to authenticated with check (
    bucket_id = 'organization-documents'
    and name ~ '^[0-9a-f-]{36}/warranty/[0-9a-f-]{36}\.pdf$'
    and exists (select 1 from public.organization_members m
      where m.user_id = (select auth.uid()) and m.organization_id::text = split_part(name, '/', 1)
        and m.role in ('owner', 'admin'))
  );
-- Sem UPDATE: cada upload recebe um UUID novo, sem sobrescrever o PDF vigente.
-- A limpeza só pode apagar objetos que não sejam o termo atual da organização.
create policy organization_documents_delete on storage.objects
  for delete to authenticated using (
    bucket_id = 'organization-documents'
    and exists (select 1 from public.organization_members m
      where m.user_id = (select auth.uid()) and m.organization_id::text = split_part(name, '/', 1)
        and m.role in ('owner', 'admin'))
    and not exists (select 1 from public.organizations o where o.warranty_document_path = storage.objects.name)
  );

-- Somente esta RPC troca o ponteiro. Não amplia permissões de UPDATE de organizations.
-- O compare-and-swap evita que duas substituições concorrentes removam o termo vencedor.
create function public.replace_organization_warranty_document(
  p_organization_id uuid, p_expected_path text, p_new_path text, p_name text
) returns boolean language plpgsql security definer set search_path = public, pg_temp as $$
declare v_previous text;
begin
  if auth.uid() is null or not exists (
    select 1 from public.organization_members where organization_id = p_organization_id
      and user_id = auth.uid() and role in ('owner', 'admin')
  ) then raise exception 'Organização não autorizada.' using errcode = '42501'; end if;
  if p_new_path is null or p_new_path !~ ('^' || p_organization_id::text || '/warranty/[0-9a-f-]{36}\.pdf$')
    or p_name is null or p_name !~ '^[a-zA-Z0-9][a-zA-Z0-9._-]{0,119}\.pdf$' then
    raise exception 'Documento inválido.';
  end if;
  select warranty_document_path into v_previous from public.organizations
    where id = p_organization_id for update;
  if not found then raise exception 'Organização não encontrada.'; end if;
  if v_previous is distinct from p_expected_path then return false; end if;
  if p_new_path = v_previous then raise exception 'Envie um novo arquivo.'; end if;
  if not exists (select 1 from storage.objects where bucket_id = 'organization-documents' and name = p_new_path) then
    raise exception 'Arquivo não encontrado no Storage.';
  end if;
  update public.organizations set warranty_document_path = p_new_path,
    warranty_document_name = p_name, warranty_document_updated_at = now()
    where id = p_organization_id;
  return true;
end;
$$;
revoke all on function public.replace_organization_warranty_document(uuid,text,text,text) from public, anon;
grant execute on function public.replace_organization_warranty_document(uuid,text,text,text) to authenticated;
commit;
