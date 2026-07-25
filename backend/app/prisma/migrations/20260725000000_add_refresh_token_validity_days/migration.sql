-- AlterTable
ALTER TABLE `RefreshToken` ADD COLUMN `validityDays` INTEGER NOT NULL DEFAULT 1;
