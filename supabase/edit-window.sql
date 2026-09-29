-- Fresh case notes, sessions, plans, files, call slips, and waivers can be
-- corrected for one hour. After that the row stays as it was saved.
-- Run once if these tables already exist.

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

drop trigger if exists case_history_edit_window on public.case_history;
create trigger case_history_edit_window
    before update or delete on public.case_history
    for each row execute function public.enforce_edit_window();

drop trigger if exists action_plans_edit_window on public.action_plans;
create trigger action_plans_edit_window
    before update or delete on public.action_plans
    for each row execute function public.enforce_edit_window();

drop trigger if exists session_logs_edit_window on public.session_logs;
create trigger session_logs_edit_window
    before update or delete on public.session_logs
    for each row execute function public.enforce_edit_window();

drop trigger if exists documents_edit_window on public.documents;
create trigger documents_edit_window
    before update or delete on public.documents
    for each row execute function public.enforce_edit_window();

drop trigger if exists call_slips_edit_window on public.call_slips;
create trigger call_slips_edit_window
    before update or delete on public.call_slips
    for each row execute function public.enforce_edit_window();

drop trigger if exists waivers_edit_window on public.waivers;
create trigger waivers_edit_window
    before update or delete on public.waivers
    for each row execute function public.enforce_edit_window();
