-- Admin-safe user directory and role assignment.

create or replace function public.list_user_profiles()
returns table (
  user_id uuid,
  email text,
  display_name text,
  role public.user_role,
  is_blocked boolean,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if public.current_user_role() not in ('admin', 'superadmin') then
    raise exception 'Administrator access required.';
  end if;

  return query
  select
    profile.id,
    auth_user.email::text,
    profile.display_name,
    profile.role,
    profile.is_blocked,
    profile.created_at
  from public.profiles profile
  join auth.users auth_user on auth_user.id = profile.id
  order by profile.created_at desc;
end;
$$;

create or replace function public.set_user_role(
  p_user_id uuid,
  p_role public.user_role
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  caller_role public.user_role := public.current_user_role();
  target_role public.user_role;
begin
  if caller_id is null then
    raise exception 'Authentication required.';
  end if;

  if caller_role not in ('admin', 'superadmin') then
    raise exception 'Administrator access required.';
  end if;

  if p_user_id = caller_id then
    raise exception 'You cannot change your own role.';
  end if;

  select profile.role
  into target_role
  from public.profiles profile
  where profile.id = p_user_id
  for update;

  if not found then
    raise exception 'User not found.';
  end if;

  if caller_role = 'admin' and (
    target_role in ('admin', 'superadmin')
    or p_role in ('admin', 'superadmin')
  ) then
    raise exception 'Only a superadmin can manage administrator roles.';
  end if;

  update public.profiles
  set role = p_role
  where id = p_user_id;
end;
$$;

revoke all on function public.list_user_profiles() from public;
revoke all on function public.set_user_role(uuid, public.user_role) from public;

grant execute on function public.list_user_profiles() to authenticated;
grant execute on function public.set_user_role(uuid, public.user_role) to authenticated;

