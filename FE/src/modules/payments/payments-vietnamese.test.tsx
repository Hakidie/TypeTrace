import { act } from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { i18n } from '@/shared/i18n/i18n';
import { ChatComposer } from '@/modules/chat/components/ChatComposer';
import { PlanOfferCard } from '@/modules/plan/components/PlanOfferCard';
import { daysLeftText, failureMessage, formatCoins, momoFailureMessage, timeLeftDetail } from './lib/store';

describe('the Store, plans and chat frame in Vietnamese (SCRUM-333)', () => {
  beforeEach(async () => {
    await act(() => i18n.changeLanguage('vi'));
  });

  it('writes coins, days and payment failures in Vietnamese', () => {
    expect(formatCoins(1400)).toBe('1.400 xu');
    expect(daysLeftText('2026-12-09T10:00:00.000Z', new Date('2026-10-01T10:00:00.000Z'))).toBe('69 ngày');
    expect(timeLeftDetail('2026-12-09T10:00:00.000Z', new Date('2026-10-01T10:00:00.000Z'))).toBe('còn 2 tháng 8 ngày');
    expect(failureMessage('24')).toBe('Bạn đã hủy thanh toán trên VNPay.');
    expect(momoFailureMessage('1005')).toBe('Phiên thanh toán đã hết hạn.');
  });

  it('shows the Premium plan card in Vietnamese', () => {
    render(
      <MemoryRouter>
        <PlanOfferCard planKey="premium" name="Premium" config={{ priceVnd: 49000, maxPassages: 90, canCreateErrorPractice: true, canUsePublicPassages: true }} current used={12} />
      </MemoryRouter>,
    );

    expect(screen.getByRole('group', { name: 'Gói Premium' })).toBeInTheDocument();
    expect(screen.getByText('Gói của bạn')).toBeInTheDocument();
    expect(screen.getByText('đã dùng 12/90')).toBeInTheDocument();
    expect(screen.getByText('Luyện lỗi theo điểm yếu của bạn')).toBeInTheDocument();
  });

  it('labels the chat composer in Vietnamese', () => {
    render(<ChatComposer onSend={() => undefined} />);

    expect(screen.getByRole('textbox', { name: 'Tin nhắn' })).toHaveAttribute('placeholder', expect.stringContaining('Enter để gửi'));
    expect(screen.getByRole('button', { name: 'Gửi' })).toBeInTheDocument();
  });
});
