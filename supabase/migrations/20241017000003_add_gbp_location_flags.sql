-- Add managed flag and label to GBP locations
alter table gbp_locations
  add column if not exists title text,
  add column if not exists is_managed boolean default false;

create index if not exists idx_gbp_locations_is_managed on gbp_locations(is_managed);
