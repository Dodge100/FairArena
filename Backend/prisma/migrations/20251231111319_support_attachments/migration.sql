-- CreateEnum
CREATE TYPE "AttachmentStatus" AS ENUM ('PENDING', 'UPLOADING', 'UPLOADED', 'FAILED', 'DELETED');

-- CreateTable
CREATE TABLE "SupportAttachment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "supportRequestId" TEXT,
    "fileName" TEXT NOT NULL,
    "originalFileName" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileHash" TEXT NOT NULL,
    "status" "AttachmentStatus" NOT NULL DEFAULT 'PENDING',
    "localPath" TEXT,
    "azureBlobName" TEXT,
    "azureUrl" TEXT,
    "uploadedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "referenceCount" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupportAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SupportAttachment_userId_idx" ON "SupportAttachment"("userId");

-- CreateIndex
CREATE INDEX "SupportAttachment_supportRequestId_idx" ON "SupportAttachment"("supportRequestId");

-- CreateIndex
CREATE INDEX "SupportAttachment_status_idx" ON "SupportAttachment"("status");

-- CreateIndex
CREATE INDEX "SupportAttachment_fileHash_idx" ON "SupportAttachment"("fileHash");

-- CreateIndex
CREATE INDEX "SupportAttachment_fileHash_status_idx" ON "SupportAttachment"("fileHash", "status");

-- CreateIndex
CREATE INDEX "SupportAttachment_createdAt_idx" ON "SupportAttachment"("createdAt");

-- AddForeignKey
ALTER TABLE "SupportAttachment" ADD CONSTRAINT "SupportAttachment_supportRequestId_fkey" FOREIGN KEY ("supportRequestId") REFERENCES "Support"("id") ON DELETE SET NULL ON UPDATE CASCADE;
