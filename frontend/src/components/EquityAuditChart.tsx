import React from 'react';
import ReactECharts from 'echarts-for-react';
import { EquityAuditResponse } from '../services/brokerApi';
import { ShieldCheck, Info, MapPin, TrendingUp } from 'lucide-react';

interface EquityAuditChartProps {
  auditData: EquityAuditResponse | null;
  isDark: boolean;
}

export const EquityAuditChart: React.FC<EquityAuditChartProps> = ({
  auditData,
  isDark,
}) => {
  if (!auditData) {
    return (
      <div className="bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 text-sm text-slate-500">
        Loading Atlanta Neighborhood Equity Audit...
      </div>
    );
  }

  const baseline = auditData.atlanta_baseline;
  const matchedAvg = auditData.matched_averages;
  const postings = auditData.matched_postings;

  const textColor = isDark ? '#f8fafc' : '#0f172a';
  const subTextColor = isDark ? '#94a3b8' : '#64748b';
  const splitLineColor = isDark ? '#1e293b' : '#e2e8f0';

  const categories = [
    'Atlanta Metro Baseline',
    'Matched Recipients Avg',
    ...postings.map(
      (p) => `#${p.posting_id} ${p.recipient_name.split(' ').slice(0, 2).join(' ')}`,
    ),
  ];

  const noVehicleSeries = [
    +(baseline.no_vehicle_rate * 100).toFixed(1),
    +(matchedAvg.no_vehicle_rate * 100).toFixed(1),
    ...postings.map((p) => +(p.no_vehicle_rate * 100).toFixed(1)),
  ];

  const povertySeries = [
    +(baseline.poverty_rate * 100).toFixed(1),
    +(matchedAvg.poverty_rate * 100).toFixed(1),
    ...postings.map((p) => +(p.poverty_rate * 100).toFixed(1)),
  ];

  const assistanceSeries = [
    +(baseline.assistance_rate * 100).toFixed(1),
    +(matchedAvg.assistance_rate * 100).toFixed(1),
    ...postings.map((p) => +(p.assistance_rate * 100).toFixed(1)),
  ];

  const option = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      backgroundColor: isDark ? '#0f172a' : '#ffffff',
      borderColor: isDark ? '#334155' : '#e2e8f0',
      textStyle: {
        color: textColor,
        fontFamily: 'Inter, sans-serif',
        fontSize: 12,
      },
      valueFormatter: (value: number) => `${value}%`,
    },
    legend: {
      top: 4,
      right: 12,
      textStyle: {
        color: subTextColor,
        fontFamily: 'Inter, sans-serif',
        fontSize: 12,
      },
    },
    grid: {
      left: '3%',
      right: '3%',
      bottom: '10%',
      top: '16%',
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      data: categories,
      axisLabel: {
        color: subTextColor,
        fontSize: 11,
        interval: 0,
        rotate: 10,
      },
      axisLine: {
        lineStyle: { color: splitLineColor },
      },
    },
    yAxis: {
      type: 'value',
      name: 'Neighborhood Share (%)',
      nameTextStyle: { color: subTextColor, fontSize: 11 },
      axisLabel: {
        color: subTextColor,
        formatter: '{value}%',
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: 11,
      },
      splitLine: {
        lineStyle: { color: splitLineColor, type: 'dashed' },
      },
    },
    series: [
      {
        name: 'No-Vehicle Households (%)',
        type: 'bar',
        barMaxWidth: 28,
        itemStyle: { color: isDark ? '#10b981' : '#059669', borderRadius: [5, 5, 0, 0] },
        data: noVehicleSeries,
      },
      {
        name: 'Tract Poverty Rate (%)',
        type: 'bar',
        barMaxWidth: 28,
        itemStyle: { color: '#f59e0b', borderRadius: [5, 5, 0, 0] },
        data: povertySeries,
      },
      {
        name: 'SNAP / Public Assistance (%)',
        type: 'bar',
        barMaxWidth: 28,
        itemStyle: { color: isDark ? '#64748b' : '#94a3b8', borderRadius: [5, 5, 0, 0] },
        data: assistanceSeries,
      },
    ],
  };

  return (
    <div className="grid grid-cols-1 gap-6">
      {/* Main Chart Card */}
      <div className="bg-white dark:bg-[#0F172A] border border-slate-200/90 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <h2 className="text-lg font-display font-semibold text-slate-900 dark:text-slate-100">
                Did the Food Go Where the Need Is, or Where the Loading Docks Are?
              </h2>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-3xl">
              Comparing US Census ACS neighborhood indicators for our matched retail rescue recipients against the Atlanta Metro baseline ({(baseline.no_vehicle_rate * 100).toFixed(1)}% no-vehicle households across {baseline.total_corpus_rows || 127} local organizations).
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <div className="px-3.5 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200/80 dark:border-emerald-800/60">
              <div className="text-[10px] uppercase tracking-wider text-emerald-700 dark:text-emerald-400 font-semibold">
                Matched No-Vehicle Avg
              </div>
              <div className="text-sm font-mono font-bold text-emerald-800 dark:text-emerald-300 tabular-nums">
                {(matchedAvg.no_vehicle_rate * 100).toFixed(1)}% vs.{' '}
                {(baseline.no_vehicle_rate * 100).toFixed(1)}% ATL
              </div>
            </div>
            <div className="px-3.5 py-2 rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200/80 dark:border-amber-800/60">
              <div className="text-[10px] uppercase tracking-wider text-amber-700 dark:text-amber-400 font-semibold">
                Matched Poverty Avg
              </div>
              <div className="text-sm font-mono font-bold text-amber-800 dark:text-amber-300 tabular-nums">
                {(matchedAvg.poverty_rate * 100).toFixed(1)}% vs.{' '}
                {(baseline.poverty_rate * 100).toFixed(1)}% ATL
              </div>
            </div>
          </div>
        </div>

        <div className="w-full h-[360px]">
          <ReactECharts
            option={option}
            style={{ height: '100%', width: '100%' }}
            notMerge={true}
          />
        </div>
      </div>

      {/* Breakdown Table + Data Provenance */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white dark:bg-[#0F172A] border border-slate-200/90 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
          <h3 className="text-base font-display font-semibold text-slate-900 dark:text-slate-100 mb-3 flex items-center gap-2">
            <MapPin className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            Neighborhoods Reached Across Active Retail Rescues
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  <th className="py-2.5 pr-3">Offer</th>
                  <th className="py-2.5 px-3">Matched Recipient</th>
                  <th className="py-2.5 px-3">Neighborhood</th>
                  <th className="py-2.5 px-3 text-right">No-Vehicle %</th>
                  <th className="py-2.5 px-3 text-right">Poverty %</th>
                  <th className="py-2.5 pl-3 text-right">Households/Wk</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/70 dark:divide-slate-800/70 text-xs">
                {postings.map((row) => (
                  <tr
                    key={row.posting_id}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="py-3 pr-3 font-mono font-medium text-slate-800 dark:text-slate-200">
                      #{row.posting_id} · {row.product}
                    </td>
                    <td className="py-3 px-3 font-medium text-slate-900 dark:text-slate-100">
                      {row.recipient_name}
                    </td>
                    <td className="py-3 px-3 text-slate-600 dark:text-slate-400">
                      <div>{row.neighborhood}</div>
                      <div className="font-mono text-[10px] text-slate-400">
                        Tract {row.geo_id}
                      </div>
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">
                      {(row.no_vehicle_rate * 100).toFixed(1)}%
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-amber-600 dark:text-amber-400 tabular-nums">
                      {(row.poverty_rate * 100).toFixed(1)}%
                    </td>
                    <td className="py-3 pl-3 text-right font-mono text-slate-700 dark:text-slate-300 tabular-nums">
                      {row.weekly_households.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Data Provenance Card */}
        <div className="bg-white dark:bg-[#0F172A] border border-slate-200/90 dark:border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-base font-display font-semibold text-slate-900 dark:text-slate-100">
              <Info className="w-4 h-4 text-amber-500" />
              Data Transparency: Real vs. Generated
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              This dashboard combines authoritative public records with realistic operational capacity profiles:
            </p>
            <div className="space-y-2.5 text-xs">
              <div className="p-3 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/70 dark:border-emerald-800/50">
                <div className="font-semibold text-emerald-900 dark:text-emerald-300 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Authoritative Public Records
                </div>
                <ul className="mt-1.5 space-y-1 text-emerald-800 dark:text-emerald-400/90 text-[11px] list-disc list-inside">
                  <li>IRS Exempt Organizations (names, addresses, reported income)</li>
                  <li>USDA FoodKeeper shelf-life guidance (661 products)</li>
                  <li>US Census ACS neighborhood poverty &amp; vehicle access</li>
                </ul>
              </div>
              <div className="p-3 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/70 dark:border-amber-800/50">
                <div className="font-semibold text-amber-900 dark:text-amber-300">
                  Simulated Operational Profiles
                </div>
                <ul className="mt-1.5 space-y-1 text-amber-800 dark:text-amber-400/90 text-[11px] list-disc list-inside">
                  <li>Cold storage type, pallet limits, and pickup windows</li>
                  <li>Planted safety test cases (near-miss decoys &amp; contradictions)</li>
                </ul>
              </div>
            </div>
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 border-t border-slate-200 dark:border-slate-800 pt-3">
            Coverage Area: <span className="font-mono">Atlanta Metro, GA</span>
          </div>
        </div>
      </div>
    </div>
  );
};
