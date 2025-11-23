-- CreateTable
CREATE TABLE "ProfileStars" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "starrerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProfileStars_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProfileStars_profileId_userId_idx" ON "ProfileStars"("profileId", "userId");

-- CreateIndex
CREATE INDEX "ProfileStars_starrerId_idx" ON "ProfileStars"("starrerId");

-- CreateIndex
CREATE UNIQUE INDEX "ProfileStars_profileId_starrerId_userId_key" ON "ProfileStars"("profileId", "starrerId", "userId");

-- AddForeignKey
ALTER TABLE "ProfileStars" ADD CONSTRAINT "ProfileStars_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfileStars" ADD CONSTRAINT "ProfileStars_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("userId") ON DELETE CASCADE ON UPDATE CASCADE;
