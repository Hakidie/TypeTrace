import userEvent from '@testing-library/user-event';
import { act } from 'react';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { toast } from 'sonner';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { i18n } from '@/shared/i18n/i18n';
import { renderWithProviders } from '@/test/render-with-providers';
import { AdminPassagesPage } from './pages/AdminPassagesPage';

const list = vi.fn();
const create = vi.fn();
const update = vi.fn();
const setStatus = vi.fn();
const approve = vi.fn();
const reject = vi.fn();
const bulkApprove = vi.fn();
const bulkReject = vi.fn();
const remove = vi.fn();

vi.mock('./api/passages.api', () => ({
  passagesApi: {
    list: (params: unknown) => list(params),
    create: (input: unknown) => create(input),
    update: (id: string, input: unknown) => update(id, input),
    setStatus: (id: string, status: unknown) => setStatus(id, status),
    remove: (id: string) => remove(id),
    approve: (id: string) => approve(id),
    reject: (id: string, reason: string) => reject(id, reason),
    bulkApprove: (ids: string[]) => bulkApprove(ids),
    bulkReject: (ids: string[], reason: string) => bulkReject(ids, reason),
  },
}));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const passage = {
  _id: 'p1',
  title: 'Mùa thu Hà Nội',
  content: 'Hà Nội mùa thu thật đẹp.',
  source: 'TypeTrace',
  ownerName: 'TypeTrace',
  status: 'draft',
  isPlacement: false,
  isRanked: false,
  wordCount: 6,
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-01T00:00:00.000Z',
};

const waitingA = {
  ...passage,
  _id: 'pA',
  title: 'Sông quê',
  content: 'Dòng sông quê hương hiền hòa chảy qua làng.',
  source: 'Sách Tiếng Việt lớp 5',
  ownerName: 'Lan',
  status: 'pending',
  visibility: 'private',
  wordCount: 21,
  updatedAt: '2026-10-20T12:00:00.000Z',
};

const waitingB = { ...waitingA, _id: 'pB', title: 'Biển xanh', ownerName: 'Minh', updatedAt: '2026-10-21T12:00:00.000Z' };

/** The passage bank answers `bank`, the Pending review queue (`status: 'pending'`) answers `pending`. */
const answer = ({ bank = [passage], pending = [] }: { bank?: unknown[]; pending?: unknown[] } = {}) =>
  list.mockImplementation(async (params: { status?: string; limit?: number }) => {
    const items = params.status === 'pending' ? pending : bank;
    return { items, page: 1, limit: params.limit ?? 9, total: items.length, totalPages: 1 };
  });

const renderPage = (route = '/admin/passages') => renderWithProviders(<AdminPassagesPage />, { route });

