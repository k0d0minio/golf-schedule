-- =============================================================================
-- RLS Helper Functions
-- =============================================================================
-- These two functions are the standard building blocks for all table-level RLS
-- policies across this database.  Every application table that has a tenant_id
-- column should use them as shown in the template at the bottom of this file.
--
-- NOTE: The memberships table itself cannot use these helpers (circular
-- dependency), so its policies use inline EXISTS queries instead.
-- =============================================================================

-- Returns TRUE if the current authenticated user is a member of the tenant.
CREATE OR REPLACE FUNCTION is_tenant_member(t_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM memberships
    WHERE memberships.tenant_id = t_id
      AND memberships.user_id   = auth.uid()
  );
$$;

-- Returns TRUE if the current authenticated user is an editor of the tenant.
CREATE OR REPLACE FUNCTION is_tenant_editor(t_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM memberships
    WHERE memberships.tenant_id = t_id
      AND memberships.user_id   = auth.uid()
      AND memberships.role      = 'editor'
  );
$$;

-- =============================================================================
-- Rewire tenants SELECT policy to use the helper
-- =============================================================================

DROP POLICY IF EXISTS "Members can view their tenants" ON tenants;

CREATE POLICY "Members can view their tenants"
  ON tenants FOR SELECT TO authenticated
  USING (is_tenant_member(tenants.id));

-- =============================================================================
-- RLS PATTERN TEMPLATE (copy-paste for each new application table)
-- =============================================================================
--
-- ALTER TABLE <table> ENABLE ROW LEVEL SECURITY;
--
-- CREATE POLICY "<table>: members can select"
--   ON <table> FOR SELECT TO authenticated
--   USING (is_tenant_member(tenant_id));
--
-- CREATE POLICY "<table>: editors can insert"
--   ON <table> FOR INSERT TO authenticated
--   WITH CHECK (is_tenant_editor(tenant_id));
--
-- CREATE POLICY "<table>: editors can update"
--   ON <table> FOR UPDATE TO authenticated
--   USING (is_tenant_editor(tenant_id));
--
-- CREATE POLICY "<table>: editors can delete"
--   ON <table> FOR DELETE TO authenticated
--   USING (is_tenant_editor(tenant_id));
--
-- =============================================================================
