-- Private object storage for generated PNG/SVG assets.
insert into storage.buckets (id, name, public, file_size_limit)
values ('logo-files', 'logo-files', false, 52428800)
on conflict (id) do nothing;
