create schema if not exists migration_internal;
create table if not exists migration_internal.import_log (
  id bigserial primary key,
  table_name text not null,
  chunk_label text,
  rows_imported integer not null,
  created_at timestamptz not null default now()
);
revoke all on schema migration_internal from anon, authenticated;
revoke all on all tables in schema migration_internal from anon, authenticated;