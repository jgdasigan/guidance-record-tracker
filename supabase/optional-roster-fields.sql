-- Run once if students was created before class-list import.
-- The Electronic Class Record has name, grade, and section only.
-- Age and emergency contact stay empty until a counselor fills them in on the record.
alter table public.students alter column age drop not null;
alter table public.students alter column emergency_contact_name drop not null;
alter table public.students alter column emergency_contact_phone drop not null;

-- Class-list import stores male or female from the name columns.
alter table public.students add column if not exists sex text;
alter table public.students drop constraint if exists students_sex_check;
alter table public.students
    add constraint students_sex_check check (sex in ('male', 'female'));
