import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { EmptyState } from '@/shared/components/empty-state';
import { Panel } from '@/shared/components/panel';
import type { SessionStats } from '../types/typing.types';
import { errorChartLabels } from '../typing.config';

interface ErrorTypeChartProps {
  stats: SessionStats;
}

const ROW_HEIGHT = 48;

/** Bar chart of the error rate (errors / opportunities) of each error type in one session. Colors are theme tokens. */
export const ErrorTypeChart = ({ stats }: ErrorTypeChartProps) => {
  const data = stats.errorTypes.map((row) => ({ ...row, name: errorChartLabels[row.type] }));
  const hasErrors = stats.wrongWords > 0;

  return (
    <Panel bare title="Lỗi theo loại">
      {!hasErrors ? (
        <EmptyState title="Phiên này không có lỗi nào" description="Chúc mừng, bạn gõ đúng hết các từ." />
      ) : (
        <div role="img" aria-label="Biểu đồ tỉ lệ lỗi theo loại" style={{ height: data.length * ROW_HEIGHT + 40 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ top: 4, right: 56, bottom: 4, left: 8 }}>
              <CartesianGrid horizontal={false} stroke="var(--border)" />
              <XAxis type="number" domain={[0, 100]} unit="%" stroke="var(--muted-foreground)" />
              <YAxis type="category" dataKey="name" width={120} stroke="var(--muted-foreground)" />
              <Tooltip
                cursor={{ fill: 'var(--border)', opacity: 0.4 }}
                contentStyle={{ background: 'var(--background)', border: '1px solid var(--border)', borderRadius: 0 }}
                formatter={(_value, _name, item) => {
                  const row = item.payload as (typeof data)[number];
                  return [`${row.errors} / ${row.opportunities} (${row.rate}%)`, 'Số lỗi'];
                }}
              />
              <Bar dataKey="rate" fill="var(--primary)" radius={0} isAnimationActive={false}>
                <LabelList dataKey="rate" position="right" formatter={(value: number) => `${value}%`} fill="var(--foreground)" />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </Panel>
  );
};
