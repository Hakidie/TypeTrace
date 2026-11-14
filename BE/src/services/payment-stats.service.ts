// How much each gateway took over time: the points of the bar chart of the admin Payments page. Built like the users chart of the Plans
// page (`getPlanUsersOverTime`): the same ranges and keys (`chartKeys`), one point a month (`year`), a block of 7 days (`month`) or a day (`week`).
import { PaymentModel } from '../models/payment.model';
import { addDays, localDateKey } from '../utils/local-date';
import { ChartRange, chartKeys, firstDayOf, keyOfDay } from './monthly-progress.service';

/** The admin charts are read in Vietnam time (no daylight saving there, so `+07:00` is always right). */
const ADMIN_ZONE = 'Asia/Ho_Chi_Minh';

export interface PaymentRevenuePoint {
  /** The period: 'YYYY-MM' (`year`), the first day of the block (`month`) or the day (`week`), as in the Progress chart. */
  key: string;
  /** VND taken through each gateway in the period. */
  payos: number;
  vnpay: number;
  momo: number;
}

const startOfDay = (day: string) => new Date(`${day}T00:00:00+07:00`);

/**
 * The money of the payments that are paid and given (`status: 'paid'` and `grantedAt` set), by the day they were paid in Vietnam time.
 * A payment without a provider is VNPay's. Periods that have not started are left out. `date` picks the year, month or week as in the Progress chart.
 */
export const getPaymentRevenueOverTime = async (range: ChartRange, date?: string, now = new Date()): Promise<PaymentRevenuePoint[]> => {
  const today = localDateKey(now, ADMIN_ZONE);
  const keys = chartKeys(range, today, date).filter((key) => firstDayOf(key) <= today);
  if (keys.length === 0) return [];
  const points = new Map<string, PaymentRevenuePoint>(keys.map((key) => [key, { key, payos: 0, vnpay: 0, momo: 0 }]));

  // From the first day shown to the end of today: every payment in between is put in the period of its day.
  const paid = await PaymentModel.find({
    status: 'paid',
    grantedAt: { $ne: null },
    paidAt: { $gte: startOfDay(firstDayOf(keys[0])), $lt: startOfDay(addDays(today, 1)) }
  }).select('provider amount paidAt');
  for (const payment of paid) {
    const point = points.get(keyOfDay(range, localDateKey(payment.paidAt!, ADMIN_ZONE)));
    if (point) point[payment.provider ?? 'vnpay'] += payment.amount;
  }
  return [...points.values()];
};
