import type { QueryFilter } from 'mongoose';
import { PaymentDocument, PaymentModel } from '../models/payment.model';
import { UserModel } from '../models/user.model';
import { badRequest, notFound } from '../utils/app-error';
import { paginate } from '../utils/pagination';
import type { ListPaymentsQuery } from '../validators/payment.validator';
import { escapeRegex } from './admin-plan.service';
import { applyPayosReturn } from './payment.service';

/** What an admin sees of one payment: the buyer's name and email (only admins read this), never an id of theirs or a gateway key. */
const rowOf = (payment: PaymentDocument, people: Map<string, { name: string; email: string }>) => {
  const person = people.get(String(payment.owner));
  return {
    _id: String(payment._id),
    userName: person?.name ?? 'Unknown',
    email: person?.email ?? null,
    product: payment.product,
    amount: payment.amount,
    // Payments saved before MoMo have no provider: they are VNPay's.
    provider: payment.provider ?? 'vnpay',
    status: payment.status,
    /** True once the learner got what they bought (`grantPurchase`). */
    granted: Boolean(payment.grantedAt),
    paidAt: payment.paidAt ?? null,
    createdAt: payment.createdAt
  };
};

const peopleOf = async (payments: PaymentDocument[]) => {
  const users = await UserModel.find({ _id: { $in: [...new Set(payments.map((payment) => String(payment.owner)))] } }).select('displayName email');
  return new Map(users.map((user) => [String(user._id), { name: user.displayName || user.email, email: user.email }]));
};

/** The payments of all users, newest first by default. */
export const listPayments = async ({ q, status, provider, ...pagination }: ListPaymentsQuery) => {
  const filter: QueryFilter<PaymentDocument> = {};
  if (status) filter.status = status;
  // A payment without a provider is VNPay's.
  if (provider) filter.provider = provider === 'vnpay' ? { $in: ['vnpay', null] } : provider;
  if (q) {
    const pattern = new RegExp(escapeRegex(q), 'i');
    const users = await UserModel.find({ $or: [{ email: pattern }, { displayName: pattern }] }).select('_id');
    filter.owner = { $in: users.map((user) => user._id) };
  }
  const page = await paginate(PaymentModel, filter, pagination);
  const people = await peopleOf(page.items);
  return { ...page, items: page.items.map((payment) => rowOf(payment, people)) };
};

/**
 * Asks payOS again about a payment (a learner paid, closed the tab and the webhook never came), then gives what was bought.
 * Only a payOS payment that is still pending, or paid but not given yet, has something to check.
 */
export const recheckPayment = async (id: string) => {
  const payment = await PaymentModel.findById(id);
  if (!payment) throw notFound('Payment not found');
  const open = payment.status === 'pending' || (payment.status === 'paid' && !payment.grantedAt);
  if (payment.provider !== 'payos' || !payment.payosOrderCode || !open) throw badRequest('Only an open payOS payment can be checked again');

  const outcome = await applyPayosReturn(payment.payosOrderCode);
  if (!('payment' in outcome)) throw badRequest(outcome.result === 'invalid-amount' ? 'payOS reports another amount' : 'payOS could not confirm this payment');
  // The outcome holds the payment as it was read before the give: read it again to show `granted`.
  const fresh = (await PaymentModel.findById(id)) ?? outcome.payment;
  return rowOf(fresh, await peopleOf([fresh]));
};
