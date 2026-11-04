-- Search, autocomplete and integrity rules that Prisma cannot express in schema.prisma.

-- Text normalisation. Must match normalizeText() in packages/core/src/normalize.ts
CREATE OR REPLACE FUNCTION mm_normalize(input TEXT) RETURNS TEXT
LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT btrim(regexp_replace(regexp_replace(regexp_replace(
    replace(replace(replace(replace(lower(coalesce(input, '')), 'ä', 'ae'), 'ö', 'oe'), 'ü', 'ue'), 'ß', 'ss'),
    '/-?in\M|/-?innen\M|\(in\)|\*in\M|:in\M', '', 'g'),
    '[^a-z0-9]+', ' ', 'g'), '\s+', ' ', 'g'))
$$;

-- Trigram indexes for fuzzy autocomplete (pg_trgm)
CREATE INDEX "Qualification_normalizedName_trgm_idx" ON "Qualification" USING gin ("normalizedName" gin_trgm_ops);
CREATE INDEX "QualificationAlias_normalizedAlias_trgm_idx" ON "QualificationAlias" USING gin ("normalizedAlias" gin_trgm_ops);
CREATE INDEX "Place_normalizedName_trgm_idx" ON "Place" USING gin ("normalizedName" gin_trgm_ops);

-- Full-text search over listings (German stemming) + trigram for typo tolerance
CREATE INDEX "Listing_fts_idx" ON "Listing" USING gin (to_tsvector('german', "title" || ' ' || "description"));
CREATE INDEX "Listing_title_trgm_idx" ON "Listing" USING gin (mm_normalize("title") gin_trgm_ops);

-- Integrity rules
ALTER TABLE "Listing" ADD CONSTRAINT "Listing_positions_check" CHECK ("positions" BETWEEN 1 AND 50);
ALTER TABLE "Listing" ADD CONSTRAINT "Listing_wage_check" CHECK ("hourlyWageCents" > 0);
ALTER TABLE "Listing" ADD CONSTRAINT "Listing_dates_check" CHECK ("endDate" IS NULL OR "startDate" IS NULL OR "endDate" >= "startDate");
ALTER TABLE "MediationEvent" ADD CONSTRAINT "MediationEvent_fee_check" CHECK ("feeCents" >= 0);
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_amounts_check" CHECK ("grossCents" = "netCents" + "taxCents");
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_amount_check" CHECK ("amountCents" <> 0);
ALTER TABLE "Review" ADD CONSTRAINT "Review_rating_check" CHECK ("rating" BETWEEN 1 AND 5);
ALTER TABLE "Review" ADD CONSTRAINT "Review_not_self_check" CHECK ("authorId" <> "subjectId");
ALTER TABLE "Block" ADD CONSTRAINT "Block_not_self_check" CHECK ("blockerId" <> "blockedId");
ALTER TABLE "Application" ADD CONSTRAINT "Application_snapshot_check" CHECK (jsonb_typeof("resumeSnapshot") = 'object');

-- Fee events are append-only with respect to their money fields.
CREATE OR REPLACE FUNCTION mm_protect_mediation_fee() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."feeCents" <> OLD."feeCents" OR NEW."applicationId" <> OLD."applicationId"
     OR NEW."idempotencyKey" <> OLD."idempotencyKey" OR NEW."feeNoticeVersion" <> OLD."feeNoticeVersion" THEN
    RAISE EXCEPTION 'MediationEvent fee fields are immutable';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "MediationEvent_protect_fee" BEFORE UPDATE ON "MediationEvent"
  FOR EACH ROW EXECUTE FUNCTION mm_protect_mediation_fee();

-- Issued invoices are immutable except for their payment status.
CREATE OR REPLACE FUNCTION mm_protect_invoice() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."number" <> OLD."number" OR NEW."grossCents" <> OLD."grossCents" OR NEW."netCents" <> OLD."netCents"
     OR NEW."taxCents" <> OLD."taxCents" OR NEW."recipient" <> OLD."recipient" OR NEW."issueDate" <> OLD."issueDate" THEN
    RAISE EXCEPTION 'Issued invoices are immutable; issue a cancellation invoice instead';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "Invoice_protect" BEFORE UPDATE ON "Invoice"
  FOR EACH ROW EXECUTE FUNCTION mm_protect_invoice();

-- Audit log is append-only.
CREATE OR REPLACE FUNCTION mm_audit_append_only() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'AuditLog is append-only';
END $$;
CREATE TRIGGER "AuditLog_append_only" BEFORE UPDATE ON "AuditLog"
  FOR EACH ROW EXECUTE FUNCTION mm_audit_append_only();