describe('the admin Passages page in Vietnamese (SCRUM-336)', () => {
  beforeEach(async () => {
    for (const mock of [list, create, update, setStatus, approve, reject, bulkApprove, bulkReject, remove]) mock.mockReset();
    vi.mocked(toast.success).mockClear();
    answer();
    await act(() => i18n.changeLanguage('vi'));
  });

  it('names the passage list, its toolbar, its cards and its filters in Vietnamese', async () => {
    answer({ bank: [{ ...passage, status: 'published', language: 'en' }] });
    const user = userEvent.setup();
    renderPage();

    expect(screen.getByRole('heading', { name: /Danh sách đoạn văn/ })).toBeInTheDocument();
    expect(await screen.findByText('Mùa thu Hà Nội')).toBeInTheDocument();
    expect(screen.getByLabelText('Các thẻ đoạn văn')).toBeInTheDocument();
    expect(screen.getByText('6 từ')).toBeInTheDocument();
    expect(screen.getByText('Tiếng Anh')).toBeInTheDocument();
    // The status is written as it shows: not capitalized word by word by CSS, as the lowercase English one is.
    expect(screen.getByText('Đã đăng')).not.toHaveClass('capitalize');
    expect(screen.getByLabelText('Tìm đoạn văn').closest('div.flex')!).toHaveTextContent('1Đoạn văn');
    expect(screen.getByRole('button', { name: 'Chuyển sang Chờ duyệt' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Chuyển sang Đoạn văn mới' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Tìm đoạn văn' }));
    expect(screen.getByRole('textbox', { name: 'Tìm đoạn văn' })).toHaveAttribute('placeholder', 'Tìm theo tên hoặc nguồn…');

    await user.click(screen.getByRole('button', { name: 'Sắp xếp' }));
    for (const option of ['Mới nhất', 'Cũ nhất', 'Mới cập nhật', 'Tên A–Z', 'Tên Z–A', 'Ngắn nhất', 'Dài nhất']) {
      expect(await screen.findByRole('menuitemradio', { name: option })).toBeInTheDocument();
    }
    await user.keyboard('{Escape}');

    await user.click(screen.getByRole('button', { name: /Lọc/ }));
    const status = await screen.findByRole('group', { name: 'Trạng thái' });
    for (const option of ['Bản nháp', 'Đã đăng', 'Đã lưu trữ']) expect(within(status).getByRole('menuitemradio', { name: option })).toBeInTheDocument();
    const type = screen.getByRole('group', { name: 'Loại' });
    for (const option of ['Kiểm tra', 'Luyện tập', 'Xếp hạng']) expect(within(type).getByRole('menuitemradio', { name: option })).toBeInTheDocument();
    const language = screen.getByRole('group', { name: 'Ngôn ngữ' });
    for (const option of ['Tiếng Việt', 'Tiếng Anh']) expect(within(language).getByRole('menuitemradio', { name: option })).toBeInTheDocument();
  });

  it('says in Vietnamese when there is no passage, or none that matches', async () => {
    answer({ bank: [] });
    renderPage();
    expect(await screen.findByText('Chưa có đoạn văn nào')).toBeInTheDocument();
    expect(screen.getByText('Thêm đoạn văn đầu tiên bằng biểu mẫu ở trên.')).toBeInTheDocument();
  });

  it('says in Vietnamese when no passage matches the search', async () => {
    answer({ bank: [] });
    renderPage('/admin/passages?q=biển');
    expect(await screen.findByText('Không có đoạn văn phù hợp')).toBeInTheDocument();
    expect(screen.getByText('Thử tìm kiếm hoặc bộ lọc khác.')).toBeInTheDocument();
  });

  it('labels the form, its switches and its errors in Vietnamese, and says the new passage is a draft', async () => {
    create.mockResolvedValue({ ...passage, title: 'Biển' });
    renderPage('/admin/passages?show=form');

    expect(screen.getByRole('heading', { name: 'Đoạn văn mới' })).toBeInTheDocument();
    expect(screen.getByLabelText('Tiêu đề')).toHaveAttribute('placeholder', 'Tiêu đề đoạn văn');
    expect(screen.getByLabelText('Nội dung')).toHaveAttribute('placeholder', 'Dán hoặc gõ văn bản bạn muốn luyện…');
    expect(screen.getByRole('switch', { name: 'Đoạn văn tiếng Anh' })).toHaveTextContent('Tiếng Việt');
    expect(screen.getByRole('switch', { name: 'Đoạn văn kiểm tra' })).toHaveTextContent('Đoạn văn thường');
    expect(screen.getByRole('button', { name: 'Chuyển sang Danh sách đoạn văn' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Thêm đoạn văn' }));
    expect(await screen.findByText('Cần có tiêu đề')).toBeInTheDocument();
    expect(screen.getByText('Cần có nguồn')).toBeInTheDocument();
    expect(screen.getByText('Cần có nội dung')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Tiêu đề'), { target: { value: 'Biển' } });
    fireEvent.change(screen.getByLabelText('Nguồn'), { target: { value: 'TypeTrace' } });
    fireEvent.change(screen.getByLabelText('Nội dung'), { target: { value: Array(201).fill('từ').join(' ') } });
    expect(screen.getByText('201/200 từ')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Thêm đoạn văn' }));
    expect(await screen.findByText('Tối đa 200 từ')).toBeInTheDocument();
    expect(create).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText('Nội dung'), { target: { value: 'Biển xanh bao la.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Thêm đoạn văn' }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Đã tạo đoạn văn ở dạng bản nháp.'));
  });

  it('names the status button and the ranked switch of the edit form in Vietnamese', async () => {
    answer({ bank: [{ ...passage, status: 'published', language: 'en' }] });
    update.mockResolvedValue({ ...passage, status: 'published', language: 'en' });
    setStatus.mockResolvedValue({ ...passage, status: 'archived', language: 'en' });
    renderPage();
    await screen.findByText('Mùa thu Hà Nội');

    fireEvent.click(screen.getByRole('button', { name: 'Sửa Mùa thu Hà Nội' }));
    expect(screen.getByRole('heading', { name: 'Sửa đoạn văn' })).toBeInTheDocument();
    const status = screen.getByRole('button', { name: 'Trạng thái: Đã đăng' });
    expect(status).toHaveTextContent('Đã đăng');
    expect(status).not.toHaveClass('capitalize');
    expect(screen.getByRole('switch', { name: 'Bài xếp hạng' })).toHaveTextContent('Không xếp hạng');
    expect(screen.getByRole('switch', { name: 'Đoạn văn tiếng Anh' })).toHaveTextContent('Tiếng Anh');
    expect(screen.getByRole('button', { name: 'Hủy' })).toBeInTheDocument();

    fireEvent.click(status);
    expect(screen.getByRole('button', { name: 'Trạng thái: Đã lưu trữ' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cập nhật đoạn văn' }));
    await waitFor(() => expect(setStatus).toHaveBeenCalledWith('p1', 'archived'));
    expect(toast.success).toHaveBeenCalledWith('Đã cập nhật đoạn văn.');
    expect(toast.success).toHaveBeenCalledWith('Đã lưu trữ đoạn văn.');
  });

  it('asks in Vietnamese before deleting a passage for good, and says it is deleted', async () => {
    answer({ bank: [{ ...passage, status: 'archived' }] });
    remove.mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Mùa thu Hà Nội');

    await user.click(screen.getByRole('button', { name: 'Xóa Mùa thu Hà Nội' }));
    const dialog = await screen.findByRole('dialog', { name: 'Xóa vĩnh viễn đoạn văn này?' });
    expect(within(dialog).getByText('"Mùa thu Hà Nội" sẽ bị xóa vĩnh viễn. Không thể xóa đoạn văn mà người học đã gõ.')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Xóa' }));

    await waitFor(() => expect(remove).toHaveBeenCalledWith('p1'));
    expect(toast.success).toHaveBeenCalledWith('Đã xóa đoạn văn.');
  });

  describe('the Pending review queue', () => {
    const edit = {
      ...waitingB,
      status: 'published',
      visibility: 'public',
      pendingEdit: { title: 'Biển xanh mới', source: 'Sách mới', content: 'Sóng biển đổi mới.' },
    };

    const openQueue = async (items: unknown[] = [waitingA, waitingB]) => {
      answer({ pending: items });
      const user = userEvent.setup();
      renderPage('/admin/passages?view=pending');
      const queue = await screen.findByLabelText('Các đoạn văn đang chờ duyệt');
      await within(queue).findByText('Sông quê');
      return { user, queue };
    };

    it('shows the requests, their toolbar and their filters in Vietnamese', async () => {
      const { user, queue } = await openQueue([waitingA, edit]);
      const asked = new Date(waitingA.updatedAt).toLocaleDateString('vi-VN', { day: '2-digit', month: 'short', year: 'numeric' });

      expect(screen.getByRole('heading', { name: /Chờ duyệt/ })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Chuyển sang Danh sách đoạn văn' })).toBeInTheDocument();
      expect(within(queue).getByText(`Lan · Sách Tiếng Việt lớp 5 · gửi ngày ${asked}`)).toBeInTheDocument();
      expect(within(queue).getByText('Bản sửa')).toBeInTheDocument();
      expect(within(queue).getByText('Chờ duyệt')).not.toHaveClass('capitalize');
      expect(within(queue).getByText('Đã đăng')).toBeInTheDocument();
      expect(within(queue).getByRole('button', { name: 'Xem Sông quê' })).toHaveAttribute('title', 'Xem');
      expect(within(queue).getByRole('button', { name: 'Duyệt Sông quê' })).toHaveAttribute('title', 'Duyệt');
      expect(within(queue).getByRole('button', { name: 'Từ chối Biển xanh mới' })).toHaveAttribute('title', 'Từ chối');
      expect(screen.getByLabelText('Tìm yêu cầu').closest('div.flex')!).toHaveTextContent('2Đang chờ');

      await user.click(screen.getByRole('button', { name: 'Sắp xếp' }));
      for (const option of ['Yêu cầu cũ nhất', 'Yêu cầu mới nhất', 'Tên A–Z', 'Ngắn nhất', 'Dài nhất']) {
        expect(await screen.findByRole('menuitemradio', { name: option })).toBeInTheDocument();
      }
      await user.keyboard('{Escape}');
      await user.click(screen.getByRole('button', { name: /Lọc/ }));
      const kind = await screen.findByRole('group', { name: 'Loại' });
      expect(within(kind).getByRole('menuitemradio', { name: 'Bản sửa' })).toBeInTheDocument();
      expect(within(kind).getByRole('menuitemradio', { name: 'Yêu cầu công khai' })).toBeInTheDocument();
    });

    it('says in Vietnamese when nothing waits', async () => {
      answer({ pending: [] });
      renderPage('/admin/passages?view=pending');
      expect(await screen.findByText('Không có gì cần duyệt')).toBeInTheDocument();
      expect(screen.getByText('Yêu cầu công khai đoạn văn của người học sẽ hiện ở đây.')).toBeInTheDocument();
    });

    it('reads a request and turns it down with a reason, in Vietnamese', async () => {
      reject.mockResolvedValue({ ...waitingA, status: 'rejected', reviewNote: 'Trùng nội dung' });
      const { user, queue } = await openQueue();

      await user.click(within(queue).getByRole('button', { name: 'Xem Sông quê' }));
      const view = await screen.findByRole('dialog', { name: 'Sông quê' });
      expect(within(view).getByText('Lan · 21 từ')).toBeInTheDocument();
      expect(within(view).getByText('Nguồn: Sách Tiếng Việt lớp 5')).toBeInTheDocument();
      expect(within(view).getByRole('button', { name: 'Duyệt' })).toBeInTheDocument();
      await user.click(within(view).getByRole('button', { name: 'Từ chối' }));

      const dialog = await screen.findByRole('dialog', { name: 'Từ chối "Sông quê"?' });
      expect(within(dialog).getByText('Đoạn văn vẫn riêng tư với tác giả, người sẽ thấy lý do của bạn.')).toBeInTheDocument();
      const reason = within(dialog).getByLabelText('Lý do');
      expect(reason).toHaveAttribute('placeholder', 'Vì sao từ chối? Người học sẽ thấy nội dung này.');
      const confirm = within(dialog).getByRole('button', { name: 'Từ chối' });
      expect(confirm).toBeDisabled();
      expect(within(dialog).getByRole('button', { name: 'Hủy' })).toBeInTheDocument();
      await user.type(reason, 'Trùng nội dung');
      await user.click(confirm);

      await waitFor(() => expect(reject).toHaveBeenCalledWith('pA', 'Trùng nội dung'));
      expect(toast.success).toHaveBeenCalledWith('Đã từ chối đoạn văn.');
    });

    it('shows what an edit changes and approves it, in Vietnamese', async () => {
      approve.mockResolvedValue({ ...edit, pendingEdit: undefined });
      const { user, queue } = await openQueue([waitingA, edit]);

      await user.click(within(queue).getByRole('button', { name: 'Xem Biển xanh mới' }));
      const view = await screen.findByRole('dialog', { name: 'Biển xanh mới' });
      expect(within(view).getByRole('group', { name: 'Thay đổi' })).toBeInTheDocument();
      expect(within(view).getByText(/Nguồn:/)).toHaveTextContent('Nguồn: Sách Tiếng Việt lớp 5 mới');
      await user.click(within(view).getByRole('button', { name: 'Duyệt' }));

      const dialog = await screen.findByRole('dialog', { name: 'Duyệt "Biển xanh mới"?' });
      expect(within(dialog).getByText('Bản sửa thay cho văn bản đang công khai, kèm tên tác giả.')).toBeInTheDocument();
      await user.click(within(dialog).getByRole('button', { name: 'Duyệt' }));

      await waitFor(() => expect(approve).toHaveBeenCalledWith('pB'));
      expect(toast.success).toHaveBeenCalledWith('Đã duyệt đoạn văn.');
    });

    it('decides on the chosen requests at once with Vietnamese buttons, and says how many changed', async () => {
      bulkApprove.mockResolvedValue({ updated: 1 });
      bulkReject.mockResolvedValue({ updated: 2 });
      const { user, queue } = await openQueue();

      await user.click(within(queue).getByText('Sông quê'));
      await user.click(within(queue).getByText('Biển xanh'));
      expect(within(queue).getAllByText('Đã chọn')).toHaveLength(2);
      await user.click(screen.getByRole('button', { name: 'Duyệt 2' }));
      const approveDialog = await screen.findByRole('dialog', { name: 'Duyệt 2 đoạn văn?' });
      expect(within(approveDialog).getByText('Mọi người học đều luyện được các đoạn văn này, kèm tên tác giả.')).toBeInTheDocument();
      await user.click(within(approveDialog).getByRole('button', { name: 'Duyệt' }));
      await waitFor(() => expect(bulkApprove).toHaveBeenCalledWith(['pA', 'pB']));
      expect(toast.success).toHaveBeenCalledWith('Đã duyệt 1 / 2 đoạn văn: các đoạn còn lại không còn chờ duyệt.');
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

      await user.click(within(queue).getByText('Sông quê'));
      await user.click(within(queue).getByText('Biển xanh'));
      await user.click(screen.getByRole('button', { name: 'Từ chối 2' }));
      const rejectDialog = await screen.findByRole('dialog', { name: 'Từ chối 2 đoạn văn?' });
      await user.type(within(rejectDialog).getByLabelText('Lý do'), 'Trùng nội dung');
      await user.click(within(rejectDialog).getByRole('button', { name: 'Từ chối' }));
      await waitFor(() => expect(bulkReject).toHaveBeenCalledWith(['pA', 'pB'], 'Trùng nội dung'));
      expect(toast.success).toHaveBeenCalledWith('Đã từ chối 2 đoạn văn.');
    });
  });
});
