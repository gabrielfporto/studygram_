alter table public.competencies add column resource_url text
  check (resource_url is null or (length(resource_url)<=2048 and resource_url ~ '^https?://[^[:space:]]+$'));
alter table public.study_sessions drop constraint study_sessions_method_check;
alter table public.study_sessions add constraint study_sessions_method_check
  check (method in ('new','reading','recall','questions','case','explanation','priming'));
