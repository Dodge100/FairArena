/* ============================================================
   CREDIT TRANSACTION — LEDGER (INSERT ONLY, NEVER DELETE)
   ============================================================ */

-- One INITIAL_ALLOCATION per user
CREATE UNIQUE INDEX IF NOT EXISTS credit_txn_one_initial_allocation_per_user
ON "CreditTransaction" ("userId")
WHERE "type" = 'INITIAL_ALLOCATION';

-- Immutable trigger function (hard append-only)
CREATE OR REPLACE FUNCTION immutable_never()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION
    'This table is append-only. UPDATE and DELETE are forbidden.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS credit_transaction_no_update ON "CreditTransaction";
DROP TRIGGER IF EXISTS credit_transaction_no_delete ON "CreditTransaction";

CREATE TRIGGER credit_transaction_no_update
BEFORE UPDATE ON "CreditTransaction"
FOR EACH ROW
EXECUTE FUNCTION immutable_never();

CREATE TRIGGER credit_transaction_no_delete
BEFORE DELETE ON "CreditTransaction"
FOR EACH ROW
EXECUTE FUNCTION immutable_never();


/* ============================================================
   LOGS — UPDATE FORBIDDEN, DELETE ALLOWED AFTER 60 DAYS
   ============================================================ */

CREATE OR REPLACE FUNCTION logs_retention_guard()
RETURNS trigger AS $$
BEGIN
  IF OLD."createdAt" > now() - interval '60 days' THEN
    RAISE EXCEPTION
      'Logs can only be deleted after 60 days';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS logs_no_update ON "Logs";
DROP TRIGGER IF EXISTS logs_delete_guard ON "Logs";

CREATE TRIGGER logs_no_update
BEFORE UPDATE ON "Logs"
FOR EACH ROW
EXECUTE FUNCTION immutable_never();

CREATE TRIGGER logs_delete_guard
BEFORE DELETE ON "Logs"
FOR EACH ROW
EXECUTE FUNCTION logs_retention_guard();


/* ============================================================
   AUDIT LOGS — UPDATE FORBIDDEN, DELETE ALLOWED AFTER 180 DAYS
   ============================================================ */

CREATE OR REPLACE FUNCTION audit_log_retention_guard()
RETURNS trigger AS $$
BEGIN
  IF OLD."createdAt" > now() - interval '180 days' THEN
    RAISE EXCEPTION
      'Audit logs can only be deleted after 180 days';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

/* OrganizationAuditLog */
DROP TRIGGER IF EXISTS org_audit_no_update ON "OrganizationAuditLog";
DROP TRIGGER IF EXISTS org_audit_delete_guard ON "OrganizationAuditLog";

CREATE TRIGGER org_audit_no_update
BEFORE UPDATE ON "OrganizationAuditLog"
FOR EACH ROW
EXECUTE FUNCTION immutable_never();

CREATE TRIGGER org_audit_delete_guard
BEFORE DELETE ON "OrganizationAuditLog"
FOR EACH ROW
EXECUTE FUNCTION audit_log_retention_guard();

/* TeamAuditLog */
DROP TRIGGER IF EXISTS team_audit_no_update ON "TeamAuditLog";
DROP TRIGGER IF EXISTS team_audit_delete_guard ON "TeamAuditLog";

CREATE TRIGGER team_audit_no_update
BEFORE UPDATE ON "TeamAuditLog"
FOR EACH ROW
EXECUTE FUNCTION immutable_never();

CREATE TRIGGER team_audit_delete_guard
BEFORE DELETE ON "TeamAuditLog"
FOR EACH ROW
EXECUTE FUNCTION audit_log_retention_guard();

/* ProjectAuditLog */
DROP TRIGGER IF EXISTS project_audit_no_update ON "ProjectAuditLog";
DROP TRIGGER IF EXISTS project_audit_delete_guard ON "ProjectAuditLog";

CREATE TRIGGER project_audit_no_update
BEFORE UPDATE ON "ProjectAuditLog"
FOR EACH ROW
EXECUTE FUNCTION immutable_never();

CREATE TRIGGER project_audit_delete_guard
BEFORE DELETE ON "ProjectAuditLog"
FOR EACH ROW
EXECUTE FUNCTION audit_log_retention_guard();


/* ============================================================
   PAYMENT — UPDATABLE, NEVER DELETABLE
   ============================================================ */

CREATE OR REPLACE FUNCTION no_delete()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION
    'Deletion is forbidden for this table';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS payment_no_delete ON "Payment";

CREATE TRIGGER payment_no_delete
BEFORE DELETE ON "Payment"
FOR EACH ROW
EXECUTE FUNCTION no_delete();


/* ============================================================
   REPORT — UPDATABLE, NEVER DELETABLE
   ============================================================ */

DROP TRIGGER IF EXISTS report_no_delete ON "Report";

CREATE TRIGGER report_no_delete
BEFORE DELETE ON "Report"
FOR EACH ROW
EXECUTE FUNCTION no_delete();


/* ============================================================
   PLAN — UPDATABLE, NEVER DELETABLE
   ============================================================ */

DROP TRIGGER IF EXISTS plan_no_delete ON "Plan";

CREATE TRIGGER plan_no_delete
BEFORE DELETE ON "Plan"
FOR EACH ROW
EXECUTE FUNCTION no_delete();


/* ============================================================
   USER — DELETE ALLOWED ONLY AFTER 90 DAYS OF SOFT DELETION
   ============================================================ */

CREATE OR REPLACE FUNCTION user_deletion_guard()
RETURNS trigger AS $$
BEGIN
  -- Must be soft deleted first
  IF OLD."isDeleted" = false THEN
    RAISE EXCEPTION
      'User must be soft-deleted before permanent deletion';
  END IF;

  -- deletedAt must exist
  IF OLD."deletedAt" IS NULL THEN
    RAISE EXCEPTION
      'deletedAt must be set before permanent deletion';
  END IF;

  -- Enforce 90-day grace period
  IF OLD."deletedAt" > now() - interval '90 days' THEN
    RAISE EXCEPTION
      'Users can only be permanently deleted after 90 days from soft deletion';
  END IF;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS user_delete_guard ON "User";

CREATE TRIGGER user_delete_guard
BEFORE DELETE ON "User"
FOR EACH ROW
EXECUTE FUNCTION user_deletion_guard();
