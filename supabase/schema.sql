-- Guidance records. Run once in the Supabase SQL editor for a new project.
-- Staff access is the only access: anon and authenticated clients see nothing
-- unless the signed-in user has a profiles row created from staff_invites.

create extension if not exists pgcrypto;

-- Invited emails. Insert a row here before creating the Auth user.
create table public.staff_invites (
    email     text primary key,
    full_name text not null,
    role      text not null check (role in ('admin', 'counselor')),
    created_at timestamptz not null default now()
);

create table public.profiles (
    id         uuid primary key references auth.users (id) on delete cascade,
    full_name  text not null,
    role       text not null check (role in ('admin', 'counselor')),
    created_at timestamptz not null default now()
);

create table public.school_settings (
    id          boolean primary key default true check (id),
    school_name text not null default 'School Guidance Office',
    office_name text not null default 'Guidance and Counseling Office'
);

insert into public.school_settings default values;

create table public.students (
    id                             uuid primary key default gen_random_uuid(),
    full_name                      text not null,
    grade_level                    text not null,
    section                        text not null,
    -- Male names are column K and female names are column N on the class record.
    -- Null only for students added before this column existed.
    sex                            text check (sex in ('male', 'female')),
    age                            integer check (age between 3 and 25),
    emergency_contact_name         text,
    emergency_contact_phone        text,
    emergency_contact_relationship text,
    status                         text not null default 'routine'
        check (status in ('routine', 'monitoring', 'critical', 'referred', 'closed')),
    -- The latest status note, copied onto the timeline row when status changes.
    status_note                    text,
    created_by                     uuid references public.profiles (id),
    created_at                     timestamptz not null default now(),
    updated_at                     timestamptz not null default now()
);

create index students_status_idx on public.students (status);
create index students_grade_idx on public.students (grade_level);
create index students_name_idx on public.students (full_name);

create table public.case_history (
    id           uuid primary key default gen_random_uuid(),
    student_id   uuid not null references public.students (id) on delete cascade,
    title        text not null,
    category     text not null check (category in ('case', 'sanction')),
    -- Kept so older rows still have a readable note. New entries also store the fields below.
    description  text,
    narrative    text,
    perpetrator  text,
    victim       text,
    additional_notes text,
    students_conference text,
    parental_conference text,
    occurred_on  date,
    recorded_by  uuid references public.profiles (id),
    created_at   timestamptz not null default now()
);

create index case_history_student_idx on public.case_history (student_id);

create table public.action_plans (
    id          uuid primary key default gen_random_uuid(),
    student_id  uuid not null references public.students (id) on delete cascade,
    goal        text not null,
    status      text not null default 'active' check (status in ('active', 'met', 'dropped')),
    target_date date,
    created_by  uuid references public.profiles (id),
    created_at  timestamptz not null default now()
);

create index action_plans_student_idx on public.action_plans (student_id);

create table public.session_logs (
    id           uuid primary key default gen_random_uuid(),
    student_id   uuid not null references public.students (id) on delete cascade,
    session_date date not null,
    session_type text not null check (session_type in ('routine', 'crisis', 'academic')),
    notes        text not null,
    counselor_id uuid references public.profiles (id),
    created_at   timestamptz not null default now()
);

create index session_logs_student_idx on public.session_logs (student_id, session_date desc);

-- Written by trigger, not by the client.
create table public.status_events (
    id          uuid primary key default gen_random_uuid(),
    student_id  uuid not null references public.students (id) on delete cascade,
    from_status text,
    to_status   text not null,
    description text,
    changed_by  uuid references public.profiles (id),
    created_at  timestamptz not null default now()
);

create index status_events_student_idx on public.status_events (student_id, created_at desc);

-- Written when status becomes critical. Counselors only acknowledge.
create table public.alerts (
    id               uuid primary key default gen_random_uuid(),
    student_id       uuid not null references public.students (id) on delete cascade,
    message          text not null,
    created_at       timestamptz not null default now(),
    acknowledged_at  timestamptz,
    acknowledged_by  uuid references public.profiles (id)
);

