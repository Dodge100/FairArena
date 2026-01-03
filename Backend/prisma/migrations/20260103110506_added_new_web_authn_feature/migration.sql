-- CreateTable
CREATE TABLE "SecurityKey" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "credentialId" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    "counter" BIGINT NOT NULL DEFAULT 0,
    "deviceType" TEXT,
    "name" TEXT,
    "transports" TEXT[],
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SecurityKey_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SecurityKey_credentialId_key" ON "SecurityKey"("credentialId");

-- CreateIndex
CREATE INDEX "SecurityKey_userId_idx" ON "SecurityKey"("userId");

-- CreateIndex
CREATE INDEX "SecurityKey_credentialId_idx" ON "SecurityKey"("credentialId");

-- AddForeignKey
ALTER TABLE "SecurityKey" ADD CONSTRAINT "SecurityKey_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("userId") ON DELETE CASCADE ON UPDATE CASCADE;
