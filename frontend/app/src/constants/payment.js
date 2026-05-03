// 支付方式常量集中
// 与后端 schemas/common.js 的 paymentMethodEnum 保持同步：
// 后端是权威，新增/重命名枚举值时两边一起改。

export const PAYMENT_METHODS = Object.freeze({
  CASH: 'CASH',
  WECHAT_PAY: 'WECHAT_PAY',
  ALIPAY: 'ALIPAY',
  DOUYIN: 'DOUYIN',
  MEITUAN: 'MEITUAN',
  CARD_SWIPE: 'CARD_SWIPE',
  MEMBER_CARD: 'MEMBER_CARD',
  OTHER: 'OTHER',
});

export const PAYMENT_METHOD_LABELS = Object.freeze({
  [PAYMENT_METHODS.CASH]: '现金',
  [PAYMENT_METHODS.WECHAT_PAY]: '微信',
  [PAYMENT_METHODS.ALIPAY]: '支付宝',
  [PAYMENT_METHODS.DOUYIN]: '抖音',
  [PAYMENT_METHODS.MEITUAN]: '美团',
  [PAYMENT_METHODS.CARD_SWIPE]: '刷卡',
  [PAYMENT_METHODS.MEMBER_CARD]: '会员卡',
  [PAYMENT_METHODS.OTHER]: '其他',
});

// 收银台展示的支付方式（按界面顺序，requireMember=true 表示必须先选会员）
export const CHECKOUT_PAYMENT_OPTIONS = Object.freeze([
  { value: PAYMENT_METHODS.CASH, label: PAYMENT_METHOD_LABELS.CASH },
  { value: PAYMENT_METHODS.WECHAT_PAY, label: PAYMENT_METHOD_LABELS.WECHAT_PAY },
  { value: PAYMENT_METHODS.ALIPAY, label: PAYMENT_METHOD_LABELS.ALIPAY },
  { value: PAYMENT_METHODS.DOUYIN, label: PAYMENT_METHOD_LABELS.DOUYIN },
  { value: PAYMENT_METHODS.MEITUAN, label: PAYMENT_METHOD_LABELS.MEITUAN },
  { value: PAYMENT_METHODS.MEMBER_CARD, label: PAYMENT_METHOD_LABELS.MEMBER_CARD, requireMember: true },
]);

// 办卡支付的可选方式（不含会员卡，避免循环）
export const ISSUE_CARD_PAYMENT_OPTIONS = Object.freeze([
  { value: PAYMENT_METHODS.CASH, label: PAYMENT_METHOD_LABELS.CASH },
  { value: PAYMENT_METHODS.WECHAT_PAY, label: PAYMENT_METHOD_LABELS.WECHAT_PAY },
  { value: PAYMENT_METHODS.ALIPAY, label: PAYMENT_METHOD_LABELS.ALIPAY },
  { value: PAYMENT_METHODS.DOUYIN, label: PAYMENT_METHOD_LABELS.DOUYIN },
  { value: PAYMENT_METHODS.MEITUAN, label: PAYMENT_METHOD_LABELS.MEITUAN },
]);

// 清账可用支付方式（仅现金 / 会员卡）
export const CLEAR_PENDING_PAYMENT_OPTIONS = Object.freeze([
  { value: PAYMENT_METHODS.MEMBER_CARD, label: '会员卡支付', requireCard: true },
  { value: PAYMENT_METHODS.CASH, label: '现金结清' },
]);
