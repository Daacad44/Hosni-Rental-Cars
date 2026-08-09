-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "nationalId" TEXT,
    "licenceNumber" TEXT,
    "licenceExpiry" TIMESTAMP(3),
    "address" TEXT,
    "notes" TEXT,
    "licenceScanKey" TEXT,
    "idScanKey" TEXT,
    "isBlocked" BOOLEAN NOT NULL DEFAULT false,
    "blockReason" TEXT,
    "blockedAt" TIMESTAMP(3),
    "blockedById" TEXT,
    "mergedIntoId" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Customer_organizationId_idx" ON "Customer"("organizationId");

-- CreateIndex
CREATE INDEX "Customer_organizationId_phone_idx" ON "Customer"("organizationId", "phone");

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Phone unique per organization among live customers only.
CREATE UNIQUE INDEX "Customer_org_phone_live_key"
  ON "Customer" ("organizationId", "phone")
  WHERE "deletedAt" IS NULL;

-- Forgiving name search: transliterated names have no single correct spelling.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX "Customer_fullName_trgm_idx"
  ON "Customer" USING gin ("fullName" gin_trgm_ops);
