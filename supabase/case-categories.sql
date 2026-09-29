-- Case history is either a case or a sanction. Each kind keeps its own notes.
-- Older incident, academic, family, and other rows become cases, and their description becomes the narrative.

alter table public.case_history add column if not exists narrative text;
alter table public.case_history add column if not exists perpetrator text;
alter table public.case_history add column if not exists victim text;
alter table public.case_history add column if not exists additional_notes text;
alter table public.case_history add column if not exists students_conference text;
alter table public.case_history add column if not exists parental_conference text;

alter table public.case_history alter column description drop not null;

update public.case_history
set narrative = description
where narrative is null
  and category in ('incident', 'academic', 'family', 'other');

update public.case_history
set category = 'case'
where category in ('incident', 'academic', 'family', 'other');

alter table public.case_history drop constraint if exists case_history_category_check;
alter table public.case_history
    add constraint case_history_category_check
    check (category in ('case', 'sanction'));
