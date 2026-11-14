import { Calendar, CalendarDays, CalendarRange, Landmark, type LucideIcon } from 'lucide-react';
import { useState } from 'react';
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { anchorFor, periodLabel, periodOptions, periodValue } from '@/modules/profile/lib/chart-period';
import { axisLabel, rangeUnit, tooltipTitle } from '@/modules/profile/lib/month-label';
import type { ChartRange } from '@/modules/profile/types/profile.types';
import { CompactToolbar } from '@/shared/components/compact-toolbar';
import { ErrorState } from '@/shared/components/error-state';
import { LoadingState } from '@/shared/components/loading-state';
import { Panel } from '@/shared/components/panel';
import { dateKeyIn } from '@/shared/lib/local-date';
import { sectionTitleClass } from '@/shared/lib/panel-styles';
import { usePaymentRevenue } from '../hooks/use-payments';
import { formatVnd, PROVIDER_NAMES } from '../lib/store';
import type { PaymentProvider, PaymentRevenuePoint } from '../types/payments.types';

// Week, Month, Year: the smallest first, as on the Progress page and the Plans page.
const RANGE_OPTIONS: { value: ChartRange; label: string }[] = [
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: 'year', label: 'Year' },
];
const ICONS: Record<ChartRange, LucideIcon> = { year: Calendar, month: CalendarRange, week: CalendarDays };

/** The days of the admin charts are Vietnam days (the backend cuts them there too). */
const ADMIN_ZONE = 'Asia/Ho_Chi_Minh';

type GatewayFilter = 'all' | PaymentProvider;
const GATEWAYS: PaymentProvider[] = ['payos', 'vnpay', 'momo'];
const GATEWAY_OPTIONS: { value: GatewayFilter; label: string }[] = [{ value: 'all', label: 'All' }, ...GATEWAYS.map((value) => ({ value, label: PROVIDER_NAMES[value] }))];

// Theme tokens only, as the chart of the Plans page: payOS is the main red bar, VNPay the muted text color, MoMo a lighter red.
const COLORS: Record<PaymentProvider, { fill: string; opacity: number }> = {
  payos: { fill: 'var(--primary)', opacity: 1 },
  vnpay: { fill: 'var(--muted-foreground)', opacity: 1 },
  momo: { fill: 'var(--primary)', opacity: 0.5 },
};
const TICK_SIZE = 16;
const compact = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 });

const BarSample = ({ gateway }: { gateway: PaymentProvider }) => (
  <span aria-hidden className="inline-block size-3 shrink-0" style={{ backgroundColor: COLORS[gateway].fill, opacity: COLORS[gateway].opacity }} />
);

/** The tooltip of a point: the period and the money each gateway took in it. */
const PointTooltip = ({ point, range, shown }: { point: PaymentRevenuePoint; range: ChartRange; shown: PaymentProvider[] }) => (
  <div className="border border-border bg-background px-3 py-2 text-base">
    <p className="font-semibold">{tooltipTitle(range, point.key)}</p>
    {shown.map((gateway) => (
      <p key={gateway} className="flex items-center gap-2">
        <BarSample gateway={gateway} />
        <span>
          <span className="text-muted-foreground">{PROVIDER_NAMES[gateway]}:</span> {formatVnd(point[gateway])}
        </span>
      </p>
    ))}
  </div>
);

/**
 * The money each gateway took over time, built like the users chart of the Plans page: a title and, in the look of the compact toolbar, Week, Month and Year
 * buttons, each with a menu of its own periods, and a Gateway button next to them (All, payOS, VNPay, MoMo); under them a bar chart with one bar a gateway for each period,
 * on the same Y axis (all in VND). Only payments that are paid and given count. The periods to come are not drawn. No frame or background. It takes the height the list under it leaves (at least 20rem), so both fit the screen.
 */
export const PaymentRevenueChart = () => {
  const today = dateKeyIn(new Date(), ADMIN_ZONE);
  const [range, setRange] = useState<ChartRange>('year');
  const [picked, setPicked] = useState<string | null>(null);
  const [gateway, setGateway] = useState<GatewayFilter>('all');
  const date = picked && picked <= today ? picked : today;
  const shown = gateway === 'all' ? GATEWAYS : [gateway];
  const query = usePaymentRevenue(range, date);

  const renderChart = () => {
    if (query.isPending) return <LoadingState rows={1} />;
    if (query.isError) return <ErrorState error={query.error} title="Could not load the revenue chart" onRetry={() => void query.refetch()} />;
    const rangeShown = query.data.range;
    const points = query.data.points;
    const top = Math.max(1, ...points.map((point) => Math.max(...shown.map((name) => point[name]))));
    const marks = [0, Math.round(top / 2), top].filter((mark, index, all) => all.indexOf(mark) === index);
    const data = points.map((point) => ({ ...point, label: axisLabel(rangeShown, point.key) }));
    return (
      // The box is positioned, so the chart reads its size from it.
      <div role="img" aria-label={`Money taken by each gateway by ${rangeUnit(rangeShown)}`} className="relative min-h-80 flex-1">
        <div className="absolute inset-0">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} barGap={4} barCategoryGap="25%" margin={{ top: 8, right: 28, bottom: 0, left: 28 }}>
              <XAxis dataKey="label" interval={0} tickLine={false} axisLine={{ stroke: 'var(--border)' }} height={32} tickSize={0} tickMargin={12} tick={{ fontSize: TICK_SIZE, fill: 'var(--muted-foreground)' }} />
              <YAxis width={72} tickMargin={12} domain={[0, top]} ticks={marks} tickFormatter={(value: number) => compact.format(value)} allowDecimals={false} tickLine={false} stroke="var(--border)" tick={{ fontSize: TICK_SIZE, fill: 'var(--muted-foreground)' }} />
              <Tooltip
                cursor={{ fill: 'var(--primary)', fillOpacity: 0.1 }}
                content={({ payload }) => (payload?.length ? <PointTooltip point={payload[0].payload as PaymentRevenuePoint} range={rangeShown} shown={shown} /> : null)}
              />
              {GATEWAYS.map((name) => (
                <Bar key={name} dataKey={name} hide={!shown.includes(name)} name={PROVIDER_NAMES[name]} fill={COLORS[name].fill} fillOpacity={COLORS[name].opacity} isAnimationActive={false} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  };

  return (
    <section aria-label="Revenue by gateway" className="flex min-h-0 flex-1 flex-col">
      <Panel
        title="Revenue"
        bare
        fill
        titleClassName={sectionTitleClass}
        className="space-y-3"
        actions={
          <CompactToolbar
            menus={[
              ...RANGE_OPTIONS.map(({ value: menuRange, label }) => {
                const active = menuRange === range;
                return {
                  label,
                  icon: ICONS[menuRange],
                  valueLabel: periodLabel(menuRange, date),
                  active,
                  options: periodOptions(menuRange, date, today),
                  value: active ? periodValue(range, date) : '',
                  onChange: (value: string) => {
                    setRange(menuRange);
                    setPicked(anchorFor(menuRange, value, date, today));
                  },
                };
              }),
              // Next to Year: which gateways the chart draws.
              {
                label: 'Gateway',
                icon: Landmark,
                valueLabel: GATEWAY_OPTIONS.find((option) => option.value === gateway)!.label,
                options: GATEWAY_OPTIONS,
                value: gateway,
                onChange: (value: string) => setGateway(value as GatewayFilter),
              },
            ]}
          />
        }
      >
        {renderChart()}
      </Panel>
    </section>
  );
};
