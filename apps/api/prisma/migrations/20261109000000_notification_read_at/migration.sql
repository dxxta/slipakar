-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "readAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Notification_projectId_readAt_idx" ON "Notification"("projectId", "readAt");