create index alerts_open_idx on public.alerts (created_at desc) where acknowledged_at is null;

create table public.documents (
    id              uuid primary key default gen_random_uuid(),
    student_id      uuid not null references public.students (id) on delete cascade,
    case_history_id uuid references public.case_history (id) on delete set null,
    doc_type        text not null check (doc_type in ('call_slip', 'waiver', 'case_file', 'other')),
    title           text not null,
    description     text,
    storage_path    text not null,
    created_by      uuid references public.profiles (id),
    created_at      timestamptz not null default now()
);

create index documents_student_idx on public.documents (student_id, created_at desc);

create table public.call_slips (
    id            uuid primary key default gen_random_uuid(),
    student_id    uuid not null references public.students (id) on delete cascade,
    scheduled_at  timestamptz not null,
    guardian_name text not null,
    reason        text not null,
    document_id   uuid references public.documents (id) on delete set null,
    created_by    uuid references public.profiles (id),
    created_at    timestamptz not null default now()
);

create index call_slips_student_idx on public.call_slips (student_id, scheduled_at desc);

create table public.waivers (
    id            uuid primary key default gen_random_uuid(),
    student_id    uuid not null references public.students (id) on delete cascade,
    guardian_name text not null,
    purpose       text not null,
    document_id   uuid references public.documents (id) on delete set null,
    created_by    uuid references public.profiles (id),
    created_at    timestamptz not null default now()
);

-- Security definer so policies can ask "is this user staff?" without
-- recursing through the profiles row-level policy.
create or replace function public.is_staff()
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
          and role in ('admin', 'counselor')
    );
$$;

revoke all on function public.is_staff() from public;
grant execute on function public.is_staff() to authenticated;

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

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    invite public.staff_invites%rowtype;
begin
    select * into invite
    from public.staff_invites
    where lower(email) = lower(new.email);

    if found then
        insert into public.profiles (id, full_name, role)
        values (new.id, invite.full_name, invite.role)
        on conflict (id) do nothing;
    end if;

    return new;
end;
$$;

create trigger on_auth_user_created
    after insert on auth.users
    for each row execute function public.handle_new_user();

-- updated_at has to be set before the row is written. The status log cannot
-- be written then: status_events points at the student, and that row does
-- not exist yet during a BEFORE INSERT trigger.
create or replace function public.prepare_student()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    new.updated_at := now();

    if tg_op = 'INSERT' and new.created_by is null then
        new.created_by := auth.uid();
    end if;

    return new;
end;
$$;

create or replace function public.log_student_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    if tg_op = 'INSERT' or new.status is distinct from old.status then
        insert into public.status_events (student_id, from_status, to_status, description, changed_by)
        values (
            new.id,
            case when tg_op = 'UPDATE' then old.status else null end,
            new.status,
            nullif(btrim(new.status_note), ''),
            auth.uid()
        );

        if new.status = 'critical'
           and (tg_op = 'INSERT' or old.status is distinct from 'critical') then
            insert into public.alerts (student_id, message)
            values (
                new.id,
                'Status changed to Critical / Intervention'
            );
        end if;
    end if;

    return null;
end;
$$;

create trigger students_prepare
    before insert or update on public.students
    for each row execute function public.prepare_student();

create trigger students_log_status
    after insert or update on public.students
    for each row execute function public.log_student_status();

-- Acknowledgement is the only client write allowed on an alert.
create or replace function public.protect_alert_row()
returns trigger
language plpgsql
as $$
begin
    if new.student_id is distinct from old.student_id
       or new.message is distinct from old.message
       or new.created_at is distinct from old.created_at then
        raise exception 'Only acknowledgement fields can change on an alert';
    end if;
    return new;
end;
$$;

create trigger alerts_protect
    before update on public.alerts
    for each row execute function public.protect_alert_row();

