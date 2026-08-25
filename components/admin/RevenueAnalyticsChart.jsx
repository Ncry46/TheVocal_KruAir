import { useEffect, useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

const colors = ['#fc007a', '#a0105e', '#ff87ba', '#6d0a40', '#ff4d9d'];

const timeframeLabels = {
  daily: 'รายวัน',
  monthly: 'รายเดือน',
  yearly: 'รายปี',
};

function formatTHB(value) {
  if (value >= 1000000) return `฿${(value / 1000000).toFixed(value % 1000000 === 0 ? 0 : 1)}M`;
  if (value >= 1000) return `฿${Math.round(value / 1000)}k`;
  return `฿${Number(value || 0).toLocaleString('th-TH')}`;
}

function normalizePoint(point) {
  return {
    key: point.key,
    period: point.period,
    axisLabel: point.axisLabel ?? point.period,
    revenue: Number(point.revenue ?? 0),
    orders: Number(point.orders ?? 0),
    packages: point.packages ?? {},
    year: point.year,
    month: point.month,
    day: point.day,
  };
}

function RevenueTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const item = payload[0].payload;
  return (
    <div className="revenue-tooltip">
      <div className="revenue-tooltip-title">{item.period}</div>
      <div className="revenue-tooltip-total">
        รายได้รวม: ฿{item.revenue.toLocaleString('th-TH')}
      </div>
      <div className="revenue-tooltip-orders">
        ออเดอร์ทั้งหมด: {item.orders.toLocaleString('th-TH')}
      </div>
      <div className="revenue-tooltip-breakdown">
        {Object.entries(item.packages).length > 0 ? (
          Object.entries(item.packages).map(([name, units]) => (
            <div key={name} className="revenue-tooltip-row">
              <span>{name}</span>
              <b>{units} units</b>
            </div>
          ))
        ) : (
          <div className="revenue-tooltip-empty">ยังไม่มีรายการขายในช่วงนี้</div>
        )}
      </div>
    </div>
  );
}

function DonutTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const item = payload[0].payload;
  return (
    <div className="revenue-tooltip">
      <div className="revenue-tooltip-title">{item.name}</div>
      <div className="revenue-tooltip-total">{item.value} units</div>
    </div>
  );
}

