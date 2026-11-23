import userEvent from '@testing-library/user-event';
import { act } from 'react';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { toast } from 'sonner';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { i18n } from '@/shared/i18n/i18n';
import { renderWithProviders } from '@/test/render-with-providers';
import { goalOf } from './daily-tasks.config';
import { AdminDailyTasksPage } from './pages/AdminDailyTasksPage';
import type { DailyTaskListItem, DailyTaskListParams } from './types/daily-task.types';

const list = vi.fn();
const create = vi.fn();
const remove = vi.fn();
const getSettings = vi.fn();
const completions = vi.fn();

vi.mock('./api/daily-tasks.api', () => ({
  dailyTasksApi: {
    list: (params: unknown) => list(params),
    create: (input: unknown) => create(input),
    update: vi.fn(),
    remove: (id: string) => remove(id),
    getSettings: () => getSettings(),
    updateSettings: vi.fn(),
    completionsOverTime: (range: string, date: string) => completions(range, date),
  },
}));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const task = (id: string, title: string, extra: Partial<DailyTaskListItem> = {}): DailyTaskListItem => ({
  _id: id,
  title,
  description: '',
  type: 'sessions',
  target: 3,
  coins: 0,
  isActive: true,
  createdAt: '2026-10-20T00:00:00.000Z',
  updatedAt: '2026-10-20T00:00:00.000Z',
  completions: { learners: 0, hours: [] },
  ...extra,
});

const warmUp = task('t1', 'Warm-up');
const focus = task('t3', 'Focus', { type: 'minigames', target: 5 });
const slowDay = task('t4', 'Slow day', { target: 10, isActive: false });
const extra = task('t5', 'Extra', { type: 'minigames', target: 2 });

const page = (items: DailyTaskListItem[]) => ({ items, page: 1, limit: 10, total: items.length, totalPages: 1 });

/** The list of the page and the count of the active tasks (`isActive: 'true'`) both come from `list`. */
const listWith = (items: DailyTaskListItem[]) =>
  list.mockImplementation(async (params: DailyTaskListParams) => page(params.isActive === 'true' ? items.filter((item) => item.isActive) : items));

const renderPage = (route = '/admin/daily-tasks') => renderWithProviders(<AdminDailyTasksPage />, { route, path: '/admin/daily-tasks' });

/** The value of the stat named `label` of a task card. */
const statOf = (card: HTMLElement, label: string) => within(card).getByText(label).nextElementSibling?.textContent;
const cardOf = (title: string) => screen.getByText(title).closest('article') as HTMLElement;

