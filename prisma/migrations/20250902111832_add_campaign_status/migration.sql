-- CreateEnum
CREATE TYPE "public"."CampaignStatus" AS ENUM ('ACTIVE', 'PAUSED', 'DELETED', 'ARCHIVED');

-- AlterTable
ALTER TABLE "public"."Campaign" ADD COLUMN     "status" "public"."CampaignStatus" NOT NULL DEFAULT 'ACTIVE';
