import { ref } from 'vue';

export function useReportDateRange() {
  const dateRange = ref([]);
  const quickDate = ref('today');

  const formatDate = (d) => d.toISOString().split('T')[0];

  const applyQuickDate = (value) => {
    const today = new Date();
    let start, end;
    switch (value) {
      case 'today':
        start = today;
        end = today;
        break;
      case 'this_week': {
        const dayOfWeek = today.getDay();
        const diff = today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
        start = new Date(today.setDate(diff));
        end = new Date(start);
        end.setDate(start.getDate() + 6);
        break;
      }
      case 'this_month':
        start = new Date(today.getFullYear(), today.getMonth(), 1);
        end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        break;
      case 'this_quarter': {
        const currentMonth = today.getMonth();
        const quarterStartMonth = Math.floor(currentMonth / 3) * 3;
        start = new Date(today.getFullYear(), quarterStartMonth, 1);
        end = new Date(today.getFullYear(), quarterStartMonth + 3, 0);
        break;
      }
      case 'this_year':
        start = new Date(today.getFullYear(), 0, 1);
        end = new Date(today.getFullYear(), 11, 31);
        break;
      default:
        return;
    }
    dateRange.value = [formatDate(start), formatDate(end)];
  };

  return { dateRange, quickDate, applyQuickDate };
}
