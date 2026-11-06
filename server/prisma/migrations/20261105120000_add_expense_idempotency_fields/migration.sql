-- AlterTable
ALTER TABLE "expenses" ADD COLUMN "idempotencyKey" TEXT,
ADD COLUMN "requestHash" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "expenses_tripId_idempotencyKey_key" ON "expenses"("tripId", "idempotencyKey");

