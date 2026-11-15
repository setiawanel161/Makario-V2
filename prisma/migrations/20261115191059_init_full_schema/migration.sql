-- CreateEnum
CREATE TYPE "PlanTier" AS ENUM ('FREE', 'PRO', 'TEAM');

-- CreateEnum
CREATE TYPE "WorkspaceRole" AS ENUM ('OWNER', 'ADMIN', 'MEMBER', 'GUEST');

-- CreateEnum
CREATE TYPE "BlockType" AS ENUM ('PARAGRAPH', 'HEADING_1', 'HEADING_2', 'HEADING_3', 'TODO', 'BULLETED_LIST', 'NUMBERED_LIST', 'TOGGLE', 'CALLOUT', 'CODE', 'QUOTE', 'DIVIDER', 'IMAGE', 'COLUMN_LIST', 'COLUMN', 'CHILD_DATABASE', 'CHART_BLOCK', 'SYNCED_BLOCK');

-- CreateEnum
CREATE TYPE "PropertyType" AS ENUM ('TEXT', 'NUMBER', 'SELECT', 'MULTI_SELECT', 'STATUS', 'DATE', 'PERSON', 'CHECKBOX', 'URL', 'RELATION', 'ROLLUP', 'FORMULA');

-- CreateEnum
CREATE TYPE "ViewLayout" AS ENUM ('TABLE', 'BOARD', 'CALENDAR', 'TIMELINE', 'GALLERY');

