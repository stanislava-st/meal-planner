-- =============================================================
-- Совместные списки (рецепты -> продукты) с realtime-синхронизацией
-- Выполнить ЦЕЛИКОМ в SQL-редакторе Supabase (Dashboard -> SQL Editor)
--
-- Скрипт можно запускать повторно. Типы recipe_id / product_id
-- определяются автоматически по типам recipes(id) и products(id).
-- ВНИМАНИЕ: в начале старые таблицы списков УДАЛЯЮТСЯ и создаются заново
-- (данные тестовых списков будут потеряны).
-- =============================================================

-- ---------- Чистый старт ----------

drop table if exists public.list_items cascade;
drop table if exists public.list_recipes cascade;
drop table if exists public.list_members cascade;
drop table if exists public.shopping_lists cascade;

-- ---------- Таблицы без внешних ключей к recipes/products ----------

create table public.shopping_lists (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
    share_token uuid unique default null,
    is_archived boolean not null default false,
    created_at timestamptz not null default now()
);

create table public.list_members (
    list_id uuid not null references public.shopping_lists (id) on delete cascade,
    user_id uuid not null references auth.users (id) on delete cascade,
    created_at timestamptz not null default now(),
    primary key (list_id, user_id)
);

-- list_recipes и list_items: типы внешних ключей подбираются автоматически
do $$
declare
    v_recipe_id_type text;
    v_product_id_type text;
begin
    select format_type(a.atttypid, a.atttypmod)
      into v_recipe_id_type
      from pg_attribute a
     where a.attrelid = 'public.recipes'::regclass
       and a.attname = 'id'
       and a.attnum > 0
       and not a.attisdropped;

    select format_type(a.atttypid, a.atttypmod)
      into v_product_id_type
      from pg_attribute a
     where a.attrelid = 'public.products'::regclass
       and a.attname = 'id'
       and a.attnum > 0
       and not a.attisdropped;

    if v_recipe_id_type is null or v_product_id_type is null then
        raise exception 'Не найдены таблицы recipes/products или их колонки id';
    end if;

    raise notice 'Типы ключей: recipe_id = %, product_id = %', v_recipe_id_type, v_product_id_type;

    execute format($f$
        create table public.list_recipes (
            id uuid primary key default gen_random_uuid(),
            list_id uuid not null references public.shopping_lists (id) on delete cascade,
            recipe_id %s not null references public.recipes (id) on delete cascade,
            portions integer not null default 1 check (portions > 0),
            created_at timestamptz not null default now()
        )
    $f$, v_recipe_id_type);

    execute format($f$
        create table public.list_items (
            id uuid primary key default gen_random_uuid(),
            list_id uuid not null references public.shopping_lists (id) on delete cascade,
            product_id %s references public.products (id) on delete set null,
            name text not null,
            unit text not null default '',
            qty numeric not null default 0,
            is_checked boolean not null default false,
            source text not null default 'manual' check (source in ('recipe', 'manual')),
            created_at timestamptz not null default now()
        )
    $f$, v_product_id_type);
end $$;

create index idx_list_recipes_list on public.list_recipes (list_id);
create index idx_list_items_list on public.list_items (list_id);
create index idx_list_members_user on public.list_members (user_id);
create index idx_shopping_lists_owner on public.shopping_lists (owner_id);

-- ---------- Функции (security definer — обходят RLS при проверке прав) ----------

