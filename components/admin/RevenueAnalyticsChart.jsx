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
    <div className="revenue-tooltip">
      <div className="revenue-tooltip-title">
        {item.period}
      </div>
      <div className="revenue-tooltip-total">
        รายได้รวม: ฿{item.revenue.toLocaleString('th-TH')}
      </div>
      <div className="revenue-tooltip-orders">
        ออเดอร์ทั้งหมด: {item.orders.toLocaleString('th-TH')}
      </div>
      <div className="revenue-tooltip-breakdown">
        {Object.entries(item.packages).map(([name, units]) => (
          <div key={name} className="revenue-tooltip-row">
            <span>{name}</span>
            <b>{units} units</b>
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
    <section className="revenue-analytics-card">
      <div className="revenue-analytics-head">
        <div>
          <h3>
            รายงานยอดขาย (Revenue Analytics)
          </h3>
          <p>
            วิเคราะห์รายได้ ออเดอร์ และแพ็กเกจขายดีของ Kru Air Vocal Studio
          </p>
        </div>

        <div className="timeframe-toggle">
          {timeframeOptions.map((option) => {
            const isActive = timeframe === option.key;
            return (
              <button
                key={option.key}
                type="button"
                className={isActive ? 'active' : ''}
                onClick={() => setTimeframe(option.key)}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="revenue-chart-shell">
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
