-- AlterTable
ALTER TABLE "User" ADD COLUMN     "banReason" TEXT,
ADD COLUMN     "isBanned" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "User_isBanned_idx" ON "User"("isBanned");

-- CreateIndex
CREATE INDEX "User_userId_isBanned_idx" ON "User"("userId", "isBanned");
