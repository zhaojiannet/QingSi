import { formatAmount } from '@/utils/currency.js';
import { formatFullDateTimeInAppTimeZone } from '@/utils/date.js';

export function useTransactionFormatters() {
  const formatServiceItems = (items) => {
    if (!items || items.length === 0) return '';
    return items.map(item => {
      const quantity = item.quantity || 1;
      return quantity > 1 ? `${item.service.name}*${quantity}` : item.service.name;
    }).join('、');
  };

  const getAdjustmentText = (row) => {
    if (!row.manualAdjustment) return '';
    const totalAmount = parseFloat(row.totalAmount);
    const adjustedAmount = parseFloat(row.actualPaidAmount);
    const difference = adjustedAmount - totalAmount;
    if (totalAmount === 0) return `定价 ¥${adjustedAmount.toFixed(2)}`;
    if (difference > 0) return `加 ¥${difference.toFixed(2)}`;
    if (difference < 0) return `减 ¥${Math.abs(difference).toFixed(2)}`;
    return '价格调整';
  };

  const getAdjustmentReason = (row) => {
    if (!row.manualAdjustment || !row.notes) return '';
    const match = row.notes.match(/价格调整：(.+?)(?:\s*\||$)/);
    return match ? match[1].trim() : '';
  };

  const getCardDiscountDisplay = (discountRate) => {
    if (!discountRate) return 10;
    const rate = typeof discountRate === 'object' ? parseFloat(discountRate.toString()) : parseFloat(discountRate);
    const discount = rate * 10;
    return discount % 1 === 0 ? Math.round(discount) : discount.toFixed(1);
  };

  // 优先用后端返回的结构化 cardLinks 判断多卡，历史交易（无 cardLinks）回退到 notes 文本
  const isMultiCardPayment = (transaction) => {
    if (transaction.cardLinks && transaction.cardLinks.length > 0) {
      return transaction.cardLinks.length > 1;
    }
    return transaction.notes && transaction.notes.includes('多卡联合支付:');
  };

  const getAverageDiscountDisplay = (transaction) => {
    const totalAmount = parseFloat(transaction.totalAmount);
    const actualPaidAmount = parseFloat(transaction.actualPaidAmount);
    // 没有有效原价时无法计算折扣，返回占位符而非编造数据
    if (!(totalAmount > 0)) return '-';
    const avgDiscount = (actualPaidAmount / totalAmount) * 10;
    return avgDiscount % 1 === 0 ? Math.round(avgDiscount) : avgDiscount.toFixed(1);
  };

  const getMultiCardDetails = (transaction) => {
    const list = getMultiCardList(transaction);
    if (list.length > 0) {
      return list.map(c => (c.amount != null ? `${c.name}¥${formatAmount(c.amount)}` : c.name)).join(' + ');
    }
    return '多卡组合支付';
  };

  const getMultiCardList = (transaction) => {
    // 优先用结构化 cardLinks
    if (transaction.cardLinks && transaction.cardLinks.length > 0) {
      return transaction.cardLinks.map(link => ({
        name: link.cardName,
        amount: link.amount,
      }));
    }
    // 回退：历史交易从 notes 文本解析
    if (!transaction.notes) return [];
    const match = transaction.notes.match(/多卡联合支付:\s*(.+?)(?:\s*\||$)/);
    if (match && match[1]) {
      return match[1].trim().split(' + ').map(part => {
        const lastYenIndex = part.lastIndexOf('¥');
        return {
          name: lastYenIndex > 0 ? part.substring(0, lastYenIndex).trim() : part.trim()
        };
      });
    }
    return [];
  };

  const getSingleCardDiscountDisplay = (transaction) => {
    const totalAmount = parseFloat(transaction.totalAmount);
    const actualPaidAmount = parseFloat(transaction.actualPaidAmount);
    if (totalAmount > 0 && actualPaidAmount > 0) {
      const discount = (actualPaidAmount / totalAmount) * 10;
      const display = discount % 1 === 0 ? Math.round(discount) : discount.toFixed(1);
      return `${display}折 ¥${formatAmount(transaction.discountAmount)}`;
    }
    return `会员卡 ¥${formatAmount(transaction.discountAmount)}`;
  };

  const isBatchClear = (transaction) => {
    return transaction.transactionType === 'PENDING_CLEAR'
      && transaction.summary
      && transaction.summary.includes('批量清账')
      && transaction.notes;
  };

  const getBatchClearTooltip = (transaction) => {
    if (!isBatchClear(transaction)) return '';
    if (transaction.summary && transaction.summary.includes('(¥')) {
      return transaction.summary.replace(/、/g, '\n• ').replace('批量清账：', '批量清账明细：\n• ');
    }
    return transaction.summary;
  };

  const isManualTime = (row) => row.notes && row.notes.includes('[手动设置时间]');

  const getTimeTooltip = (row) => {
    const fullTime = formatFullDateTimeInAppTimeZone(row.transactionTime);
    return isManualTime(row) ? `${fullTime} (此交易时间为手动设置)` : fullTime;
  };

  return {
    formatServiceItems,
    getAdjustmentText,
    getAdjustmentReason,
    getCardDiscountDisplay,
    isMultiCardPayment,
    getAverageDiscountDisplay,
    getMultiCardDetails,
    getMultiCardList,
    getSingleCardDiscountDisplay,
    isBatchClear,
    getBatchClearTooltip,
    isManualTime,
    getTimeTooltip
  };
}
