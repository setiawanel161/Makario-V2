ALTER TABLE "Page"
  ADD COLUMN "fieldTimestamps" JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE "Block"
  ADD COLUMN "fieldTimestamps" JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE "DatabaseProperty"
  ADD COLUMN "revision" BIGINT NOT NULL DEFAULT 1,
  ADD COLUMN "fieldTimestamps" JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE "DatabaseRowProperty"
  ADD COLUMN "revision" BIGINT NOT NULL DEFAULT 1,
  ADD COLUMN "fieldTimestamps" JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE "DatabaseView"
  ADD COLUMN "revision" BIGINT NOT NULL DEFAULT 1,
  ADD COLUMN "fieldTimestamps" JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE "SyncMutationReceipt" (
  "idempotencyKey" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "mutationType" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SyncMutationReceipt_pkey" PRIMARY KEY ("idempotencyKey")
);

CREATE INDEX "SyncMutationReceipt_workspaceId_createdAt_idx"
  ON "SyncMutationReceipt"("workspaceId", "createdAt");
CREATE INDEX "SyncMutationReceipt_userId_createdAt_idx"
  ON "SyncMutationReceipt"("userId", "createdAt");
