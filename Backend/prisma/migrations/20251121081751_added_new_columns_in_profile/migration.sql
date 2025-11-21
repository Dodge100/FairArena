-- DropForeignKey
ALTER TABLE "ProfileView" DROP CONSTRAINT "ProfileView_profileId_fkey";

-- AlterTable
ALTER TABLE "Profile" ADD COLUMN     "awards" TEXT[],
ADD COLUMN     "certifications" TEXT[],
ADD COLUMN     "experiences" TEXT[];

-- AddForeignKey
ALTER TABLE "ProfileView" ADD CONSTRAINT "ProfileView_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
