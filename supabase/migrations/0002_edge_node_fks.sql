-- Add composite FKs so edges can't reference nodes that don't exist in the same warren.
-- Run this on databases created from 0001 BEFORE the FK was added. Idempotent.
-- (Fresh databases get the constraint directly from 0001.)

-- Clean up any pre-existing orphan edges so the constraint can be added.
delete from edge e
where not exists (
  select 1 from node n where n.warren_id = e.warren_id and n.id = e.source
)
or not exists (
  select 1 from node n where n.warren_id = e.warren_id and n.id = e.target
);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'edge_source_node_fk'
  ) then
    alter table edge
      add constraint edge_source_node_fk
      foreign key (warren_id, source) references node (warren_id, id) on delete cascade;
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'edge_target_node_fk'
  ) then
    alter table edge
      add constraint edge_target_node_fk
      foreign key (warren_id, target) references node (warren_id, id) on delete cascade;
  end if;
end $$;
