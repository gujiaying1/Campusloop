-- CreateEnum
CREATE TYPE "ReservationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'CANCELLED');

-- CreateTable
CREATE TABLE "Reservation" (
    "id" SERIAL NOT NULL,
    "listingId" INTEGER NOT NULL,
    "buyerId" INTEGER NOT NULL,
    "status" "ReservationStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Reservation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Reservation_listingId_buyerId_status_key" ON "Reservation"("listingId", "buyerId", "status");

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