alter table public.staff_invites enable row level security;
alter table public.profiles enable row level security;
alter table public.school_settings enable row level security;
alter table public.students enable row level security;
alter table public.case_history enable row level security;
alter table public.action_plans enable row level security;
alter table public.session_logs enable row level security;
alter table public.status_events enable row level security;
alter table public.alerts enable row level security;
alter table public.documents enable row level security;
alter table public.call_slips enable row level security;
alter table public.waivers enable row level security;

-- Invites are dashboard-only. No policy for the browser roles.

create policy profiles_select on public.profiles
    for select to authenticated
    using (public.is_staff());

create policy school_settings_select on public.school_settings
    for select to authenticated
    using (public.is_staff());

create policy school_settings_update on public.school_settings
    for update to authenticated
    using (public.is_staff())
    with check (public.is_staff());

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

-- Counselors keep the record. Only an administrator can remove a student.
create policy students_delete on public.students
    for delete to authenticated
    using (public.is_admin());

-- Counselors can correct a fresh entry. After an hour the row stays as it was saved.
create or replace function public.enforce_edit_window()
returns trigger
language plpgsql
as $$
begin
    if old.created_at < now() - interval '1 hour' then
        raise exception 'This record can only be changed within an hour of when it was saved';
    end if;
    if tg_op = 'UPDATE' then
        new.created_at := old.created_at;
        return new;
    end if;
    return old;
end;
$$;

create trigger case_history_edit_window
    before update or delete on public.case_history
    for each row execute function public.enforce_edit_window();

create trigger action_plans_edit_window
    before update or delete on public.action_plans
    for each row execute function public.enforce_edit_window();

create trigger session_logs_edit_window
    before update or delete on public.session_logs
    for each row execute function public.enforce_edit_window();

create trigger documents_edit_window
    before update or delete on public.documents
    for each row execute function public.enforce_edit_window();

create trigger call_slips_edit_window
    before update or delete on public.call_slips
    for each row execute function public.enforce_edit_window();

create trigger waivers_edit_window
    before update or delete on public.waivers
    for each row execute function public.enforce_edit_window();

create policy case_history_all on public.case_history
    for all to authenticated
    using (public.is_staff())
    with check (public.is_staff());

create policy action_plans_all on public.action_plans
    for all to authenticated
    using (public.is_staff())
    with check (public.is_staff());

create policy session_logs_all on public.session_logs
    for all to authenticated
    using (public.is_staff())
    with check (public.is_staff());

create policy status_events_select on public.status_events
    for select to authenticated
    using (public.is_staff());

create policy alerts_select on public.alerts
    for select to authenticated
    using (public.is_staff());

-- Acknowledge only. Inserts come from the status trigger.
create policy alerts_acknowledge on public.alerts
    for update to authenticated
    using (public.is_staff())
    with check (public.is_staff());

create policy documents_all on public.documents
    for all to authenticated
    using (public.is_staff())
    with check (public.is_staff());

create policy call_slips_all on public.call_slips
    for all to authenticated
    using (public.is_staff())
    with check (public.is_staff());

create policy waivers_all on public.waivers
    for all to authenticated
    using (public.is_staff())
    with check (public.is_staff());

insert into storage.buckets (id, name, public)
values ('guidance-documents', 'guidance-documents', false)
on conflict (id) do nothing;

create policy guidance_documents_select on storage.objects
    for select to authenticated
    using (bucket_id = 'guidance-documents' and public.is_staff());

create policy guidance_documents_insert on storage.objects
    for insert to authenticated
    with check (bucket_id = 'guidance-documents' and public.is_staff());

create policy guidance_documents_update on storage.objects
    for update to authenticated
    using (bucket_id = 'guidance-documents' and public.is_staff())
    with check (bucket_id = 'guidance-documents' and public.is_staff());

create policy guidance_documents_delete on storage.objects
    for delete to authenticated
    using (bucket_id = 'guidance-documents' and public.is_staff());

do $$
begin
    alter publication supabase_realtime add table public.alerts;
exception
    when duplicate_object then null;
end $$;
