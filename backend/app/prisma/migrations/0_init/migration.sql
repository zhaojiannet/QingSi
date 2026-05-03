-- CreateTable
CREATE TABLE `Member` (
    `id` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `gender` ENUM('MALE', 'FEMALE', 'UNKNOWN') NULL DEFAULT 'UNKNOWN',
    `birthday` DATETIME(3) NULL,
    `registrationDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `status` ENUM('ACTIVE', 'INACTIVE', 'DELETED') NOT NULL DEFAULT 'ACTIVE',
    `notes` TEXT NULL,

    INDEX `Member_name_idx`(`name`),
    INDEX `Member_phone_idx`(`phone`),
    INDEX `Member_status_idx`(`status`),
    INDEX `Member_registrationDate_idx`(`registrationDate`),
    INDEX `Member_birthday_idx`(`birthday`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Card` (
    `id` VARCHAR(191) NOT NULL,
    `memberId` VARCHAR(191) NOT NULL,
    `cardTypeId` VARCHAR(191) NOT NULL,
    `balance` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    `issueDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `expiryDate` DATETIME(3) NULL,
    `status` ENUM('ACTIVE', 'DEPLETED', 'EXPIRED', 'FROZEN') NOT NULL DEFAULT 'ACTIVE',
    `customAmount` DECIMAL(10, 2) NULL,
    `customDiscountRate` DECIMAL(4, 3) NULL,
    `discountSource` VARCHAR(191) NOT NULL DEFAULT 'card_type',
    `isCustomCard` BOOLEAN NOT NULL DEFAULT false,

    INDEX `Card_memberId_idx`(`memberId`),
    INDEX `Card_cardTypeId_idx`(`cardTypeId`),
    INDEX `Card_status_idx`(`status`),
    INDEX `Card_issueDate_idx`(`issueDate`),
    INDEX `Card_memberId_status_idx`(`memberId`, `status`),
    INDEX `Card_balance_idx`(`balance`),
    INDEX `Card_isCustomCard_idx`(`isCustomCard`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CardType` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `initialPrice` DECIMAL(10, 2) NOT NULL,
    `discountRate` DECIMAL(4, 3) NOT NULL,
    `status` ENUM('AVAILABLE', 'UNAVAILABLE') NOT NULL DEFAULT 'AVAILABLE',

    UNIQUE INDEX `CardType_name_key`(`name`),
    INDEX `CardType_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Service` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `standardPrice` DECIMAL(10, 2) NOT NULL,
    `status` ENUM('AVAILABLE', 'UNAVAILABLE') NOT NULL DEFAULT 'AVAILABLE',
    `sortOrder` INTEGER NOT NULL DEFAULT 99,
    `noDiscount` BOOLEAN NOT NULL DEFAULT false,

    UNIQUE INDEX `Service_name_key`(`name`),
    INDEX `Service_status_idx`(`status`),
    INDEX `Service_sortOrder_idx`(`sortOrder`),
    INDEX `Service_noDiscount_idx`(`noDiscount`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Transaction` (
    `id` VARCHAR(191) NOT NULL,
    `memberId` VARCHAR(191) NULL,
    `staffId` VARCHAR(191) NULL,
    `summary` VARCHAR(191) NULL,
    `totalAmount` DECIMAL(10, 2) NOT NULL,
    `actualPaidAmount` DECIMAL(10, 2) NOT NULL,
    `discountAmount` DECIMAL(10, 2) NOT NULL,
    `paymentMethod` ENUM('CASH', 'WECHAT_PAY', 'ALIPAY', 'DOUYIN', 'MEITUAN', 'CARD_SWIPE', 'MEMBER_CARD', 'OTHER') NOT NULL,
    `cardId` VARCHAR(191) NULL,
    `transactionTime` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `notes` VARCHAR(191) NULL,
    `customerName` VARCHAR(191) NULL,
    `isPending` BOOLEAN NOT NULL DEFAULT false,
    `transactionType` ENUM('NORMAL', 'PENDING', 'PENDING_CLEAR') NOT NULL DEFAULT 'NORMAL',
    `balanceSnapshot` JSON NULL,

    INDEX `Transaction_transactionTime_idx`(`transactionTime`),
    INDEX `Transaction_memberId_idx`(`memberId`),
    INDEX `Transaction_staffId_idx`(`staffId`),
    INDEX `Transaction_paymentMethod_idx`(`paymentMethod`),
    INDEX `Transaction_cardId_idx`(`cardId`),
    INDEX `Transaction_transactionTime_memberId_idx`(`transactionTime`, `memberId`),
    INDEX `Transaction_transactionTime_paymentMethod_idx`(`transactionTime`, `paymentMethod`),
    INDEX `Transaction_transactionType_idx`(`transactionType`),
    INDEX `Transaction_isPending_idx`(`isPending`),
    INDEX `Transaction_memberId_isPending_idx`(`memberId`, `isPending`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TransactionItem` (
    `id` VARCHAR(191) NOT NULL,
    `transactionId` VARCHAR(191) NOT NULL,
    `serviceId` VARCHAR(191) NOT NULL,
    `price` DECIMAL(10, 2) NOT NULL,
    `quantity` INTEGER NOT NULL DEFAULT 1,

    INDEX `TransactionItem_transactionId_idx`(`transactionId`),
    INDEX `TransactionItem_serviceId_idx`(`serviceId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Staff` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `position` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(191) NULL,
    `hireDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `status` ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
    `countsCommission` BOOLEAN NOT NULL DEFAULT true,
    `sortOrder` INTEGER NOT NULL DEFAULT 99,

    UNIQUE INDEX `Staff_phone_key`(`phone`),
    INDEX `Staff_status_idx`(`status`),
    INDEX `Staff_hireDate_idx`(`hireDate`),
    INDEX `Staff_countsCommission_idx`(`countsCommission`),
    INDEX `Staff_sortOrder_idx`(`sortOrder`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Appointment` (
    `id` VARCHAR(191) NOT NULL,
    `memberId` VARCHAR(191) NULL,
    `customerName` VARCHAR(191) NOT NULL,
    `customerPhone` VARCHAR(191) NOT NULL,
    `appointmentTime` DATETIME(3) NOT NULL,
    `assignedStaffId` VARCHAR(191) NULL,
    `status` ENUM('PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'NO_SHOW') NOT NULL DEFAULT 'PENDING',
    `notes` VARCHAR(191) NULL,
    `transactionId` VARCHAR(191) NULL,

    UNIQUE INDEX `Appointment_transactionId_key`(`transactionId`),
    INDEX `Appointment_appointmentTime_idx`(`appointmentTime`),
    INDEX `Appointment_status_idx`(`status`),
    INDEX `Appointment_memberId_idx`(`memberId`),
    INDEX `Appointment_assignedStaffId_idx`(`assignedStaffId`),
    INDEX `Appointment_customerPhone_idx`(`customerPhone`),
    INDEX `Appointment_appointmentTime_status_idx`(`appointmentTime`, `status`),
    INDEX `Appointment_appointmentTime_assignedStaffId_idx`(`appointmentTime`, `assignedStaffId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `User` (
    `id` VARCHAR(191) NOT NULL,
    `username` VARCHAR(191) NOT NULL,
    `password` VARCHAR(191) NOT NULL,
    `role` ENUM('ADMIN', 'MANAGER', 'STYLIST', 'ASSISTANT') NOT NULL DEFAULT 'STYLIST',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `staffId` VARCHAR(191) NULL,

    UNIQUE INDEX `User_username_key`(`username`),
    UNIQUE INDEX `User_staffId_key`(`staffId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RefreshToken` (
    `id` VARCHAR(191) NOT NULL,
    `token` VARCHAR(191) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `RefreshToken_token_key`(`token`),
    INDEX `RefreshToken_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SystemConfig` (
    `id` INTEGER NOT NULL DEFAULT 1,
    `enableLoginCaptcha` BOOLEAN NOT NULL DEFAULT true,
    `enableTransactionVoid` BOOLEAN NOT NULL DEFAULT false,
    `voidEnabledAt` DATETIME(3) NULL,
    `bookingCode` VARCHAR(32) NULL,
    `bookingCodeUpdatedAt` DATETIME(3) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `VoidLog` (
    `id` VARCHAR(191) NOT NULL,
    `originalTxId` VARCHAR(191) NOT NULL,
    `originalTxTime` DATETIME(3) NOT NULL,
    `memberId` VARCHAR(191) NULL,
    `memberName` VARCHAR(191) NULL,
    `summary` VARCHAR(191) NULL,
    `totalAmount` DECIMAL(10, 2) NOT NULL,
    `actualPaidAmount` DECIMAL(10, 2) NOT NULL,
    `paymentMethod` VARCHAR(191) NOT NULL,
    `cardInfo` TEXT NULL,
    `balanceRestored` TEXT NULL,
    `balanceSnapshot` JSON NULL,
    `voidedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `voidedBy` VARCHAR(191) NOT NULL,
    `voidedByName` VARCHAR(191) NOT NULL,
    `reason` VARCHAR(191) NULL,

    INDEX `VoidLog_voidedAt_idx`(`voidedAt`),
    INDEX `VoidLog_memberId_idx`(`memberId`),
    INDEX `VoidLog_voidedBy_idx`(`voidedBy`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `_AppointmentToService` (
    `A` VARCHAR(191) NOT NULL,
    `B` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `_AppointmentToService_AB_unique`(`A`, `B`),
    INDEX `_AppointmentToService_B_index`(`B`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Card` ADD CONSTRAINT `Card_cardTypeId_fkey` FOREIGN KEY (`cardTypeId`) REFERENCES `CardType`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Card` ADD CONSTRAINT `Card_memberId_fkey` FOREIGN KEY (`memberId`) REFERENCES `Member`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Transaction` ADD CONSTRAINT `Transaction_cardId_fkey` FOREIGN KEY (`cardId`) REFERENCES `Card`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Transaction` ADD CONSTRAINT `Transaction_memberId_fkey` FOREIGN KEY (`memberId`) REFERENCES `Member`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Transaction` ADD CONSTRAINT `Transaction_staffId_fkey` FOREIGN KEY (`staffId`) REFERENCES `Staff`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TransactionItem` ADD CONSTRAINT `TransactionItem_serviceId_fkey` FOREIGN KEY (`serviceId`) REFERENCES `Service`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TransactionItem` ADD CONSTRAINT `TransactionItem_transactionId_fkey` FOREIGN KEY (`transactionId`) REFERENCES `Transaction`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Appointment` ADD CONSTRAINT `Appointment_assignedStaffId_fkey` FOREIGN KEY (`assignedStaffId`) REFERENCES `Staff`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Appointment` ADD CONSTRAINT `Appointment_memberId_fkey` FOREIGN KEY (`memberId`) REFERENCES `Member`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Appointment` ADD CONSTRAINT `Appointment_transactionId_fkey` FOREIGN KEY (`transactionId`) REFERENCES `Transaction`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `User` ADD CONSTRAINT `User_staffId_fkey` FOREIGN KEY (`staffId`) REFERENCES `Staff`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RefreshToken` ADD CONSTRAINT `RefreshToken_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_AppointmentToService` ADD CONSTRAINT `_AppointmentToService_A_fkey` FOREIGN KEY (`A`) REFERENCES `Appointment`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_AppointmentToService` ADD CONSTRAINT `_AppointmentToService_B_fkey` FOREIGN KEY (`B`) REFERENCES `Service`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
