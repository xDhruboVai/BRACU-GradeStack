import React, { useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import * as echarts from 'echarts/core';
import { PieChart as EPieChart } from 'echarts/charts';
import { TooltipComponent, LegendComponent, TitleComponent, GraphicComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';

echarts.use([EPieChart, TooltipComponent, LegendComponent, TitleComponent, GraphicComponent, CanvasRenderer]);

export default function CreditsProgressEChart({ required = 0, earned = 0 }) {
  const remaining = Math.max(0, Number(required) - Number(earned));
  const pct = Math.max(0, Math.min(100, Math.round((Number(earned) / (Number(required) || 1)) * 100)));

  const option = useMemo(() => {
    
    const earnedColor = new echarts.graphic.LinearGradient(0, 0, 0, 1, [
      { offset: 0, color: '#06b6d4' }, 
      { offset: 1, color: '#0ea5e9' }, 
    ]);
    const remainColor = new echarts.graphic.LinearGradient(0, 0, 0, 1, [
      { offset: 0, color: '#2a2f39' },
      { offset: 1, color: '#1b1f27' },
    ]);

    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'item',
        backgroundColor: '#0b1220',
        borderColor: '#1e293b',
        textStyle: { color: '#e5e7eb' },
        formatter: (p) => `${p.name}: ${p.value} (${Math.round(p.percent)}%)`,
      },
      series: [
        
        {
          type: 'pie',
          silent: true,
          z: 1,
          radius: ['56%', '92%'],
          center: ['50%', '52%'],
          startAngle: 90,
          label: { show: false },
          labelLine: { show: false },
          itemStyle: {
            shadowBlur: 30,
            shadowOffsetY: 12,
            shadowColor: 'rgba(0,0,0,0.45)',
          },
          data: [
            { value: earned, itemStyle: { color: 'rgba(10, 23, 35, 0.85)' } },
            { value: remaining, itemStyle: { color: 'rgba(10, 12, 16, 0.9)' } },
          ],
          hoverAnimation: false,
        },
        
        {
          type: 'pie',
          z: 3,
          radius: ['50%', '90%'],
          center: ['50%', '50%'],
          startAngle: 90,
          label: { show: false },
          labelLine: { show: false },
          itemStyle: {
            borderWidth: 0,
            shadowBlur: 18,
            shadowColor: 'rgba(6, 182, 212, 0.25)',
          },
          data: [
            { name: 'Earned', value: earned, itemStyle: { color: earnedColor } },
            { name: 'Remaining', value: remaining, itemStyle: { color: remainColor } },
          ],
          animationDuration: 600,
          animationEasing: 'cubicOut',
        },
        
        {
          type: 'pie',
          silent: true,
          z: 4,
          radius: ['48%', '50%'],
          center: ['50%', '50%'],
          startAngle: 90,
          label: { show: false },
          labelLine: { show: false },
          data: [
            { value: 100, itemStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: 'rgba(255,255,255,0.12)' },
              { offset: 1, color: 'rgba(255,255,255,0.02)' },
            ]) } },
          ],
          hoverAnimation: false,
        },
      ],
    };
  }, [earned, remaining]);

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 36, width: '100%' }}>
      <div style={{ width: 420, height: 320 }}>
        <ReactECharts option={option} style={{ height: '100%', width: '100%' }} notMerge lazyUpdate opts={{ renderer: 'canvas' }} />
      </div>
      <div style={{ display: 'grid', gap: 8 }}>
        <div style={{ color: '#e5e7eb', fontSize: 18, fontWeight: 700 }}>Progress</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#cbd5e1' }}>
          <span style={{ width: 10, height: 10, background: '#06b6d4', borderRadius: 2 }} /> Earned: {earned}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#cbd5e1' }}>
          <span style={{ width: 10, height: 10, background: '#2a2f39', borderRadius: 2 }} /> Remaining: {remaining}
        </div>
        <div style={{ color: '#cbd5e1' }}>Completion: {pct}%</div>
      </div>
    </div>
  );
}
