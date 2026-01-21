-- AlterTable
ALTER TABLE "OAuthApplication" ALTER COLUMN "grantTypes" SET DEFAULT ARRAY['authorization_code', 'refresh_token', 'urn:ietf:params:oauth:grant-type:device_code']::TEXT[];

-- AlterTable
ALTER TABLE "Report" ALTER COLUMN "reporterId" DROP NOT NULL;
