-- 删除 Card.id 6 位长度 trigger。应用层 utils/validators.js#validateCardIdFormat 已校验 6-8 位（历史 6 位 + 新生成 8 位）。
-- DB 层无需重复约束（且 CREATE TRIGGER 需要 SUPER 权限，而业务用户没有）。
DROP TRIGGER IF EXISTS before_card_insert;
DROP TRIGGER IF EXISTS before_card_update;
