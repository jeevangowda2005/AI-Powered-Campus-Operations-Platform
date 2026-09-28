-- CreateEnum
CREATE TYPE "AiProcessingStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- AlterTable
ALTER TABLE "service_requests" ADD COLUMN     "aiProcessingStatus" "AiProcessingStatus" NOT NULL DEFAULT 'PENDING';
