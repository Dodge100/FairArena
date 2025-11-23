-- CreateEnum
CREATE TYPE "ReportState" AS ENUM ('QUEUED', 'IN_REVIEW', 'RESOLVED', 'DISMISSED');

-- AlterTable
ALTER TABLE "Report" ADD COLUMN     "state" "ReportState" NOT NULL DEFAULT 'QUEUED';
