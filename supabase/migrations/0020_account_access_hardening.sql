begin;

-- Populate only from an operator-reviewed list of legacy user IDs before rollout.
create table public.approved_legacy_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  approved_at timestamptz not null default now()
);
alter table public.approved_legacy_accounts enable row level security;
revoke all on public.approved_legacy_accounts from public, anon, authenticated;

create or replace function public.get_account_access_status()
returns text language sql stable security definer set search_path = '' as $$
  select coalesce((
    select case
      when u.raw_app_meta_data->>'account_status' = 'rejected' or r.status = 'rejected' then 'rejected'
      when u.raw_app_meta_data->>'account_status' = 'blocked' or r.review_started_at is not null then 'blocked'
      when u.raw_app_meta_data->>'account_status' = 'pending' or r.status = 'pending' then 'pending'
      when u.raw_app_meta_data->>'account_status' = 'approved' and r.status = 'approved' then 'approved'
      when u.raw_app_meta_data->>'account_status' is null and r.status is null
        and exists(select 1 from public.approved_legacy_accounts l where l.user_id = u.id) then 'approved'
      else 'blocked' end
    from auth.users u left join lateral (
      select status, review_started_at from public.account_requests
      where auth_user_id = u.id order by created_at desc, id desc limit 1
    ) r on true where u.id = auth.uid()
  ), 'blocked')
$$;

create or replace function public.is_org_member(org_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.get_account_access_status() = 'approved' and exists (
    select 1 from public.organization_members where organization_id = org_id and user_id = auth.uid()
  )
$$;

create or replace function public.can_manage_inventory_suppliers(p_org uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_org_member(p_org) and exists (
    select 1 from public.organization_members where organization_id = p_org and user_id = auth.uid()
    and role in ('owner','admin')
  )
$$;

create policy approval_required on public.profiles as restrictive for all to authenticated
using ((select public.get_account_access_status()) = 'approved')
with check ((select public.get_account_access_status()) = 'approved');
create policy approval_required on public.platform_admins as restrictive for select to authenticated
using ((select public.get_account_access_status()) = 'approved');
create policy approval_required on storage.objects as restrictive for all to authenticated
using (bucket_id <> 'organization-documents' or (select public.get_account_access_status()) = 'approved')
with check (bucket_id <> 'organization-documents' or (select public.get_account_access_status()) = 'approved');

commit;
