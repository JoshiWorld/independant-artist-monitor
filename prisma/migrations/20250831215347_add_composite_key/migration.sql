/*
  Warnings:

  - A unique constraint covering the columns `[campaignId,date]` on the table `DailyMetric` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "DailyMetric_campaignId_date_key" ON "public"."DailyMetric"("campaignId", "date");
