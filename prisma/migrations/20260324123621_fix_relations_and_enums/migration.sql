/*
  Warnings:

  - The `status` column on the `notifications` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `status` column on the `queue` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `status` column on the `salaries` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "SalaryStatus" AS ENUM ('PENDING', 'PAID');

-- CreateEnum
CREATE TYPE "QueueStatus" AS ENUM ('WAITING', 'CALLED', 'DONE');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');

-- AlterTable
ALTER TABLE "notifications" DROP COLUMN "status",
ADD COLUMN     "status" "NotificationStatus" NOT NULL DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE "queue" DROP COLUMN "status",
ADD COLUMN     "status" "QueueStatus" NOT NULL DEFAULT 'WAITING';

-- AlterTable
ALTER TABLE "salaries" DROP COLUMN "status",
ADD COLUMN     "status" "SalaryStatus" NOT NULL DEFAULT 'PENDING';

-- AddForeignKey
ALTER TABLE "medicine_transactions" ADD CONSTRAINT "medicine_transactions_admissionId_fkey" FOREIGN KEY ("admissionId") REFERENCES "admissions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
