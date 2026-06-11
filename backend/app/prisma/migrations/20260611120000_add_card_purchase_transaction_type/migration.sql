-- AlterTable
ALTER TABLE `transaction` MODIFY `transactionType` ENUM('NORMAL', 'PENDING', 'PENDING_CLEAR', 'CARD_PURCHASE') NOT NULL DEFAULT 'NORMAL';

-- 回填历史办卡/充值交易：此前靠 summary 前缀"办理【"识别，统一打上 CARD_PURCHASE 类型。
-- 挂账/清账的 summary 以"挂账："/"清账："开头本就不会匹配，AND 条件为双保险。
-- 回滚：UPDATE `transaction` SET `transactionType` = 'NORMAL' WHERE `transactionType` = 'CARD_PURCHASE';
UPDATE `transaction` SET `transactionType` = 'CARD_PURCHASE'
WHERE `summary` LIKE '办理【%' AND `transactionType` = 'NORMAL';
