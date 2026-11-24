-- Somente leitura. Executar manualmente no SQL Editor após aplicar 0018.
select id, public, file_size_limit, allowed_mime_types
from storage.buckets where id = 'organization-documents';

select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public' and table_name = 'organizations'
  and column_name in ('warranty_document_path', 'warranty_document_name', 'warranty_document_updated_at')
order by column_name;

select policyname, cmd, roles, qual, with_check
from pg_policies where schemaname = 'storage' and tablename = 'objects'
order by policyname;

select c.relrowsecurity as rls_enabled
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'storage' and c.relname = 'objects';

select p.oid is not null as function_exists, p.prosecdef as security_definer,
  p.proconfig as function_settings,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_can_execute,
  has_function_privilege('anon', p.oid, 'EXECUTE') as anon_can_execute
from (values ('public.replace_organization_warranty_document(uuid,text,text,text)')) e(signature)
left join pg_proc p on p.oid = to_regprocedure(e.signature);
