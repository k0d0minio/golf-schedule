CREATE TABLE day (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  date_iso   TEXT NOT NULL,
  weekday    TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX day_tenant_date_unique
  ON day (tenant_id, date_iso);

ALTER TABLE day ENABLE ROW LEVEL SECURITY;

CREATE POLICY "day: members can select"
  ON day FOR SELECT TO authenticated
  USING (is_tenant_member(tenant_id));

-- Days are auto-created by the system (service role) on visit.
-- No INSERT/UPDATE/DELETE policies for authenticated users.
