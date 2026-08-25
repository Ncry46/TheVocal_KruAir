import { useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

const packageNames = ['Package 10h', 'Package 20h', 'Package 30h'];

const dailyRevenueValues = [
  42000, 38000, 51000, 47000, 69000, 73000, 58000, 62000, 88000, 79000,
  96000, 104000, 91000, 117000, 132000, 126000, 143000, 119000, 156000, 148000,
  171000, 162000, 188000, 174000, 205000, 197000, 216000, 228000, 241000, 258000,
];

const monthlyRevenueValues = [
  420000, 465000, 510000, 548000, 620000, 690000,
  760000, 820000, 910000, 980000, 1060000, 1180000,
];

const yearlyRevenueValues = [6200000, 8450000, 11200000];

function makeBreakdown(index, scale = 1) {
  return {
    [packageNames[0]]: Math.max(1, Math.round((index % 5) * scale + 3)),
    [packageNames[1]]: Math.max(1, Math.round((index % 4) * scale + 2)),
    [packageNames[2]]: Math.max(1, Math.round((index % 3) * scale + 1)),
  };
}

export const dailyRevenueData = dailyRevenueValues.map((revenue, index) => {
  const day = index + 1;
  return {
    period: `${day} ส.ค.`,
    axisLabel: String(day),
    revenue,
    orders: 6 + (index % 7) + Math.floor(index / 6),
    packages: makeBreakdown(index),
  };
});

export const monthlyRevenueData = [
  'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.',
].map((period, index) => ({
  period,
  axisLabel: period,
  revenue: monthlyRevenueValues[index],
  orders: 44 + index * 4 + (index % 3) * 3,
  packages: makeBreakdown(index + 4, 3),
}));

export const yearlyRevenueData = [2024, 2025, 2026].map((period, index) => ({
  period: String(period),
  axisLabel: String(period),
  revenue: yearlyRevenueValues[index],
  orders: 410 + index * 138,
  packages: makeBreakdown(index + 9, 18),
}));

const timeframeOptions = [
  { key: 'daily', label: 'รายวัน', data: dailyRevenueData },
  { key: 'monthly', label: 'รายเดือน', data: monthlyRevenueData },
  { key: 'yearly', label: 'รายปี', data: yearlyRevenueData },
];

function formatTHB(value) {
  if (value >= 1000000) return `฿${(value / 1000000).toFixed(value % 1000000 === 0 ? 0 : 1)}M`;
  if (value >= 1000) return `฿${Math.round(value / 1000)}k`;
  return `฿${value.toLocaleString('th-TH')}`;
}

function RevenueTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const item = payload[0].payload;
  return (
    <div className="rounded-2xl border border-rose-200/80 bg-white/95 p-4 text-sm shadow-2xl shadow-rose-950/10 backdrop-blur dark:border-rose-300/20 dark:bg-[#20121d]/95">
      <div className="mb-1 font-serif text-base font-bold text-rose-900 dark:text-rose-100">
        {item.period}
      </div>
      <div className="font-bold text-rose-600 dark:text-rose-300">
        รายได้รวม: ฿{item.revenue.toLocaleString('th-TH')}
      </div>
      <div className="mt-1 text-slate-600 dark:text-rose-100/75">
        ออเดอร์ทั้งหมด: {item.orders.toLocaleString('th-TH')}
      </div>
      <div className="mt-3 space-y-1 border-t border-rose-100 pt-3 dark:border-rose-300/15">
        {Object.entries(item.packages).map(([name, units]) => (
          <div key={name} className="flex items-center justify-between gap-6 text-xs">
            <span className="text-slate-500 dark:text-rose-100/65">{name}</span>
            <b className="text-slate-800 dark:text-rose-50">{units} units</b>
          </div>
        ))}
      </div>
    </div>
  );
}

export function RevenueAnalyticsChart() {
  const [timeframe, setTimeframe] = useState('monthly');
  const activeOption = useMemo(
    () => timeframeOptions.find((option) => option.key === timeframe) ?? timeframeOptions[1],
    [timeframe],
  );

  return (
    <section className="rounded-[24px] border border-rose-100 bg-white p-5 shadow-[0_24px_70px_-36px_rgba(200,16,100,0.36)] dark:border-rose-300/15 dark:bg-[#20121d]">
      <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="font-serif text-xl font-bold text-[#2e1220] dark:text-rose-50">
            รายงานยอดขาย (Revenue Analytics)
          </h3>
          <p className="mt-1 text-sm text-[#8a6878] dark:text-rose-100/65">
            วิเคราะห์รายได้ ออเดอร์ และแพ็กเกจขายดีของ Kru Air Vocal Studio
          </p>
        </div>

        <div className="flex rounded-full border border-rose-100 bg-rose-50 p-1 dark:border-rose-300/15 dark:bg-rose-950/20">
          {timeframeOptions.map((option) => {
            const isActive = timeframe === option.key;
            return (
              <button
                key={option.key}
                type="button"
                className={`rounded-full px-4 py-2 text-sm font-bold transition ${
                  isActive
                    ? 'bg-[#fc007a] text-white shadow-lg shadow-rose-500/25'
                    : 'text-[#a0105e] hover:bg-white/75 dark:text-rose-100 dark:hover:bg-white/10'
                }`}
                onClick={() => setTimeframe(option.key)}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="h-[340px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={activeOption.data} margin={{ top: 18, right: 16, left: 4, bottom: 0 }}>
            <defs>
              <linearGradient id="revenueRoseGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#fc007a" stopOpacity={0.35} />
                <stop offset="95%" stopColor="#fc007a" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(252, 0, 122, 0.12)" vertical={false} />
            <XAxis
              dataKey="axisLabel"
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#8a6878', fontSize: 12, fontWeight: 600 }}
              dy={10}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#8a6878', fontSize: 12, fontWeight: 600 }}
              tickFormatter={formatTHB}
              width={62}
            />
            <Tooltip content={<RevenueTooltip />} cursor={{ stroke: '#fc007a', strokeOpacity: 0.2, strokeWidth: 2 }} />
            <Area
              type="monotone"
              dataKey="revenue"
              stroke="#fc007a"
              strokeWidth={3}
              fill="url(#revenueRoseGradient)"
              activeDot={{ r: 6, strokeWidth: 3, stroke: '#fff', fill: '#fc007a' }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
