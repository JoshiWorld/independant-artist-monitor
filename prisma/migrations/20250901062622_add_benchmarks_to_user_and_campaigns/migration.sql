/*
  Warnings:

  - You are about to drop the `Benchmark` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."Benchmark" DROP CONSTRAINT "Benchmark_userId_fkey";

-- AlterTable
ALTER TABLE "public"."AdAccount" ADD COLUMN     "customerId" TEXT;

-- AlterTable
ALTER TABLE "public"."Campaign" ADD COLUMN     "greenMax" DOUBLE PRECISION,
ADD COLUMN     "yellowMax" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "public"."User" ADD COLUMN     "greenMax" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
ADD COLUMN     "yellowMax" DOUBLE PRECISION NOT NULL DEFAULT 0.59;

-- DropTable
DROP TABLE "public"."Benchmark";

-- CreateTable
CREATE TABLE "public"."Customer" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "greenMax" DOUBLE PRECISION,
    "yellowMax" DOUBLE PRECISION,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "public"."AdAccount" ADD CONSTRAINT "AdAccount_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "public"."Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
