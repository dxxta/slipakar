-- CreateTable
CREATE TABLE "UserDataKey" (
    "userId" TEXT NOT NULL,
    "serverWrapped" TEXT NOT NULL,
    "passwordWrapped" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "UserDataKey_pkey" PRIMARY KEY ("userId")
);
ALTER TABLE "UserDataKey" ADD CONSTRAINT "UserDataKey_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "Campaign" ADD COLUMN "sendConsentAt" TIMESTAMP(3);
ALTER TABLE "Campaign" ALTER COLUMN "smtpConnectionId" DROP NOT NULL;
