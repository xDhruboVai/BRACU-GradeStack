import React, { useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import * as echarts from 'echarts/core';
import { LineChart as ELineChart } from 'echarts/charts';
import { GridComponent, TooltipComponent, LegendComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';

echarts.use([ELineChart, GridComponent, TooltipComponent, LegendComponent, CanvasRenderer]);

export default function SmoothLineChart({
  data = [],
  nameKey = 'name',
  valueKey = 'value',
  color = '#22c55e',
  label = 'Series',
  yDomain = [0, 4],
  onPointClick,
}) {
  const categories = useMemo(() => data.map(d => d?.[nameKey] ?? ''), [data, nameKey]);
  const seriesData = useMemo(() => data.map(d => ({
    value: typeof d?.[valueKey] === 'number' ? d[valueKey] : null,
    name: d?.[nameKey],
    semester_id: d?.semester_id ?? null,
    raw: d,
  })), [data, nameKey, valueKey]);

  const option = useMemo(() => {
    const areaGrad = new echarts.graphic.LinearGradient(0, 0, 0, 1, [
      { offset: 0, color: `${color}66` },
      { offset: 1, color: `${color}0A` },
    ]);

    return {
      backgroundColor: 'transparent',
      grid: { left: 48, top: 28, right: 24, bottom: 40 },
      xAxis: {
        type: 'category',
        boundaryGap: true,
        data: categories,
        axisLine: { lineStyle: { color: '#3f3f46' } },
        axisLabel: { color: '#cbd5e1' },
        axisTick: { show: false },
      },
      yAxis: {
        type: 'value',
        min: yDomain?.[0] ?? 0,
        max: yDomain?.[1] ?? 4,
        splitLine: { lineStyle: { color: 'rgba(148,163,184,0.15)' } },
        axisLine: { lineStyle: { color: '#3f3f46' } },
        axisLabel: { color: '#cbd5e1' },
      },
      tooltip: {
        trigger: 'axis',
        backgroundColor: '#0b1220',
        borderColor: '#1e293b',
        textStyle: { color: '#e5e7eb' },
        axisPointer: { type: 'line', lineStyle: { color } },
        formatter: (params) => {
          const p = Array.isArray(params) ? params[0] : params;
          const val = (p?.data?.value ?? null);
          const valTxt = (typeof val === 'number') ? val.toFixed(2) : '-';
          return `${label}: ${valTxt}<br/>${p?.axisValueLabel ?? ''}`;
        }
      },
      legend: { show: false },
      series: [
        {
          name: label,
          type: 'line',
          smooth: true,
          connectNulls: true,
          showSymbol: true,
          symbol: 'circle',
          symbolSize: 6,
          itemStyle: { color, borderColor: '#0b1220', borderWidth: 2 },
          lineStyle: { color, width: 3 },
          areaStyle: { color: areaGrad },
          data: seriesData,
          animationDuration: 700,
          animationEasing: 'cubicOut',
          emphasis: {
            focus: 'series',
            itemStyle: { borderWidth: 3 },
          },
        }
      ],
    };
  }, [categories, seriesData, color, label, yDomain]);

  const onEvents = useMemo(() => ({
    click: (p) => {
      if (!onPointClick) return;
      try {
        onPointClick({ name: p?.name, semester_id: p?.data?.semester_id ?? null, value: p?.data?.value ?? null });
      } catch (_) {}
    }
  }), [onPointClick]);

  return (
    <ReactECharts option={option} notMerge lazyUpdate onEvents={onEvents} style={{ width: '100%', height: '100%' }} />
  );
}
