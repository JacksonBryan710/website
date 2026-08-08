-- CodeRabbit flagged that data migrations updating a project by
-- `where name = '...'` aren't provably safe, since name had no uniqueness
-- guarantee. Enforce it at the schema level so name-based matches in future
-- data migrations are safe rather than just safe-in-practice.
alter table public.projects add constraint projects_name_key unique (name);
