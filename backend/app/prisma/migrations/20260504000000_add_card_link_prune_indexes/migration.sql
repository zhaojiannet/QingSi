-- DropIndex
DROP INDEX `Card_balance_idx` ON `card`;

-- DropIndex
DROP INDEX `Card_isCustomCard_idx` ON `card`;

-- CreateTable
CREATE TABLE `TransactionCardLink` (
    `id` VARCHAR(191) NOT NULL,
    `transactionId` VARCHAR(191) NOT NULL,
    `cardId` VARCHAR(191) NOT NULL,
    `cardName` VARCHAR(191) NOT NULL,
    `amount` DECIMAL(10, 2) NOT NULL,

    INDEX `TransactionCardLink_transactionId_idx`(`transactionId`),
    INDEX `TransactionCardLink_cardId_idx`(`cardId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `TransactionCardLink` ADD CONSTRAINT `TransactionCardLink_transactionId_fkey` FOREIGN KEY (`transactionId`) REFERENCES `Transaction`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TransactionCardLink` ADD CONSTRAINT `TransactionCardLink_cardId_fkey` FOREIGN KEY (`cardId`) REFERENCES `Card`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
