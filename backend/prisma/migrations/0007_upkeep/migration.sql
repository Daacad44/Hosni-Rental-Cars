-- CreateEnum
CREATE TYPE "MaintenanceStatus" AS ENUM ('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ExpenseCategory" AS ENUM ('FUEL', 'INSURANCE', 'FINE', 'SALARY', 'PARTS', 'PERMIT', 'OTHER');

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "serviceIntervalDays" INTEGER NOT NULL DEFAULT 180,
ADD COLUMN     "serviceIntervalKm" INTEGER NOT NULL DEFAULT 5000,
ADD COLUMN     "serviceThresholdDays" INTEGER NOT NULL DEFAULT 14,
ADD COLUMN     "serviceThresholdKm" INTEGER NOT NULL DEFAULT 500;

-- CreateTable
CREATE TABLE "Maintenance" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" "MaintenanceStatus" NOT NULL DEFAULT 'SCHEDULED',
    "scheduledStart" TIMESTAMP(3) NOT NULL,
    "scheduledEnd" TIMESTAMP(3) NOT NULL,
    "odometer" INTEGER,
    "vendor" TEXT,
    "cost" DECIMAL(12,2),
    "notes" TEXT,
    "nextDueAt" TIMESTAMP(3),
    "nextDueOdometer" INTEGER,
    "completedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Maintenance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Expense" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "branchId" TEXT,
    "vehicleId" TEXT,
    "category" "ExpenseCategory" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "description" TEXT,
    "receiptKey" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrafficFine" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "noticeNumber" TEXT NOT NULL,
    "offenceAt" TIMESTAMP(3) NOT NULL,
    "location" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "vehicleId" TEXT,
    "agreementId" TEXT,
    "customerCharged" BOOLEAN NOT NULL DEFAULT false,
    "invoiceId" TEXT,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrafficFine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Alert" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "raisedOn" TIMESTAMP(3) NOT NULL,
    "message" TEXT NOT NULL,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Alert_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Maintenance_organizationId_status_idx" ON "Maintenance"("organizationId", "status");

-- CreateIndex
CREATE INDEX "Maintenance_vehicleId_status_idx" ON "Maintenance"("vehicleId", "status");

-- CreateIndex
CREATE INDEX "Maintenance_organizationId_scheduledStart_idx" ON "Maintenance"("organizationId", "scheduledStart");

-- CreateIndex
CREATE INDEX "Expense_organizationId_category_idx" ON "Expense"("organizationId", "category");

-- CreateIndex
CREATE INDEX "Expense_organizationId_date_idx" ON "Expense"("organizationId", "date");

-- CreateIndex
CREATE INDEX "Expense_organizationId_vehicleId_idx" ON "Expense"("organizationId", "vehicleId");

-- CreateIndex
CREATE INDEX "Expense_organizationId_branchId_idx" ON "Expense"("organizationId", "branchId");

-- CreateIndex
CREATE INDEX "TrafficFine_organizationId_offenceAt_idx" ON "TrafficFine"("organizationId", "offenceAt");

-- CreateIndex
CREATE INDEX "TrafficFine_organizationId_vehicleId_idx" ON "TrafficFine"("organizationId", "vehicleId");

-- CreateIndex
CREATE INDEX "Alert_organizationId_resolvedAt_idx" ON "Alert"("organizationId", "resolvedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Alert_organizationId_type_entityId_raisedOn_key" ON "Alert"("organizationId", "type", "entityId", "raisedOn");

-- AddForeignKey
ALTER TABLE "Maintenance" ADD CONSTRAINT "Maintenance_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrafficFine" ADD CONSTRAINT "TrafficFine_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

