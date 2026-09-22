-- Dedicated category-tree synchronization for the local-first workspace.
-- This keeps folder loading independent from the larger workspace bootstrap.

create or replace function public.get_category_tree()
returns table (
  id uuid,
  parent_id uuid,
  name text,
  kind public.category_kind,
  path text,
  sort_order integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
begin
  if caller_id is null or not exists (
    select 1
    from public.profiles profile
    where profile.id = caller_id
      and profile.is_approved
      and not profile.is_blocked
  ) then
    raise exception 'Approved account required.';
  end if;

  return query
  with recursive tree as (
    select
      category.id,
      case
        when category.parent_id is null or parent.id is null or parent.is_archived then null
        else category.parent_id
      end as parent_id,
      category.name,
      category.kind,
      category.name::text as path,
      category.sort_order,
      array[category.id]::uuid[] as visited
    from public.categories category
    left join public.categories parent on parent.id = category.parent_id
    where not category.is_archived
      and (category.parent_id is null or parent.id is null or parent.is_archived)

    union all

    select
      child.id,
      child.parent_id,
      child.name,
      child.kind,
      (parent.path || ' / ' || child.name)::text,
      child.sort_order,
      parent.visited || child.id
    from public.categories child
    join tree parent on parent.id = child.parent_id
    where not child.is_archived
      and not child.id = any(parent.visited)
  )
  select tree.id, tree.parent_id, tree.name, tree.kind, tree.path, tree.sort_order
  from tree
  order by tree.path;
end;
$$;

revoke all on function public.get_category_tree() from public;
grant execute on function public.get_category_tree() to authenticated;

-- Make the new RPC visible to PostgREST immediately.
notify pgrst, 'reload schema';