export function RevenueAnalyticsChart({ analytics }) {
  const [timeframe, setTimeframe] = useState('monthly');
  const [selectedYear, setSelectedYear] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('');
  const [focusedPoint, setFocusedPoint] = useState(null);
  const timeframeOptions = useMemo(
    () => ['daily', 'monthly', 'yearly'].map((key) => ({
      key,
      label: timeframeLabels[key],
      data: (analytics?.[key] ?? []).map(normalizePoint),
    })),
    [analytics],
  );
  const activeOption = useMemo(
    () => timeframeOptions.find((option) => option.key === timeframe) ?? timeframeOptions[1],
    [timeframe, timeframeOptions],
  );
  const availableYears = useMemo(
    () => Array.from(new Set(activeOption.data.map((item) => item.year).filter(Boolean))).sort((a, b) => b - a),
    [activeOption.data],
  );
  const availableMonths = useMemo(
    () => Array.from(new Set(activeOption.data
      .filter((item) => !selectedYear || item.year === Number(selectedYear))
      .map((item) => item.month)
      .filter(Boolean))).sort((a, b) => b - a),
    [activeOption.data, selectedYear],
  );
  useEffect(() => {
    const years = Array.from(new Set(activeOption.data.map((item) => item.year).filter(Boolean))).sort((a, b) => b - a);
    setSelectedYear((current) => (current && years.includes(Number(current)) ? current : String(years[0] ?? '')));
    setFocusedPoint(null);
  }, [activeOption.data, timeframe]);
  useEffect(() => {
    if (timeframe !== 'daily') {
      setSelectedMonth('');
      return;
    }
    const months = Array.from(new Set(activeOption.data
      .filter((item) => !selectedYear || item.year === Number(selectedYear))
      .map((item) => item.month)
      .filter(Boolean))).sort((a, b) => b - a);
    setSelectedMonth((current) => (current && months.includes(Number(current)) ? current : String(months[0] ?? '')));
  }, [activeOption.data, selectedYear, timeframe]);
  const filteredData = useMemo(() => activeOption.data.filter((item) => {
    if (timeframe === 'yearly') return true;
    if (selectedYear && item.year !== Number(selectedYear)) return false;
    if (timeframe === 'daily' && selectedMonth && item.month !== Number(selectedMonth)) return false;
    return true;
  }), [activeOption.data, selectedMonth, selectedYear, timeframe]);
  const donutData = useMemo(() => {
    const donutSource = focusedPoint ? [focusedPoint] : filteredData;
    const totals = new Map();
    donutSource.forEach((point) => {
      Object.entries(point.packages).forEach(([name, units]) => {
        totals.set(name, (totals.get(name) ?? 0) + Number(units || 0));
      });
    });
    return Array.from(totals, ([name, value]) => ({ name, value }))
      .filter((item) => item.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [filteredData, focusedPoint]);
  const bestSeller = donutData[0];
  const monthLabel = (month) => new Date(2026, Number(month) - 1, 1).toLocaleString('th-TH', { month: 'short' });
  const focusChartPoint = (state) => {
    const next = state?.activePayload?.[0]?.payload;
    if (next) setFocusedPoint(next);
  };

  return (
    <section className="revenue-analytics-card">
      <div className="revenue-analytics-head">
        <div>
          <h3>รายงานยอดขาย (Revenue Analytics)</h3>
          <p>ข้อมูลจากฐานข้อมูลจริงของ Kru Air Vocal Studio</p>
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

      <div className="revenue-period-controls">
        {timeframe !== 'yearly' && availableYears.length > 0 && (
          <select className="input revenue-period-select" value={selectedYear} onChange={(e) => setSelectedYear(e.target.value)}>
            {availableYears.map((year) => <option key={year} value={year}>{year}</option>)}
          </select>
        )}
        {timeframe === 'daily' && availableMonths.length > 0 && (
          <select className="input revenue-period-select" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)}>
            {availableMonths.map((month) => <option key={month} value={month}>{monthLabel(month)}</option>)}
          </select>
        )}
        {focusedPoint && (
          <button className="btn ghost sm" type="button" onClick={() => setFocusedPoint(null)}>
            ดูรวมทั้งช่วง
          </button>
        )}
      </div>

      <div className="revenue-analytics-grid">
        <div className="revenue-chart-shell">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={filteredData}
              margin={{ top: 18, right: 16, left: 4, bottom: 0 }}
              onMouseMove={focusChartPoint}
              onClick={focusChartPoint}
            >
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

        <aside className="package-donut-card">
          <div>
            <h4>แพ็กเกจขายดีที่สุด</h4>
            <p>{bestSeller ? `${bestSeller.name} · ${bestSeller.value} units${focusedPoint ? ` · ${focusedPoint.period}` : ''}` : 'ยังไม่มีข้อมูลการขาย'}</p>
          </div>
          <div className="package-donut-shell">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Tooltip content={<DonutTooltip />} />
                <Pie
                  data={donutData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius="62%"
                  outerRadius="86%"
                  paddingAngle={4}
                  stroke="var(--card)"
                  strokeWidth={4}
                >
                  {donutData.map((entry, index) => (
                    <Cell key={entry.name} fill={colors[index % colors.length]} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="package-donut-center">
              <b>{bestSeller?.value ?? 0}</b>
              <span>units</span>
            </div>
          </div>
          <div className="package-donut-legend">
            {donutData.map((item, index) => (
              <div key={item.name}>
                <i style={{ background: colors[index % colors.length] }} />
                <span>{item.name}</span>
                <b>{item.value}</b>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </section>
  );
}
