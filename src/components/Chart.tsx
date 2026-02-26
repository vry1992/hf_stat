import dayjs from 'dayjs';
import 'dayjs/locale/uk';
import ReactECharts from 'echarts-for-react';
import React, { FC, useCallback, useMemo, useState } from 'react';
import { GROUP_ID } from '../Home';
import { ChartData, Detelization } from '../api/data-parser';

const FORMAT = 'DD.MM.YYYY HH:mm';

export const Chart: FC<{
  detalization: Detelization;
  data: ChartData;
  maxY: number;
  name: string;
}> = ({ data, maxY, name, detalization }) => {
  const [hoveredDay, setHoveredDay] = useState<string | null>(null);

  const labels = useMemo(() => Object.keys(data), [data]);
  const values = useMemo(
    () => Object.values(data).map(({ count }) => count),
    [data]
  );

  const handleReady = useCallback(
    (chart: any) => {
      chart.group = GROUP_ID;

      chart.on('mouseover', (params: any) => {
        if (params.componentType === 'xAxis') {
          const parsed = dayjs(params.value, FORMAT);
          if (!parsed.isValid()) return;

          setHoveredDay(parsed.locale('uk').format('dd'));
        }
      });

      chart.on('mouseout', (params: any) => {
        if (params.componentType === 'xAxis') {
          setHoveredDay(null);
        }
      });
    },
    [detalization]
  );

  const option = useMemo(() => {
    return {
      grid: {
        left: 50,
        right: 20,
        top: 40,
        bottom: 190,
      },

      title: {
        text: name,
        left: 10,
        bottom: '94%',
      },

      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
      },

      axisPointer: {
        link: [{ xAxisIndex: 'all' }],
      },

      brush: {
        toolbox: ['rect', 'clear'],
        xAxisIndex: 'all',
        brushLink: 'all',
      },

      dataZoom: [
        {
          type: 'slider',
          xAxisIndex: 'all',
          bottom: 20,
        },
      ],

      xAxis: {
        type: 'category',
        data: labels,
        triggerEvent: true,
        axisLabel: {
          rotate: 90,
          hideOverlap: true,
          margin: 20,
          formatter: (value: string) => {
            const parsed = dayjs(value, FORMAT);
            if (!parsed.isValid()) return value;

            const day = parsed.locale('uk').format('dd');
            const formatted = parsed.format(FORMAT);

            if (day === hoveredDay) {
              return `{highlight|${formatted} ${day}}`;
            }

            return `{normal|${formatted} ${day}}`;
          },
          rich: {
            highlight: {
              color: '#fff',
              backgroundColor: '#ff6b6b',
              borderRadius: 4,
              padding: [0, 4],
            },
            normal: {
              color: '#aaa',
            },
          },
        },
      },

      yAxis: {
        type: 'value',
        max: maxY,
        minInterval: 1,
      },

      series: [
        {
          type: 'bar',
          data: values,
          emphasis: {
            itemStyle: {
              borderWidth: 2,
              borderColor: 'red',
              color: '#91CC75',
            },
          },
        },
      ],
    };
  }, [labels, values, maxY, hoveredDay, name]);

  return (
    <ReactECharts
      onChartReady={handleReady}
      option={option}
      style={{ height: 400, width: '100vw' }}
      // notMerge={true}
      lazyUpdate={true}
    />
  );
};