describe('the admin Daily tasks page in Vietnamese (SCRUM-336)', () => {
  beforeEach(async () => {
    await act(() => i18n.changeLanguage('vi'));
    listWith([warmUp, focus, slowDay, extra]);
    create.mockReset();
    remove.mockReset();
    getSettings.mockReset().mockResolvedValue({ dailyTaskCount: 2 });
    completions.mockReset().mockResolvedValue({
      range: 'week',
      tasks: [{ taskId: 'a', title: 'Warm-up' }],
      points: [{ key: '2026-03-09', learners: 3, tasks: 3, byTask: [{ taskId: 'a', learners: 3 }] }],
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('names the chart, the list, its toolbar and the rows in Vietnamese; the rows show the words built from each task, as the Profile', async () => {
    renderPage();

    const chart = await screen.findByRole('region', { name: 'Lượt hoàn thành nhiệm vụ' });
    expect(within(chart).getByRole('heading', { name: 'Lượt hoàn thành' })).toBeInTheDocument();
    for (const range of ['Tuần', 'Tháng', 'Năm']) expect(within(chart).getByRole('button', { name: range })).toBeInTheDocument();
    expect(await within(chart).findByRole('img', { name: 'Người học hoàn thành nhiệm vụ theo ngày' })).toBeInTheDocument();

    expect(screen.getByRole('heading', { name: 'Danh sách nhiệm vụ' })).toBeInTheDocument();
    expect(screen.getByLabelText('Tìm nhiệm vụ').closest('div.flex')).toHaveTextContent('4Nhiệm vụ');

    const cards = await screen.findByLabelText('Các thẻ nhiệm vụ hằng ngày');
    // The titles the admins wrote are English: the rows show the words built from the type and the target instead.
    expect(within(cards).queryByText('Warm-up')).not.toBeInTheDocument();
    expect(within(cards).getByText('Luyện gõ 3')).toBeInTheDocument();
    expect(within(cards).getByText('Hoàn thành 3 lượt gõ tính điểm trong ngày')).toBeInTheDocument();
    expect(within(cards).getByText('Minigame 5')).toBeInTheDocument();
    expect(within(cards).getByText('Hoàn thành 5 minigame trong ngày')).toBeInTheDocument();
    expect(within(cards).getAllByText('Đang bật')).toHaveLength(3);
    expect(within(cards).getAllByText('Đã tắt')).toHaveLength(1);
    expect(within(cards).getAllByText('Lượt gõ').length).toBeGreaterThan(0);
    expect(within(cards).getAllByText('Minigame').length).toBeGreaterThan(0);
    expect(statOf(cardOf('Luyện gõ 3'), 'XU')).toBe('0');
    expect(statOf(cardOf('Luyện gõ 3'), 'XONG')).toBe('0');
    expect(statOf(cardOf('Luyện gõ 3'), 'LƯỢT GÕ')).toBe('3');
    expect(statOf(cardOf('Minigame 5'), 'MINIGAME')).toBe('5');
    expect(within(cardOf('Luyện gõ 3')).getByText('Chưa ai hoàn thành trong 24 giờ qua')).toBeInTheDocument();

    expect(screen.getByRole('button', { name: 'Chuyển sang Nhiệm vụ hằng ngày' })).toBeInTheDocument();
  });

  // One hover a test: jsdom does not open the next tooltip of the same provider after the first one closes.
  it.each([
    ['Luyện gõ 3', 'Daily Practice 2'],
    ['Hoàn thành 3 lượt gõ tính điểm trong ngày', 'Finish typing session three times'],
  ])('shows what the admin wrote in the tooltip of "%s": what learners read in English', async (shown, written) => {
    const user = userEvent.setup();
    listWith([task('t8', 'Daily Practice 2', { description: 'Finish typing session three times' })]);
    renderPage();

    await user.hover(await screen.findByText(shown));

    await waitFor(() =>
      expect(screen.queryAllByRole('tooltip').map((tip) => tip.textContent)).toContain(
        `Bản admin đã viết (người học thấy khi dùng giao diện tiếng Anh): ${written}`,
      ),
    );
  });

  it('offers the sort in Vietnamese', async () => {
    renderPage();
    await screen.findByLabelText('Các thẻ nhiệm vụ hằng ngày');

    fireEvent.click(screen.getByRole('button', { name: 'Sắp xếp' }));
    const sort = within(screen.getByRole('menu', { name: 'Tùy chọn sắp xếp' }));
    expect(sort.getAllByRole('menuitemradio').map((option) => option.textContent)).toEqual([
      'Mới nhất',
      'Cũ nhất',
      'Mới cập nhật',
      'Tên A–Z',
      'Tên Z–A',
    ]);
  });

  it('offers the Type and Status filters in Vietnamese', async () => {
    renderPage();
    await screen.findByLabelText('Các thẻ nhiệm vụ hằng ngày');

    fireEvent.click(screen.getByRole('button', { name: /Lọc/ }));
    expect(within(screen.getByRole('group', { name: 'Loại' })).getByRole('menuitemradio', { name: 'Minigame' })).toBeInTheDocument();
    expect(within(screen.getByRole('group', { name: 'Trạng thái' })).getByRole('menuitemradio', { name: 'Đã tắt' })).toBeInTheDocument();
  });

  it('says in Vietnamese when the learners completed a task in the last 24 hours', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 2, 10, 15, 30));
    const hours = Array.from({ length: 24 }, (_, index) => {
      const hour = new Date(2026, 2, 9, 16 + index);
      const learners = hour.getTime() === new Date(2026, 2, 9, 23).getTime() ? 1 : hour.getTime() === new Date(2026, 2, 10, 14).getTime() ? 2 : 0;
      return { hour: hour.toISOString(), learners };
    });
    listWith([task('t7', 'Busy', { completions: { learners: 3, hours } })]);
    renderPage();

    await screen.findByLabelText('Các thẻ nhiệm vụ hằng ngày');
    expect(
      within(cardOf('Luyện gõ 3')).getByRole('img', {
        name: 'Được 3 người học hoàn thành trong 24 giờ qua. Hôm qua 23:00–00:00: 1. Hôm nay 14:00–15:00: 2.',
      }),
    ).toBeInTheDocument();
  });

  it('names the actions of a row and asks before deleting in Vietnamese', async () => {
    remove.mockResolvedValue(undefined);
    renderPage();

    const cards = await screen.findByLabelText('Các thẻ nhiệm vụ hằng ngày');
    fireEvent.contextMenu(within(cards).getByRole('group', { name: 'Thao tác cho Minigame 5' }));
    expect(within(cards).getByRole('menuitem', { name: 'Sửa' })).toBeInTheDocument();
    expect(within(cards).getByRole('menuitem', { name: 'Tắt' })).toBeInTheDocument();
    fireEvent.click(within(cards).getByRole('menuitem', { name: 'Xóa' }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Xóa nhiệm vụ này?')).toBeInTheDocument();
    expect(within(dialog).getByText('"Minigame 5" sẽ bị xóa vĩnh viễn. Hãy tắt nhiệm vụ thay vì xóa nếu muốn giữ lại để dùng sau.')).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Xóa' }));

    await waitFor(() => expect(remove).toHaveBeenCalledWith('t3'));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Đã xóa nhiệm vụ hằng ngày.'));
  });

  it('edits a task in a form named in Vietnamese', async () => {
    renderPage();

    const cards = await screen.findByLabelText('Các thẻ nhiệm vụ hằng ngày');
    fireEvent.contextMenu(within(cards).getByRole('group', { name: 'Thao tác cho Luyện gõ 10' }));
    expect(within(cards).getByRole('menuitem', { name: 'Bật' })).toBeInTheDocument();
    fireEvent.click(within(cards).getByRole('menuitem', { name: 'Sửa' }));

    const form = within(screen.getByRole('form', { name: 'Sửa nhiệm vụ' }));
    expect(form.getByLabelText('Tiêu đề')).toHaveValue('Slow day');
    expect(form.getByRole('button', { name: 'Trạng thái: Đã tắt' })).toBeInTheDocument();
    expect(form.getByRole('button', { name: 'Cập nhật nhiệm vụ' })).toBeInTheDocument();
    expect(form.getByRole('button', { name: 'Hủy' })).toBeInTheDocument();
  });

  it('shows the form, its checks and the tasks per day in Vietnamese', async () => {
    create.mockResolvedValue(task('t9', 'Precise'));
    renderPage('/admin/daily-tasks?show=form');

    const form = within(screen.getByRole('form', { name: 'Nhiệm vụ mới' }));
    expect(form.getByLabelText('Tiêu đề')).toHaveAttribute('placeholder', 'Tiêu đề nhiệm vụ');
    expect(form.getByLabelText('Mô tả')).toHaveAttribute('placeholder', 'Mô tả nhiệm vụ cho người học (không bắt buộc)…');
    expect(form.getByRole('button', { name: 'Loại: Lượt gõ' })).toBeInTheDocument();
    expect(form.getByRole('button', { name: 'Trạng thái: Đang bật' })).toBeInTheDocument();
    fireEvent.click(form.getByRole('button', { name: 'Loại: Lượt gõ' }));
    expect(form.getByRole('button', { name: 'Loại: Minigame' })).toBeInTheDocument();
    fireEvent.click(form.getByRole('button', { name: 'Loại: Minigame' }));

    // No title and no coins: the checks answer in Vietnamese.
    fireEvent.change(form.getByLabelText('Xu'), { target: { value: '' } });
    fireEvent.click(form.getByRole('button', { name: 'Thêm nhiệm vụ' }));
    expect(await form.findByText('Cần có tiêu đề')).toBeInTheDocument();
    expect(form.getByText('Nhập một số')).toBeInTheDocument();

    // A target too big for the type.
    fireEvent.change(form.getByLabelText('Tiêu đề'), { target: { value: 'Precise' } });
    fireEvent.change(form.getByLabelText('Xu'), { target: { value: '5' } });
    fireEvent.change(form.getByLabelText('Mục tiêu'), { target: { value: '99' } });
    fireEvent.click(form.getByRole('button', { name: 'Thêm nhiệm vụ' }));
    expect(await form.findByText('Tối đa 20 cho loại này')).toBeInTheDocument();
    expect(create).not.toHaveBeenCalled();

    fireEvent.change(form.getByLabelText('Mục tiêu'), { target: { value: '18' } });
    expect(await form.findByText('Hoàn thành 18 lượt gõ tính điểm')).toBeInTheDocument();

    // The tasks per day, on the right of the title row.
    await screen.findByText('2 mỗi ngày');
    fireEvent.click(screen.getByRole('button', { name: 'Số nhiệm vụ mỗi ngày' }));
    const menu = within(screen.getByRole('menu', { name: 'Tùy chọn Số nhiệm vụ mỗi ngày' }));
    expect(await menu.findByText('Mỗi người học nhận 2 trong 3 nhiệm vụ đang bật mỗi ngày.')).toBeInTheDocument();
    expect(menu.getByRole('menuitemradio', { name: '2 mỗi ngày' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('button', { name: 'Chuyển sang Danh sách nhiệm vụ' })).toBeInTheDocument();
  });

  it('shows the empty states in Vietnamese', async () => {
    listWith([]);
    const { unmount } = renderPage();
    expect(await screen.findByText('Chưa có nhiệm vụ hằng ngày nào')).toBeInTheDocument();
    unmount();

    renderPage('/admin/daily-tasks?type=minigames');
    expect(await screen.findByText('Không có nhiệm vụ phù hợp')).toBeInTheDocument();
    expect(screen.getByText('Thử tìm kiếm hoặc bộ lọc khác.')).toBeInTheDocument();
  });

  it('says what a task asks in Vietnamese', () => {
    expect(goalOf({ type: 'sessions', target: 1 })).toBe('Hoàn thành 1 lượt gõ tính điểm');
    expect(goalOf({ type: 'minigames', target: 3 })).toBe('Hoàn thành 3 minigame');
  });
});
