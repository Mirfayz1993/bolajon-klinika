-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED');

-- AlterEnum
ALTER TYPE "AppointmentType" ADD VALUE 'PHYSIOTHERAPY';

-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'PHARMACIST';

-- DropForeignKey
ALTER TABLE "lab_tests" DROP CONSTRAINT "lab_tests_labTechId_fkey";

-- AlterTable
ALTER TABLE "lab_test_types" ADD COLUMN     "normalMax" DOUBLE PRECISION,
ADD COLUMN     "normalMin" DOUBLE PRECISION,
ADD COLUMN     "parentId" TEXT;

-- AlterTable
ALTER TABLE "lab_tests" ADD COLUMN     "paymentId" TEXT,
ADD COLUMN     "reagentId" TEXT,
ALTER COLUMN "labTechId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "medical_records" ADD COLUMN     "admissionId" TEXT;

-- AlterTable
ALTER TABLE "medicines" ADD COLUMN     "floor" INTEGER,
ADD COLUMN     "writtenOff" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "writtenOffAt" TIMESTAMP(3),
ADD COLUMN     "writtenOffById" TEXT;

-- AlterTable
ALTER TABLE "nurse_notes" ADD COLUMN     "noteType" TEXT;

-- AlterTable
ALTER TABLE "patients" ADD COLUMN     "chronicConditions" TEXT,
ADD COLUMN     "gender" TEXT;

-- AlterTable
ALTER TABLE "user_permissions" ADD COLUMN     "level" TEXT NOT NULL DEFAULT 'EDIT';

-- CreateTable
CREATE TABLE "room_inventory_logs" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "inventoryItemId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "comment" TEXT,
    "performedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "room_inventory_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reagents" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "minQuantity" DOUBLE PRECISION NOT NULL DEFAULT 10,
    "expiryDate" TIMESTAMP(3),
    "pricePerUnit" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reagents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reagent_transactions" (
    "id" TEXT NOT NULL,
    "reagentId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "note" TEXT,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reagent_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "general_expenses" (
    "id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "description" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "roomId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "general_expenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tasks" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "deadline" TIMESTAMP(3) NOT NULL,
    "status" "TaskStatus" NOT NULL DEFAULT 'PENDING',
    "assignerId" TEXT NOT NULL,
    "assigneeId" TEXT NOT NULL,
    "admissionId" TEXT,
    "patientId" TEXT,
    "progressNote" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "seenByAssignee" BOOLEAN NOT NULL DEFAULT false,
    "seenByAssigner" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_assign_permissions" (
    "id" TEXT NOT NULL,
    "grantedById" TEXT NOT NULL,
    "assignerId" TEXT NOT NULL,
    "targetUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_assign_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vitals" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "admissionId" TEXT,
    "temperature" DOUBLE PRECISION,
    "bloodPressureSystolic" INTEGER,
    "bloodPressureDiastolic" INTEGER,
    "pulse" INTEGER,
    "oxygenSaturation" DOUBLE PRECISION,
    "weight" DOUBLE PRECISION,
    "notes" TEXT,
    "recordedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vitals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "task_assign_permissions_assignerId_targetUserId_key" ON "task_assign_permissions"("assignerId", "targetUserId");

-- CreateIndex
CREATE UNIQUE INDEX "lab_tests_paymentId_key" ON "lab_tests"("paymentId");

-- AddForeignKey
ALTER TABLE "room_inventory_logs" ADD CONSTRAINT "room_inventory_logs_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "rooms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "room_inventory_logs" ADD CONSTRAINT "room_inventory_logs_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "room_inventory_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "room_inventory_logs" ADD CONSTRAINT "room_inventory_logs_performedById_fkey" FOREIGN KEY ("performedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_test_types" ADD CONSTRAINT "lab_test_types_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "lab_test_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_tests" ADD CONSTRAINT "lab_tests_labTechId_fkey" FOREIGN KEY ("labTechId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_tests" ADD CONSTRAINT "lab_tests_reagentId_fkey" FOREIGN KEY ("reagentId") REFERENCES "reagents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_tests" ADD CONSTRAINT "lab_tests_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medicines" ADD CONSTRAINT "medicines_writtenOffById_fkey" FOREIGN KEY ("writtenOffById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medical_records" ADD CONSTRAINT "medical_records_admissionId_fkey" FOREIGN KEY ("admissionId") REFERENCES "admissions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assigned_services" ADD CONSTRAINT "assigned_services_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reagent_transactions" ADD CONSTRAINT "reagent_transactions_reagentId_fkey" FOREIGN KEY ("reagentId") REFERENCES "reagents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "general_expenses" ADD CONSTRAINT "general_expenses_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "rooms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "general_expenses" ADD CONSTRAINT "general_expenses_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assignerId_fkey" FOREIGN KEY ("assignerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_admissionId_fkey" FOREIGN KEY ("admissionId") REFERENCES "admissions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_assign_permissions" ADD CONSTRAINT "task_assign_permissions_grantedById_fkey" FOREIGN KEY ("grantedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_assign_permissions" ADD CONSTRAINT "task_assign_permissions_assignerId_fkey" FOREIGN KEY ("assignerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_assign_permissions" ADD CONSTRAINT "task_assign_permissions_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vitals" ADD CONSTRAINT "vitals_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vitals" ADD CONSTRAINT "vitals_admissionId_fkey" FOREIGN KEY ("admissionId") REFERENCES "admissions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vitals" ADD CONSTRAINT "vitals_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

