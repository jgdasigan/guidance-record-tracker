-- A status change can include a short note. The note is saved on the timeline entry.
-- Run once if status_events was created before descriptions.

alter table public.students add column if not exists status_note text;
alter table public.status_events add column if not exists description text;

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