-- Роль текущего пользователя в списке: 'owner' | 'member' | 'shared' | null
create or replace function public.list_role(p_list_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
    select case
        when exists (
            select 1 from public.shopping_lists l
            where l.id = p_list_id and l.owner_id = (select auth.uid())
        ) then 'owner'
        when exists (
            select 1 from public.list_members m
            where m.list_id = p_list_id and m.user_id = (select auth.uid())
        ) then 'member'
        when exists (
            select 1 from public.shopping_lists l
            where l.id = p_list_id and l.share_token is not null
        ) then 'shared'
        else null
    end;
$$;

-- Поиск списка по токену ссылки (для гостей и участников)
create or replace function public.get_shared_list(p_token uuid)
returns setof public.shopping_lists
language sql
stable
security definer
set search_path = public
as $$
    select * from public.shopping_lists where share_token = p_token;
$$;

-- Присоединение к списку по ссылке (для авторизованных)
create or replace function public.join_list_by_token(p_token uuid)
returns setof public.shopping_lists
language plpgsql
security definer
set search_path = public
as $$
declare
    v_list public.shopping_lists;
begin
    if auth.uid() is null then
        raise exception 'authentication required';
    end if;

    select * into v_list from public.shopping_lists where share_token = p_token;
    if not found then
        return;
    end if;

    insert into public.list_members (list_id, user_id)
    values (v_list.id, auth.uid())
    on conflict do nothing;

    return next v_list;
end;
$$;

grant execute on function public.list_role(uuid) to anon, authenticated;
grant execute on function public.get_shared_list(uuid) to anon, authenticated;
grant execute on function public.join_list_by_token(uuid) to authenticated;

-- ---------- RLS ----------

alter table public.shopping_lists enable row level security;
alter table public.list_recipes enable row level security;
alter table public.list_items enable row level security;
alter table public.list_members enable row level security;

-- shopping_lists: анониму напрямую не доступен (чтобы не утекли токены ссылок),
-- гость получает список только через get_shared_list(token)
--
-- ВАЖНО: владелец проверяется по КОЛОНКЕ строки, а не через list_role().
-- INSERT ... RETURNING (supabase-js: .insert().select()) проверяет новую строку
-- ещё и по SELECT-политике, при этом list_role(id) перечитывает shopping_lists
-- и НЕ видит строку, которая ещё вставляется (снапшот команды) -> возвращает
-- NULL -> политика отклоняет строку -> "new row violates row-level security policy".
drop policy if exists shopping_lists_select on public.shopping_lists;
create policy shopping_lists_select on public.shopping_lists
    for select to authenticated
    using (
        owner_id = (select auth.uid())
        or public.list_role(id) = 'member'
    );

drop policy if exists shopping_lists_insert on public.shopping_lists;
create policy shopping_lists_insert on public.shopping_lists
    for insert to authenticated
    with check (owner_id = (select auth.uid()));

drop policy if exists shopping_lists_update on public.shopping_lists;
create policy shopping_lists_update on public.shopping_lists
    for update to authenticated
    using (owner_id = (select auth.uid()))
    with check (owner_id = (select auth.uid()));

drop policy if exists shopping_lists_delete on public.shopping_lists;
create policy shopping_lists_delete on public.shopping_lists
    for delete to authenticated
    using (owner_id = (select auth.uid()));

-- list_recipes: чтение — владелец/участник/по ссылке; запись — владелец/участник
drop policy if exists list_recipes_select on public.list_recipes;
create policy list_recipes_select on public.list_recipes
    for select to anon, authenticated
    using (public.list_role(list_id) in ('owner', 'member', 'shared'));

drop policy if exists list_recipes_write on public.list_recipes;
create policy list_recipes_write on public.list_recipes
    for all to authenticated
    using (public.list_role(list_id) in ('owner', 'member'))
    with check (public.list_role(list_id) in ('owner', 'member'));

-- list_items: чтение — владелец/участник/по ссылке; запись — владелец/участник
drop policy if exists list_items_select on public.list_items;
create policy list_items_select on public.list_items
    for select to anon, authenticated
    using (public.list_role(list_id) in ('owner', 'member', 'shared'));

drop policy if exists list_items_write on public.list_items;
create policy list_items_write on public.list_items
    for all to authenticated
    using (public.list_role(list_id) in ('owner', 'member'))
    with check (public.list_role(list_id) in ('owner', 'member'));

-- list_members: видят владелец и участники; вставка — только через join_list_by_token
drop policy if exists list_members_select on public.list_members;
create policy list_members_select on public.list_members
    for select to authenticated
    using (public.list_role(list_id) in ('owner', 'member'));

drop policy if exists list_members_delete on public.list_members;
create policy list_members_delete on public.list_members
    for delete to authenticated
    using (user_id = (select auth.uid()) or public.list_role(list_id) = 'owner');

-- ---------- Каталог (recipes, recipe_ingredients, products, units): чтение ----------
-- Рецепты и продукты — общий каталог: авторизованным видно все
-- (в интерфейсе чужие рецепты помечаются как «общие», есть фильтр «только мои»).
-- Гостям по ссылке (anon) — только то, что входит в списки с активной ссылкой,
-- чтобы просмотр списка без входа был полноценным.
-- Запись в каталог (рецепты/продукты) остаётся только у владельцев записей.

drop policy if exists recipes_select_catalog on public.recipes;
create policy recipes_select_catalog on public.recipes
    for select to authenticated
    using (true);

drop policy if exists recipes_select_shared on public.recipes;
create policy recipes_select_shared on public.recipes
    for select to anon
    using (exists (
        select 1 from public.list_recipes lr
        where lr.recipe_id = recipes.id
          and public.list_role(lr.list_id) in ('owner', 'member', 'shared')
    ));

drop policy if exists recipe_ingredients_select_catalog on public.recipe_ingredients;
create policy recipe_ingredients_select_catalog on public.recipe_ingredients
    for select to authenticated
    using (true);

drop policy if exists recipe_ingredients_select_shared on public.recipe_ingredients;
create policy recipe_ingredients_select_shared on public.recipe_ingredients
    for select to anon
    using (exists (
        select 1 from public.list_recipes lr
        where lr.recipe_id = recipe_ingredients.recipe_id
          and public.list_role(lr.list_id) in ('owner', 'member', 'shared')
    ));

drop policy if exists products_select_catalog on public.products;
create policy products_select_catalog on public.products
    for select to authenticated
    using (true);

drop policy if exists products_select_shared on public.products;
create policy products_select_shared on public.products
    for select to anon
    using (
        exists (
            select 1 from public.list_items li
            where li.product_id = products.id
              and public.list_role(li.list_id) in ('owner', 'member', 'shared')
        )
        or exists (
            select 1 from public.recipe_ingredients ri
            where ri.product_id = products.id
              and exists (
                  select 1 from public.list_recipes lr
                  where lr.recipe_id = ri.recipe_id
                    and public.list_role(lr.list_id) in ('owner', 'member', 'shared')
              )
        )
    );

drop policy if exists units_select_catalog on public.units;
create policy units_select_catalog on public.units
    for select to anon, authenticated
    using (true);

-- ---------- Realtime ----------

do $$
begin
    alter publication supabase_realtime add table public.shopping_lists;
exception when others then null;
end $$;

do $$
begin
    alter publication supabase_realtime add table public.list_recipes;
exception when others then null;
end $$;

do $$
begin
    alter publication supabase_realtime add table public.list_items;
exception when others then null;
end $$;

-- =============================================================
-- ПРОВЕРКА: ниже должен вернуться список политик.
-- Если shopping_lists_insert НЕ виден — политики не создались.
-- =============================================================

select c.relname,
       c.relrowsecurity as rls_enabled
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public'
   and c.relname in ('shopping_lists', 'list_recipes', 'list_items', 'list_members')
 order by 1;

select tablename, policyname, cmd
  from pg_policies
 where schemaname = 'public'
   and tablename in ('shopping_lists', 'list_recipes', 'list_items', 'list_members',
                     'recipes', 'recipe_ingredients', 'products', 'units')
 order by tablename, policyname;
