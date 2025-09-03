/*
  Warnings:

  - You are about to drop the column `metaRefreshToken` on the `User` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."User" DROP COLUMN "metaRefreshToken",
ADD COLUMN     "metaTokenExpiry" TIMESTAMP(3);