-- CreateEnum
CREATE TYPE "BuilderTier" AS ENUM ('APPRENTICE_SCRIBE', 'SYSTEMS_ARCHITECT', 'GRANDMASTER_WEAVER');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "avatarUrl" TEXT,
    "emailVerified" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "Workspace" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "icon" TEXT,
    "planTier" "PlanTier" NOT NULL DEFAULT 'FREE',
    "billingCustomerId" TEXT,
    "subscriptionStatus" TEXT DEFAULT 'active',
    "serverRevision" BIGINT NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Workspace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkspaceMember" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "WorkspaceRole" NOT NULL DEFAULT 'MEMBER',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkspaceMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Page" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "parentPageId" TEXT,
    "createdById" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'Untitled',
    "icon" TEXT,
    "coverUrl" TEXT,
    "fontFamily" TEXT NOT NULL DEFAULT 'sans',
    "isFullWidth" BOOLEAN NOT NULL DEFAULT false,
    "orderIndex" TEXT NOT NULL DEFAULT 'a0',
    "isDatabase" BOOLEAN NOT NULL DEFAULT false,
    "isFavorite" BOOLEAN NOT NULL DEFAULT false,
    "isPrivate" BOOLEAN NOT NULL DEFAULT false,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "publicSlug" TEXT,
    "allowTemplateClone" BOOLEAN NOT NULL DEFAULT false,
    "cloneCount" INTEGER NOT NULL DEFAULT 0,
    "revision" BIGINT NOT NULL DEFAULT 1,
    "fieldTimestamps" JSONB NOT NULL DEFAULT '{}',
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Page_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Block" (
    "id" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "parentBlockId" TEXT,
    "syncedSourceId" TEXT,
    "type" "BlockType" NOT NULL DEFAULT 'PARAGRAPH',
    "content" JSONB NOT NULL DEFAULT '{}',
    "orderIndex" TEXT NOT NULL DEFAULT 'a0',
    "revision" BIGINT NOT NULL DEFAULT 1,
    "fieldTimestamps" JSONB NOT NULL DEFAULT '{}',
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Block_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DatabaseProperty" (
    "id" TEXT NOT NULL,
    "databasePageId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "PropertyType" NOT NULL DEFAULT 'TEXT',
    "config" JSONB NOT NULL DEFAULT '{}',
    "orderIndex" TEXT NOT NULL DEFAULT 'a0',
    "revision" BIGINT NOT NULL DEFAULT 1,
    "fieldTimestamps" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DatabaseProperty_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DatabaseRowProperty" (
    "id" TEXT NOT NULL,
    "rowPageId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "revision" BIGINT NOT NULL DEFAULT 1,
    "fieldTimestamps" JSONB NOT NULL DEFAULT '{}',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DatabaseRowProperty_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DatabaseView" (
    "id" TEXT NOT NULL,
    "databasePageId" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Default View',
    "layout" "ViewLayout" NOT NULL DEFAULT 'TABLE',
    "filters" JSONB NOT NULL DEFAULT '[]',
    "sorts" JSONB NOT NULL DEFAULT '[]',
    "visibleProperties" JSONB NOT NULL DEFAULT '[]',
    "groupByPropertyId" TEXT,
    "orderIndex" TEXT NOT NULL DEFAULT 'a0',
    "revision" BIGINT NOT NULL DEFAULT 1,
    "fieldTimestamps" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DatabaseView_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Comment" (
    "id" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "blockId" TEXT,
    "authorId" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Comment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BuilderProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "totalXp" INTEGER NOT NULL DEFAULT 0,
    "tier" "BuilderTier" NOT NULL DEFAULT 'APPRENTICE_SCRIBE',
    "karmaScore" INTEGER NOT NULL DEFAULT 0,
    "currentStreak" INTEGER NOT NULL DEFAULT 0,
    "longestStreak" INTEGER NOT NULL DEFAULT 0,
    "freezeTokens" INTEGER NOT NULL DEFAULT 1,
    "lastActiveDate" TIMESTAMP(3),
    "gamificationEnabled" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BuilderProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "XpLedger" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "workspaceId" TEXT,
    "actionType" TEXT NOT NULL,
    "xpDelta" INTEGER NOT NULL,
    "referenceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "XpLedger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AchievementBadge" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "icon" TEXT NOT NULL,
    "requiredTier" "BuilderTier" NOT NULL DEFAULT 'APPRENTICE_SCRIBE',

    CONSTRAINT "AchievementBadge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserBadge" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "badgeId" TEXT NOT NULL,
    "awardedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserBadge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncMutationReceipt" (
    "idempotencyKey" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "mutationType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SyncMutationReceipt_pkey" PRIMARY KEY ("idempotencyKey")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "Workspace_slug_key" ON "Workspace"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Workspace_billingCustomerId_key" ON "Workspace"("billingCustomerId");

-- CreateIndex
CREATE INDEX "WorkspaceMember_userId_idx" ON "WorkspaceMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkspaceMember_workspaceId_userId_key" ON "WorkspaceMember"("workspaceId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "Page_publicSlug_key" ON "Page"("publicSlug");

-- CreateIndex
CREATE INDEX "Page_workspaceId_parentPageId_deletedAt_idx" ON "Page"("workspaceId", "parentPageId", "deletedAt");

-- CreateIndex
CREATE INDEX "Page_workspaceId_isFavorite_deletedAt_idx" ON "Page"("workspaceId", "isFavorite", "deletedAt");

-- CreateIndex
CREATE INDEX "Page_publicSlug_idx" ON "Page"("publicSlug");

-- CreateIndex
CREATE INDEX "Block_pageId_parentBlockId_orderIndex_idx" ON "Block"("pageId", "parentBlockId", "orderIndex");

-- CreateIndex
CREATE INDEX "Block_deletedAt_idx" ON "Block"("deletedAt");

-- CreateIndex
CREATE INDEX "DatabaseProperty_databasePageId_orderIndex_idx" ON "DatabaseProperty"("databasePageId", "orderIndex");

-- CreateIndex
CREATE INDEX "DatabaseRowProperty_propertyId_idx" ON "DatabaseRowProperty"("propertyId");

-- CreateIndex
CREATE UNIQUE INDEX "DatabaseRowProperty_rowPageId_propertyId_key" ON "DatabaseRowProperty"("rowPageId", "propertyId");

-- CreateIndex
CREATE INDEX "DatabaseView_databasePageId_orderIndex_idx" ON "DatabaseView"("databasePageId", "orderIndex");

-- CreateIndex
CREATE INDEX "Comment_pageId_threadId_idx" ON "Comment"("pageId", "threadId");

-- CreateIndex
CREATE UNIQUE INDEX "BuilderProfile_userId_key" ON "BuilderProfile"("userId");

-- CreateIndex
CREATE INDEX "XpLedger_userId_createdAt_idx" ON "XpLedger"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "XpLedger_userId_actionType_referenceId_key" ON "XpLedger"("userId", "actionType", "referenceId");

-- CreateIndex
CREATE UNIQUE INDEX "AchievementBadge_slug_key" ON "AchievementBadge"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "UserBadge_userId_badgeId_key" ON "UserBadge"("userId", "badgeId");

-- CreateIndex
CREATE INDEX "SyncMutationReceipt_workspaceId_createdAt_idx" ON "SyncMutationReceipt"("workspaceId", "createdAt");

-- CreateIndex
CREATE INDEX "SyncMutationReceipt_userId_createdAt_idx" ON "SyncMutationReceipt"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceMember" ADD CONSTRAINT "WorkspaceMember_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceMember" ADD CONSTRAINT "WorkspaceMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Page" ADD CONSTRAINT "Page_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Page" ADD CONSTRAINT "Page_parentPageId_fkey" FOREIGN KEY ("parentPageId") REFERENCES "Page"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Page" ADD CONSTRAINT "Page_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Block" ADD CONSTRAINT "Block_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "Page"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Block" ADD CONSTRAINT "Block_parentBlockId_fkey" FOREIGN KEY ("parentBlockId") REFERENCES "Block"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Block" ADD CONSTRAINT "Block_syncedSourceId_fkey" FOREIGN KEY ("syncedSourceId") REFERENCES "Block"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DatabaseProperty" ADD CONSTRAINT "DatabaseProperty_databasePageId_fkey" FOREIGN KEY ("databasePageId") REFERENCES "Page"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DatabaseRowProperty" ADD CONSTRAINT "DatabaseRowProperty_rowPageId_fkey" FOREIGN KEY ("rowPageId") REFERENCES "Page"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DatabaseRowProperty" ADD CONSTRAINT "DatabaseRowProperty_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "DatabaseProperty"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DatabaseView" ADD CONSTRAINT "DatabaseView_databasePageId_fkey" FOREIGN KEY ("databasePageId") REFERENCES "Page"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DatabaseView" ADD CONSTRAINT "DatabaseView_groupByPropertyId_fkey" FOREIGN KEY ("groupByPropertyId") REFERENCES "DatabaseProperty"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "Page"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_blockId_fkey" FOREIGN KEY ("blockId") REFERENCES "Block"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuilderProfile" ADD CONSTRAINT "BuilderProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "XpLedger" ADD CONSTRAINT "XpLedger_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "XpLedger" ADD CONSTRAINT "XpLedger_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserBadge" ADD CONSTRAINT "UserBadge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserBadge" ADD CONSTRAINT "UserBadge_badgeId_fkey" FOREIGN KEY ("badgeId") REFERENCES "AchievementBadge"("id") ON DELETE CASCADE ON UPDATE CASCADE;
