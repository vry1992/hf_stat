// echarts-builder.service.ts

import { SheetAnalysisResultType } from './data-parser';

export type EChartsBarOption = any; // можна типізувати через echarts.EChartsOption

export class EChartsBuilderService {
  static buildBarOption(
    sheet: SheetAnalysisResultType,
    options?: {
      enableZoom?: boolean;
      largeThreshold?: number;
    }
  ): EChartsBarOption {
    const { enableZoom = true, largeThreshold = 2000 } = options || {};

    const categoryData = sheet.data.map((d) => d.key);
    const valueData = sheet.data.map((d) => d.count);

    const isLarge = sheet.data.length >= largeThreshold;

    return {
      title: {
        text: `${sheet.fullName} (${sheet.data.length})`,
        left: 10,
      },

      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'shadow',
        },
      },

      grid: {
        bottom: enableZoom ? 90 : 40,
      },

      toolbox: {
        feature: {
          saveAsImage: {
            pixelRatio: 2,
          },
          ...(enableZoom && {
            dataZoom: {
              yAxisIndex: false,
            },
          }),
        },
      },

      dataZoom: enableZoom
        ? [{ type: 'inside' }, { type: 'slider' }]
        : undefined,

      xAxis: {
        type: 'category',
        data: categoryData,
        silent: false,
        splitLine: { show: false },
        splitArea: { show: false },
      },

      yAxis: {
        type: 'value',
        splitArea: { show: false },
      },

      series: [
        {
          type: 'bar',
          data: valueData,
          large: isLarge, // 🔥 критично для великих даних
          largeThreshold,
          progressive: 5000, // 🔥 плавний рендер
          animation: !isLarge, // 🔥 вимикаємо анімацію для великих
        },
      ],
    };
  }
}
