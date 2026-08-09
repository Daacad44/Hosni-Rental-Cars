-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "graceMinutes" INTEGER NOT NULL DEFAULT 59;

-- CreateTable
CREATE TABLE "RateCard" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "vehicleId" TEXT,
    "dailyRate" DECIMAL(12,2) NOT NULL,
    "weeklyRate" DECIMAL(12,2),
    "monthlyRate" DECIMAL(12,2),
    "includedKmPerDay" INTEGER,
    "extraKmRate" DECIMAL(12,2) NOT NULL,
    "depositAmount" DECIMAL(12,2) NOT NULL,
    "lateHourRate" DECIMAL(12,2) NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RateCard_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RateCard_organizationId_category_effectiveFrom_idx" ON "RateCard"("organizationId", "category", "effectiveFrom");

-- CreateIndex
CREATE INDEX "RateCard_organizationId_vehicleId_effectiveFrom_idx" ON "RateCard"("organizationId", "vehicleId", "effectiveFrom");

-- AddForeignKey
ALTER TABLE "RateCard" ADD CONSTRAINT "RateCard_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

