-- CreateEnum
CREATE TYPE "ReservationStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CONVERTED', 'CANCELLED', 'NO_SHOW');

-- CreateTable
CREATE TABLE "Reservation" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "vehicleId" TEXT,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "status" "ReservationStatus" NOT NULL DEFAULT 'PENDING',
    "quotedTotal" DECIMAL(12,2) NOT NULL,
    "quotedDeposit" DECIMAL(12,2) NOT NULL,
    "rateValues" JSONB NOT NULL,
    "quoteBreakdown" JSONB NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Reservation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Reservation_organizationId_idx" ON "Reservation"("organizationId");

-- CreateIndex
CREATE INDEX "Reservation_organizationId_branchId_idx" ON "Reservation"("organizationId", "branchId");

-- CreateIndex
CREATE INDEX "Reservation_organizationId_status_idx" ON "Reservation"("organizationId", "status");

-- CreateIndex
CREATE INDEX "Reservation_vehicleId_startAt_endAt_idx" ON "Reservation"("vehicleId", "startAt", "endAt");

-- CreateIndex
CREATE INDEX "Reservation_customerId_idx" ON "Reservation"("customerId");

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Database-enforced availability: no two active reservations for the same
-- vehicle may overlap in time. This makes the concurrency race impossible —
-- two simultaneous confirmations resolve to exactly one winner, the other
-- fails with an exclusion violation mapped to OVERLAPPING_RESERVATION.
CREATE EXTENSION IF NOT EXISTS btree_gist;
-- startAt/endAt are `timestamp without time zone`, so the range must be built
-- with tsrange, not tstzrange: tstzrange(timestamp, timestamp) depends on the
-- session TimeZone to cast its arguments and is therefore NOT immutable, which
-- Postgres rejects in an index expression ("functions in index expression must
-- be marked IMMUTABLE"). tsrange over the same columns is immutable.
ALTER TABLE "Reservation"
  ADD CONSTRAINT "Reservation_no_overlap"
  EXCLUDE USING gist (
    "vehicleId" WITH =,
    tsrange("startAt", "endAt") WITH &&
  )
  WHERE (status IN ('CONFIRMED', 'CONVERTED') AND "vehicleId" IS NOT NULL);
