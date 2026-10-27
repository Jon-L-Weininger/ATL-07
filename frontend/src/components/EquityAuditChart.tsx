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
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 text-sm text-zinc-500">
        Loading Atlanta Census Tract Equity Audit...
      </div>
    );
  }

  const baseline = auditData.atlanta_baseline;
  const matchedAvg = auditData.matched_averages;
  const postings = auditData.matched_postings;

  const textColor = isDark ? '#e4e4e7' : '#27272a';
  const subTextColor = isDark ? '#a1a1aa' : '#71717a';
  const splitLineColor = isDark ? '#27272a' : '#f4f4f5';

  // Chart 1: Matched Recipients Avg vs. Atlanta Metro Baseline + Individual Matched Postings
  const categories = [
    `ATL Metro Baseline (${baseline.total_corpus_rows || 127} Orgs)`,
    'Our Broker Matched Avg',
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
      backgroundColor: isDark ? '#18181b' : '#ffffff',
      borderColor: isDark ? '#3f3f46' : '#e4e4e7',
      textStyle: {
        color: textColor,
        fontFamily: 'DM Sans, sans-serif',
        fontSize: 12,
      },
      valueFormatter: (value: number) => `${value}%`,
    },
    legend: {
      top: 4,
      right: 12,
      textStyle: {
        color: subTextColor,
        fontFamily: 'DM Sans, sans-serif',
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
        rotate: 12,
      },
      axisLine: {
        lineStyle: { color: splitLineColor },
      },
    },
    yAxis: {
      type: 'value',
      name: 'Tract Share (%)',
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
        barMaxWidth: 26,
        itemStyle: { color: '#2563eb', borderRadius: [4, 4, 0, 0] },
        data: noVehicleSeries,
      },
      {
        name: 'Tract Poverty Rate (%)',
        type: 'bar',
        barMaxWidth: 26,
        itemStyle: { color: '#0d9488', borderRadius: [4, 4, 0, 0] },
        data: povertySeries,
      },
      {
        name: 'Public Assistance / SNAP (%)',
        type: 'bar',
        barMaxWidth: 26,
        itemStyle: { color: '#f59e0b', borderRadius: [4, 4, 0, 0] },
        data: assistanceSeries,
      },
    ],
  };

  return (
    <div className="grid grid-cols-1 gap-6">
      {/* Main Full-Width Chart Container */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                Atlanta Census Tract Equity Audit: &ldquo;Did the Food Go Where the Need Is, or Where the Loading Docks Are?&rdquo;
              </h2>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
              Comparing live BigQuery US Census ACS 5-year tract indicators (`a4i_food.tract_demographics` &amp; `a4i_food.recipients_demographics`) for our matched Atlanta recipients against the Atlanta Metro Baseline ({(baseline.no_vehicle_rate * 100).toFixed(1)}% no-vehicle households across {baseline.irs_orgs_count} real IRS organizations + {baseline.planted_cases_count} planted cases).
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <div className="px-3 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800/60">
              <div className="text-[10px] uppercase tracking-wider text-blue-600 dark:text-blue-400 font-semibold">
                Matched No-Vehicle Avg
              </div>
              <div className="text-sm font-mono font-bold text-blue-700 dark:text-blue-300">
                {(matchedAvg.no_vehicle_rate * 100).toFixed(1)}% vs.{' '}
                {(baseline.no_vehicle_rate * 100).toFixed(1)}% ATL Avg
              </div>
            </div>
            <div className="px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/60">
              <div className="text-[10px] uppercase tracking-wider text-emerald-600 dark:text-emerald-400 font-semibold">
                Matched Poverty Avg
              </div>
              <div className="text-sm font-mono font-bold text-emerald-700 dark:text-emerald-300">
                {(matchedAvg.poverty_rate * 100).toFixed(1)}% vs.{' '}
                {(baseline.poverty_rate * 100).toFixed(1)}% ATL Avg
              </div>
            </div>
          </div>
        </div>

        <div className="w-full h-[380px]">
          <ReactECharts
            option={option}
            style={{ height: '100%', width: '100%' }}
            notMerge={true}
          />
        </div>
      </div>

      {/* Tract Breakdown Table + Real vs. Synthetic Data Transparency Card */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 shadow-sm">
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-3 flex items-center gap-2">
            <MapPin className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            Atlanta Census Tracts Reached Across Active Postings (`a4i_food.tract_demographics`)
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-zinc-800 text-[11px] uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  <th className="py-2.5 pr-3">Posting</th>
                  <th className="py-2.5 px-3">Matched Recipient</th>
                  <th className="py-2.5 px-3">Atlanta Neighborhood & FIPS</th>
                  <th className="py-2.5 px-3 text-right">No-Vehicle %</th>
                  <th className="py-2.5 px-3 text-right">Poverty %</th>
                  <th className="py-2.5 pl-3 text-right">Households/Wk</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200/70 dark:divide-zinc-800/70 text-xs">
                {postings.map((row) => (
                  <tr
                    key={row.posting_id}
                    className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors"
                  >
                    <td className="py-2.5 pr-3 font-mono font-medium text-zinc-800 dark:text-zinc-200">
                      #{row.posting_id} · {row.product}
                    </td>
                    <td className="py-2.5 px-3 font-medium text-zinc-900 dark:text-zinc-100">
                      {row.recipient_name}
                    </td>
                    <td className="py-2.5 px-3 text-zinc-600 dark:text-zinc-400">
                      <div>{row.neighborhood}</div>
                      <div className="font-mono text-[10px] text-zinc-400">
                        FIPS {row.geo_id}
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-semibold text-blue-600 dark:text-blue-400">
                      {(row.no_vehicle_rate * 100).toFixed(1)}%
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-emerald-600 dark:text-emerald-400">
                      {(row.poverty_rate * 100).toFixed(1)}%
                    </td>
                    <td className="py-2.5 pl-3 text-right font-mono text-zinc-700 dark:text-zinc-300">
                      {row.weekly_households.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Data Provenance Card (Section 4 of README.md) */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 shadow-sm flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              <Info className="w-4 h-4 text-amber-500" />
              Data Provenance: Half Real, Half Synthetic
            </div>
            <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
              Per the Challenge 2 specification, this broker surfaces which signals come from authoritative public records vs. deterministically generated operational profiles:
            </p>
            <div className="space-y-2 text-xs">
              <div className="p-2.5 rounded-lg bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/70 dark:border-emerald-800/50">
                <div className="font-semibold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  100% Real Public Data
                </div>
                <ul className="mt-1 space-y-1 text-emerald-700 dark:text-emerald-400/90 text-[11px] list-disc list-inside">
                  <li>IRS Exempt Organizations BMF (`ein`, `name`, `street`, `zip_code`, `ntee_code`, `reported_income`)</li>
                  <li>USDA FoodKeeper (`shelf_life` hours & storage notes)</li>
                  <li>US Census ACS (`poverty_rate`, `no_vehicle_rate`, `assistance_rate`)</li>
                </ul>
              </div>
              <div className="p-2.5 rounded-lg bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/70 dark:border-amber-800/50">
                <div className="font-semibold text-amber-800 dark:text-amber-300">
                  Deterministically Generated & Planted (`seed=42`)
                </div>
                <ul className="mt-1 space-y-1 text-amber-700 dark:text-amber-400/90 text-[11px] list-disc list-inside">
                  <li>Operational fields (`cold_storage`, `max_pallets`, `pickup_window_hours`, `profile_text`)</li>
                  <li>9 planted teaching cases (`Greenline` decoy, `Harborview` contradiction, `Cedar/Maple` tie)</li>
                </ul>
              </div>
            </div>
          </div>
          <div className="text-[11px] text-zinc-500 dark:text-zinc-400 border-t border-zinc-200 dark:border-zinc-800 pt-3">
            Metro Bounding Box: <span className="font-mono">33.55..33.92 N, -84.55..-84.28 W</span> (Atlanta, GA)
          </div>
        </div>
      </div>
    </div>
  );
};
