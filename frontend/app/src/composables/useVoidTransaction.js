import { reactive } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { voidTransaction } from '@/api/transaction.js';

// 7 天内可撤销（业务约定）— 独立 export，避免每个用方都重复定义
export const canVoidTransaction = (transaction) => {
  const txTime = new Date(transaction.transactionTime);
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  return txTime >= sevenDaysAgo;
};

export function useVoidTransaction() {
  const voidDialog = reactive({
    visible: false,
    loading: false,
    transaction: null,
    reason: ''
  });

  const openVoidDialog = async (transaction) => {
    try {
      await ElMessageBox.confirm(
        '交易撤销是高风险操作，撤销后将永久删除交易记录并恢复相关金额。此操作不可逆，请确认您已了解后果。',
        '危险操作警告',
        {
          confirmButtonText: '我已了解，继续操作',
          cancelButtonText: '取消',
          type: 'warning',
          confirmButtonClass: 'el-button--danger',
          cancelButtonClass: 'el-button--primary',
          customClass: 'void-confirm-dialog',
        }
      );
      voidDialog.transaction = transaction;
      voidDialog.reason = '';
      voidDialog.visible = true;
    } catch {
      // 用户取消
    }
  };

  const confirmVoid = async (onSuccess) => {
    if (!voidDialog.transaction) return;
    voidDialog.loading = true;
    try {
      const result = await voidTransaction(voidDialog.transaction.id, voidDialog.reason || null);
      ElMessage.success('交易撤销成功' + (result.balanceRestored?.length > 0 ? '，会员卡余额已恢复' : ''));
      voidDialog.visible = false;
      onSuccess?.();
    } catch (error) {
      ElMessage.error(error.response?.data?.message || '撤销失败');
    } finally {
      voidDialog.loading = false;
    }
  };

  return { voidDialog, openVoidDialog, confirmVoid };
}
