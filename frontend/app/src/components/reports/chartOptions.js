import { use } from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';
import { PieChart } from 'echarts/charts';
import { TitleComponent, TooltipComponent, LegendComponent, GridComponent } from 'echarts/components';

use([CanvasRenderer, PieChart, TitleComponent, TooltipComponent, LegendComponent, GridComponent]);

export const generatePieOption = (title, data) => ({
  title: { text: title, left: 'center', top: '5%' },
  tooltip: { trigger: 'item', formatter: '{b} : ¥{c} ({d}%)' },
  legend: { top: 'bottom', left: 'center' },
  series: [{
    name: '金额',
    type: 'pie',
    radius: ['40%', '70%'],
    center: ['50%', '50%'],
    avoidLabelOverlap: false,
    itemStyle: { borderRadius: 10, borderColor: '#fff', borderWidth: 2 },
    label: { show: false, position: 'center' },
    emphasis: { label: { show: true, fontSize: 20, fontWeight: 'bold' } },
    labelLine: { show: false },
    data: data.map(item => ({ value: item.value, name: item.name })),
  }],
});
