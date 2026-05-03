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

  const isMultiCardPayment = (transaction) => {
    return transaction.notes && transaction.notes.includes('多卡联合支付:');
  };

  const getAverageDiscountDisplay = (transaction) => {
    const totalAmount = parseFloat(transaction.totalAmount);
    const actualPaidAmount = parseFloat(transaction.actualPaidAmount);
    if (totalAmount <= 0 && transaction.notes) {
      const match = transaction.notes.match(/¥(\d+(?:\.\d+)?)\s*折后\s*¥(\d+(?:\.\d+)?)/);
      if (match) {
        const originalPrice = parseFloat(match[1]);
        const discountedPrice = parseFloat(match[2]);
        if (originalPrice > 0) {
          const discount = (discountedPrice / originalPrice) * 10;
          return discount % 1 === 0 ? Math.round(discount) : discount.toFixed(1);
        }
      }
      return '7.0';
    }
    const avgDiscount = (actualPaidAmount / totalAmount) * 10;
    return avgDiscount % 1 === 0 ? Math.round(avgDiscount) : avgDiscount.toFixed(1);
  };

  const getMultiCardDetails = (transaction) => {
    if (!transaction.notes) return '';
    const match = transaction.notes.match(/多卡联合支付:\s*(.+?)(?:\s*\||$)/);
    return match && match[1] ? match[1].trim() : '多卡组合支付';
  };

  const getMultiCardList = (transaction) => {
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
