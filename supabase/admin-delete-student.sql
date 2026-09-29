-- Only an administrator can delete a student. Counselors can still read and update records.
-- Run once if students_all was created before this split.

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (
        select 1
        from public.profiles
        where id = auth.uid()
          and role = 'admin'
    );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

drop policy if exists students_all on public.students;
drop policy if exists students_select on public.students;
drop policy if exists students_insert on public.students;
drop policy if exists students_update on public.students;
drop policy if exists students_delete on public.students;

create policy students_select on public.students
    for select to authenticated
    using (public.is_staff());

create policy students_insert on public.students
    for insert to authenticated
    with check (public.is_staff());

create policy students_update on public.students
    for update to authenticated
    using (public.is_staff())
    with check (public.is_staff());

create policy students_delete on public.students
    for delete to authenticated
    using (public.is_admin());
