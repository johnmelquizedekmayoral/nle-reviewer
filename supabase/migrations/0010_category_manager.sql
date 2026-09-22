-- Reliable, staff-only category creation for the local Question Manager.

-- Archived folders should not reserve a name forever. Only active siblings
-- need unique names.
drop index if exists public.categories_unique_sibling_name;
create unique index categories_unique_sibling_name
  on public.categories (
    coalesce(parent_id, '00000000-0000-0000-0000-000000000000'::uuid),
    lower(name)
  )
  where not is_archived;

create or replace function public.create_category_folder(
  p_name text,
  p_parent_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_role public.user_role;
  folder_name text := pg_catalog.btrim(coalesce(p_name, ''));
  folder_slug text;
  next_sort_order integer;
  created public.categories;
begin
  select profile.role into caller_role
  from public.profiles profile
  where profile.id = (select auth.uid())
    and profile.is_approved
    and not profile.is_blocked;

  if caller_role not in ('instructor', 'admin', 'superadmin') then
    raise exception 'Staff access required.';
  end if;

  if folder_name = '' or pg_catalog.char_length(folder_name) > 120 then
    raise exception 'Enter a folder name up to 120 characters.';
  end if;

  if p_parent_id is not null and not exists (
    select 1 from public.categories category
    where category.id = p_parent_id and not category.is_archived
  ) then
    raise exception 'The selected parent folder no longer exists.';
  end if;

  folder_slug := pg_catalog.btrim(
    pg_catalog.regexp_replace(pg_catalog.lower(folder_name), '[^a-z0-9]+', '-', 'g'),
    '-'
  );
  if folder_slug = '' then folder_slug := 'category'; end if;

  select coalesce(max(category.sort_order), -1) + 1 into next_sort_order
  from public.categories category
  where category.parent_id is not distinct from p_parent_id;

  insert into public.categories (name, slug, kind, parent_id, sort_order)
  values (folder_name, folder_slug, 'folder', p_parent_id, next_sort_order)
  returning * into created;

  return jsonb_build_object(
    'id', created.id,
    'parent_id', created.parent_id,
    'name', created.name,
    'kind', created.kind,
    'sort_order', created.sort_order
  );
exception
  when unique_violation then
    raise exception using errcode = '23505', message = 'A folder with that name already exists in this location.';
end;
$$;

revoke all on function public.create_category_folder(text, uuid) from public;
grant execute on function public.create_category_folder(text, uuid) to authenticated;

-- Move, rename, or safely archive an entire folder branch. Archiving keeps old
-- quiz snapshots and foreign keys valid while removing the branch from the bank.
create or replace function public.manage_category_branch(
  p_category_id uuid,
  p_action text,
  p_destination_id uuid default null,
  p_name text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_role public.user_role;
  category_record public.categories;
  cleaned_name text := pg_catalog.btrim(coalesce(p_name, ''));
  cleaned_slug text;
  next_sort_order integer;
  branch_ids uuid[];
  changed_questions integer := 0;
begin
  select profile.role into caller_role
  from public.profiles profile
  where profile.id = (select auth.uid())
    and profile.is_approved
    and not profile.is_blocked;

  if caller_role not in ('instructor', 'admin', 'superadmin') then
    raise exception 'Staff access required.';
  end if;

  select category.* into category_record
  from public.categories category
  where category.id = p_category_id and not category.is_archived;

  if not found then raise exception 'The selected folder no longer exists.'; end if;

  with recursive branch as (
    select category.id
    from public.categories category
    where category.id = p_category_id and not category.is_archived
    union all
    select child.id
    from public.categories child
    join branch parent on parent.id = child.parent_id
    where not child.is_archived
  )
  select pg_catalog.array_agg(branch.id) into branch_ids from branch;

  if p_action = 'move' then
    if p_destination_id = any(branch_ids) then
      raise exception 'A folder cannot be moved inside itself or one of its subfolders.';
    end if;
    if p_destination_id is not null and not exists (
      select 1 from public.categories destination
      where destination.id = p_destination_id and not destination.is_archived
    ) then
      raise exception 'The destination folder no longer exists.';
    end if;
    if exists (
      select 1 from public.categories sibling
      where sibling.parent_id is not distinct from p_destination_id
        and sibling.id <> p_category_id
        and not sibling.is_archived
        and pg_catalog.lower(sibling.name) = pg_catalog.lower(category_record.name)
    ) then
      raise exception 'A folder with that name already exists in the destination.';
    end if;

    select coalesce(max(category.sort_order), -1) + 1 into next_sort_order
    from public.categories category
    where category.parent_id is not distinct from p_destination_id
      and not category.is_archived;

    update public.categories
    set parent_id = p_destination_id, sort_order = next_sort_order
    where id = p_category_id;

    return jsonb_build_object('action', 'move', 'category_id', p_category_id, 'parent_id', p_destination_id);
  elsif p_action = 'rename' then
    if cleaned_name = '' or pg_catalog.char_length(cleaned_name) > 120 then
      raise exception 'Enter a folder name up to 120 characters.';
    end if;
    cleaned_slug := pg_catalog.btrim(
      pg_catalog.regexp_replace(pg_catalog.lower(cleaned_name), '[^a-z0-9]+', '-', 'g'),
      '-'
    );
    if cleaned_slug = '' then cleaned_slug := 'category'; end if;

    update public.categories
    set name = cleaned_name, slug = cleaned_slug
    where id = p_category_id;

    return jsonb_build_object('action', 'rename', 'category_id', p_category_id, 'name', cleaned_name);
  elsif p_action = 'delete' then
    update public.questions
    set status = 'archived'
    where category_id = any(branch_ids) and status <> 'archived';
    get diagnostics changed_questions = row_count;

    update public.categories
    set is_archived = true
    where id = any(branch_ids);

    return jsonb_build_object(
      'action', 'delete',
      'category_id', p_category_id,
      'folders_archived', pg_catalog.array_length(branch_ids, 1),
      'questions_archived', changed_questions
    );
  else
    raise exception 'Invalid category action.';
  end if;
exception
  when unique_violation then
    raise exception using errcode = '23505', message = 'A folder with that name already exists in this location.';
end;
$$;

revoke all on function public.manage_category_branch(uuid, text, uuid, text) from public;
grant execute on function public.manage_category_branch(uuid, text, uuid, text) to authenticated;
