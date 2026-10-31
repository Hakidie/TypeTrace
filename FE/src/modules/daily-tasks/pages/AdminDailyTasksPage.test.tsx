import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render-with-providers';
import type { DailyTaskListItem, DailyTaskListParams } from '../types/daily-task.types';
import { AdminDailyTasksPage } from './AdminDailyTasksPage';

const list = vi.fn();
const create = vi.fn();
const update = vi.fn();
const remove = vi.fn();
const getSettings = vi.fn();
const updateSettings = vi.fn();

vi.mock('../api/daily-tasks.api', () => ({
  dailyTasksApi: {
    list: (params: unknown) => list(params),
    create: (input: unknown) => create(input),
    update: (id: string, input: unknown) => update(id, input),
    remove: (id: string) => remove(id),
    getSettings: () => getSettings(),
    updateSettings: (settings: unknown) => updateSettings(settings),
  },
}));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

/** A task of the list; nobody completed it in the last 24 hours unless `extra` says otherwise. */
const task = (id: string, title: string, extra: Partial<DailyTaskListItem> = {}): DailyTaskListItem => ({
  _id: id,
  title,
  description: '',
  type: 'sessions',
  target: 3,
  isActive: true,
  createdAt: '2026-10-20T00:00:00.000Z',
  updatedAt: '2026-10-20T00:00:00.000Z',
  completions: { learners: 0, hours: [] },
  ...extra,
});

/**
 * The 24 hours of `completions` up to the current one, 10 March 2026 15:00 in the zone of the test run, each with the
 * learners `busy` gives its start (made from local times, so the hours read the same in any zone).
 */
const lastDay = (busy: [Date, number][]) =>
  Array.from({ length: 24 }, (_, index) => {
    const hour = new Date(2026, 2, 9, 16 + index).toISOString();
    return { hour, learners: busy.find(([start]) => start.toISOString() === hour)?.[1] ?? 0 };
  });

/** The value of the stat named `label` of a task card, e.g. DONE 24H. */
const statOf = (card: HTMLElement, label: string) => within(card).getByText(label).nextElementSibling?.textContent;

/** The card of the task titled `title`. */
const cardOf = (title: string) => screen.getByText(title).closest('article') as HTMLElement;

const warmUp = task('t1', 'Warm-up');
const speed = task('t2', 'Speed run', { type: 'wpm', target: 40, description: 'Type fast but clean.' });
const focus = task('t3', 'Focus', { type: 'accuracy', target: 95 });
const slowDay = task('t4', 'Slow day', { type: 'minutes', target: 10, isActive: false });
const hoiNga = task('t5', 'Phân biệt hỏi/ngã', { type: 'accuracy', target: 90, errorType: 'HOI_NGA_CONFUSION' });
/** The goal of `hoiNga`: only some words have hỏi or ngã, so it says how many a session needs. */
const hoiNgaGoal = 'Reach 90% accuracy on hỏi and ngã in a session with at least 5 words with hỏi or ngã';

const page = (items: DailyTaskListItem[]) => ({ items, page: 1, limit: 10, total: items.length, totalPages: 1 });

/** The list of the page and the count of the active tasks (`isActive: 'true'`) both come from `list`. */
const listWith = (items: DailyTaskListItem[]) =>
  list.mockImplementation(async (params: DailyTaskListParams) => page(params.isActive === 'true' ? items.filter((item) => item.isActive) : items));

const renderPage = (route = '/admin/daily-tasks') => renderWithProviders(<AdminDailyTasksPage />, { route, path: '/admin/daily-tasks' });

beforeEach(() => {
  listWith([warmUp, speed, focus, slowDay]);
  create.mockReset();
  update.mockReset();
  remove.mockReset();
  getSettings.mockReset().mockResolvedValue({ dailyTaskCount: 2 });
  updateSettings.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

// Opens the kebab menu of a task card and picks one of its entries.
const pickAction = async (title: string, action: 'Edit' | 'Activate' | 'Deactivate' | 'Delete') => {
  const cards = await screen.findByLabelText('Daily task cards');
  fireEvent.click(within(cards).getByRole('button', { name: `Actions for ${title}` }));
  fireEvent.click(within(cards).getByRole('menuitem', { name: action }));
};

describe('AdminDailyTasksPage', () => {
  it('lists every task with its description (its goal when it has none), target, type and status', async () => {
    renderPage();

    const cards = await screen.findByLabelText('Daily task cards');
    expect(within(cards).getByText('Warm-up')).toBeInTheDocument();
    for (const goal of ['Finish 3 counted sessions', 'Reach 95% accuracy in one session', 'Type 10 minutes in all']) {
      expect(within(cards).getByText(goal)).toBeInTheDocument();
    }
    // Speed run has a description: it takes the place of the goal.
    expect(within(cards).getByText('Type fast but clean.')).toBeInTheDocument();
    expect(within(cards).queryByText('Reach 40 WPM in one session')).not.toBeInTheDocument();
    expect(within(cards).getByText('95%')).toBeInTheDocument();
    expect(within(cards).getByText('Speed')).toBeInTheDocument();
    expect(within(cards).getAllByText('Active')).toHaveLength(3);
    expect(within(cards).getAllByText('Inactive')).toHaveLength(1);
    expect(screen.getByText('4 tasks in total')).toBeInTheDocument();
    expect(list).toHaveBeenCalledWith(expect.objectContaining({ page: 1, limit: 10, sort: '-createdAt' }));
  });

  it('shows the tasks per day and what they mean with the active tasks', async () => {
    renderPage();

    expect(await screen.findByLabelText('Tasks per day')).toHaveValue(2);
    expect(await screen.findByText('Each learner gets 2 of the 3 active tasks every day.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('saves a new number of tasks per day', async () => {
    updateSettings.mockResolvedValue({ dailyTaskCount: 5 });
    renderPage();
    const field = await screen.findByLabelText('Tasks per day');

    fireEvent.change(field, { target: { value: '5' } });
    expect(await screen.findByText('Only 3 active tasks: learners get 3 a day until more are active.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(updateSettings).toHaveBeenCalledWith({ dailyTaskCount: 5 }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled());
    expect(screen.getByLabelText('Tasks per day')).toHaveValue(5);
  });

  it('refuses a number of tasks per day outside 1 to 10, and keeps the hint of the saved one', async () => {
    renderPage();
    const field = await screen.findByLabelText('Tasks per day');

    fireEvent.change(field, { target: { value: '11' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('At most 10')).toBeInTheDocument();
    fireEvent.change(field, { target: { value: '0' } });
    expect(await screen.findByText('At least 1')).toBeInTheDocument();

    expect(screen.getByText('Each learner gets 2 of the 3 active tasks every day.')).toBeInTheDocument();
    expect(updateSettings).not.toHaveBeenCalled();
  });

  it('says when the learners get all the active tasks, or none', async () => {
    getSettings.mockResolvedValue({ dailyTaskCount: 3 });
    const { unmount } = renderPage();
    expect(await screen.findByText('Each learner gets all 3 active tasks every day.')).toBeInTheDocument();
    unmount();

    listWith([slowDay]);
    renderPage();
    expect(await screen.findByText('No task is active yet: learners get none until one is.')).toBeInTheDocument();
  });

  it('creates a task, with the target checked against its type', async () => {
    create.mockResolvedValue(task('t5', 'Precise'));
    renderPage();
    await screen.findByLabelText('Daily task cards');

    fireEvent.click(screen.getByRole('button', { name: 'New task' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Title'), { target: { value: 'Precise' } });
    fireEvent.change(within(dialog).getByLabelText('Type'), { target: { value: 'accuracy' } });
    fireEvent.change(within(dialog).getByLabelText('Target'), { target: { value: '101' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Create' }));

    expect(await within(dialog).findByText('At most 100 for this type')).toBeInTheDocument();
    expect(create).not.toHaveBeenCalled();

    fireEvent.change(within(dialog).getByLabelText('Target'), { target: { value: '98' } });
    expect(await within(dialog).findByText('Reach 98% accuracy in one session')).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Create' }));

    await waitFor(() =>
      expect(create).toHaveBeenCalledWith({ title: 'Precise', description: '', type: 'accuracy', target: 98, errorType: null, isActive: true }),
    );
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('refuses a new task without a title or a target', async () => {
    renderPage();
    await screen.findByLabelText('Daily task cards');

    fireEvent.click(screen.getByRole('button', { name: 'New task' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Target'), { target: { value: '' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Create' }));

    expect(await within(dialog).findByText('Title is required')).toBeInTheDocument();
    expect(within(dialog).getByText('Enter a number')).toBeInTheDocument();
    expect(create).not.toHaveBeenCalled();
  });

  it('edits a task from the kebab menu of its card', async () => {
    update.mockResolvedValue({ ...speed, target: 45 });
    renderPage();

    await pickAction('Speed run', 'Edit');
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByLabelText('Title')).toHaveValue('Speed run');
    expect(within(dialog).getByLabelText('Type')).toHaveValue('wpm');
    fireEvent.change(within(dialog).getByLabelText('Target'), { target: { value: '45' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(update).toHaveBeenCalledWith('t2', {
        title: 'Speed run',
        description: 'Type fast but clean.',
        type: 'wpm',
        target: 45,
        errorType: null,
        isActive: true,
      }),
    );
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('names the focus error of an accuracy task in a badge, and in the goal under the title when it has no description', async () => {
    const tones = task('t6', 'Steady tones', { type: 'accuracy', target: 85, errorType: 'TONE_WRONG', description: 'Mind every tone.' });
    listWith([hoiNga, tones, focus]);
    renderPage();

    await screen.findByLabelText('Daily task cards');
    expect(within(cardOf('Phân biệt hỏi/ngã')).getByText(hoiNgaGoal)).toBeInTheDocument();
    expect(within(cardOf('Phân biệt hỏi/ngã')).getByText('Focus: hỏi and ngã')).toBeInTheDocument();
    // With a description, the badge alone names the focus.
    expect(within(cardOf('Steady tones')).getByText('Mind every tone.')).toBeInTheDocument();
    expect(within(cardOf('Steady tones')).getByText('Focus: tone marks')).toBeInTheDocument();
    expect(within(cardOf('Focus')).queryByText(/^Focus:/)).not.toBeInTheDocument();
    // One line under the title, cut when long: the whole text is its tooltip.
    expect(within(cardOf('Phân biệt hỏi/ngã')).getByTitle(hoiNgaGoal)).toHaveClass('truncate');
  });

  it('puts the description under the title, in the same column', async () => {
    renderPage();

    await screen.findByLabelText('Daily task cards');
    const title = screen.getByText('Speed run');
    expect(title.parentElement).toContainElement(screen.getByText('Type fast but clean.'));
    expect(title.nextElementSibling).toHaveTextContent('Type fast but clean.');
  });

  it('charts the learners who completed each task in each of the last 24 hours, with the learners of the 24 hours', async () => {
    // Only `Date` is faked (the clock of the "Today" / "Yesterday" of the hours): React Query keeps its real timers.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 2, 10, 15, 30));
    const busy = task('t7', 'Busy', {
      completions: { learners: 3, hours: lastDay([[new Date(2026, 2, 9, 23), 1], [new Date(2026, 2, 10, 14), 2]]) },
    });
    listWith([busy, warmUp]);
    renderPage();

    await screen.findByLabelText('Daily task cards');
    // The hours with learners, in the admin's own time, for screen readers; the columns are drawn from the same 24 hours.
    expect(
      within(cardOf('Busy')).getByRole('img', {
        name: 'Completed by 3 learners in the last 24 hours. Yesterday 23:00–00:00: 1. Today 14:00–15:00: 2.',
      }),
    ).toBeInTheDocument();
    expect(statOf(cardOf('Busy'), 'DONE 24H')).toBe('3');
    // Nobody yet: a note instead of the chart, and 0.
    expect(within(cardOf('Warm-up')).getByText('Nobody completed it in the last 24 hours')).toBeInTheDocument();
    expect(within(cardOf('Warm-up')).queryByRole('img')).not.toBeInTheDocument();
    expect(statOf(cardOf('Warm-up'), 'DONE 24H')).toBe('0');
    expect(statOf(cardOf('Warm-up'), 'SESSIONS')).toBe('3');
  });

  it('offers a Focus error only while the type is Accuracy: None and the five error types', async () => {
    renderPage();
    await screen.findByLabelText('Daily task cards');

    fireEvent.click(screen.getByRole('button', { name: 'New task' }));
    const dialog = await screen.findByRole('dialog');
    const type = within(dialog).getByLabelText('Type');
    expect(type).toHaveValue('sessions');
    expect(within(dialog).queryByLabelText('Focus error')).not.toBeInTheDocument();

    fireEvent.change(type, { target: { value: 'accuracy' } });
    const focusError = await within(dialog).findByLabelText('Focus error');
    expect(focusError).toHaveValue('');
    expect(within(focusError).getAllByRole('option').map((option) => option.textContent)).toEqual([
      'None',
      'Wrong letter',
      'Missing stroke on đ',
      'Wrong vowel mark (â ê ô ă ơ ư)',
      'Wrong tone',
      'Hỏi / ngã confusion',
    ]);

    for (const other of ['wpm', 'minutes']) {
      fireEvent.change(type, { target: { value: other } });
      await waitFor(() => expect(within(dialog).queryByLabelText('Focus error')).not.toBeInTheDocument());
      fireEvent.change(type, { target: { value: 'accuracy' } });
      await within(dialog).findByLabelText('Focus error');
    }
  });

  it('creates an accuracy task with the focus error picked, named in the goal', async () => {
    create.mockResolvedValue(hoiNga);
    renderPage();
    await screen.findByLabelText('Daily task cards');

    fireEvent.click(screen.getByRole('button', { name: 'New task' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Title'), { target: { value: 'Phân biệt hỏi/ngã' } });
    fireEvent.change(within(dialog).getByLabelText('Type'), { target: { value: 'accuracy' } });
    fireEvent.change(within(dialog).getByLabelText('Target'), { target: { value: '90' } });
    fireEvent.change(await within(dialog).findByLabelText('Focus error'), { target: { value: 'HOI_NGA_CONFUSION' } });

    expect(await within(dialog).findByText(hoiNgaGoal)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Create' }));

    await waitFor(() =>
      expect(create).toHaveBeenCalledWith({
        title: 'Phân biệt hỏi/ngã',
        description: '',
        type: 'accuracy',
        target: 90,
        errorType: 'HOI_NGA_CONFUSION',
        isActive: true,
      }),
    );
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('sends no focus error once the type is switched away from Accuracy, though the pick waits for a switch back', async () => {
    create.mockResolvedValue(task('t6', 'Steady'));
    renderPage();
    await screen.findByLabelText('Daily task cards');

    fireEvent.click(screen.getByRole('button', { name: 'New task' }));
    const dialog = await screen.findByRole('dialog');
    const type = within(dialog).getByLabelText('Type');
    fireEvent.change(within(dialog).getByLabelText('Title'), { target: { value: 'Steady' } });
    fireEvent.change(type, { target: { value: 'accuracy' } });
    fireEvent.change(await within(dialog).findByLabelText('Focus error'), { target: { value: 'TONE_WRONG' } });

    fireEvent.change(type, { target: { value: 'minutes' } });
    await waitFor(() => expect(within(dialog).queryByLabelText('Focus error')).not.toBeInTheDocument());
    fireEvent.change(type, { target: { value: 'accuracy' } });
    expect(await within(dialog).findByLabelText('Focus error')).toHaveValue('TONE_WRONG');

    fireEvent.change(type, { target: { value: 'minutes' } });
    fireEvent.change(within(dialog).getByLabelText('Target'), { target: { value: '10' } });
    expect(await within(dialog).findByText('Type 10 minutes in all')).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Create' }));

    await waitFor(() =>
      expect(create).toHaveBeenCalledWith({ title: 'Steady', description: '', type: 'minutes', target: 10, errorType: null, isActive: true }),
    );
  });

  it('prefills the focus error of the task being edited, and None takes it away', async () => {
    listWith([hoiNga, warmUp]);
    update.mockResolvedValue({ ...hoiNga, errorType: undefined });
    renderPage();

    await pickAction('Phân biệt hỏi/ngã', 'Edit');
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByLabelText('Type')).toHaveValue('accuracy');
    expect(within(dialog).getByLabelText('Focus error')).toHaveValue('HOI_NGA_CONFUSION');
    expect(within(dialog).getByText(hoiNgaGoal)).toBeInTheDocument();

    fireEvent.change(within(dialog).getByLabelText('Focus error'), { target: { value: '' } });
    expect(await within(dialog).findByText('Reach 90% accuracy in one session')).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(update).toHaveBeenCalledWith('t5', {
        title: 'Phân biệt hỏi/ngã',
        description: '',
        type: 'accuracy',
        target: 90,
        errorType: null,
        isActive: true,
      }),
    );
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('deactivates an active task and activates an inactive one from the kebab menu', async () => {
    update.mockResolvedValue(warmUp);
    renderPage();

    await pickAction('Warm-up', 'Deactivate');
    await waitFor(() => expect(update).toHaveBeenCalledWith('t1', { isActive: false }));

    await pickAction('Slow day', 'Activate');
    await waitFor(() => expect(update).toHaveBeenCalledWith('t4', { isActive: true }));
  });

  it('deletes a task after confirmation', async () => {
    remove.mockResolvedValue(undefined);
    renderPage();

    await pickAction('Focus', 'Delete');
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Delete this task?')).toBeInTheDocument();
    expect(remove).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(remove).toHaveBeenCalledWith('t3'));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('sends the search, filters and sort of the URL to the API', async () => {
    renderPage('/admin/daily-tasks?q=fast&type=wpm&isActive=false&sort=title');
    await screen.findByLabelText('Daily task cards');

    expect(list).toHaveBeenCalledWith(
      expect.objectContaining({ q: 'fast', type: 'wpm', isActive: 'false', sort: 'title', page: 1, limit: 10 }),
    );
  });

  it('filters by type from the toolbar', async () => {
    renderPage();
    await screen.findByLabelText('Daily task cards');

    fireEvent.click(screen.getByRole('button', { name: /Filter/ }));
    fireEvent.click(within(screen.getByRole('group', { name: 'Type' })).getByRole('menuitemradio', { name: 'Speed' }));

    await waitFor(() => expect(list).toHaveBeenLastCalledWith(expect.objectContaining({ type: 'wpm' })));
  });

  it('shows an empty state without tasks, and another one when the filters match none', async () => {
    listWith([]);
    const { unmount } = renderPage();
    expect(await screen.findByText('No daily tasks yet')).toBeInTheDocument();
    unmount();

    renderPage('/admin/daily-tasks?type=wpm');
    expect(await screen.findByText('No matching tasks')).toBeInTheDocument();
  });

  it('shows an error with Try again when the tasks or the settings cannot be loaded', async () => {
    list.mockRejectedValue(new Error('Network Error'));
    getSettings.mockRejectedValue(new Error('Network Error'));
    renderPage();

    // One in the Settings panel, one in the Tasks panel.
    await waitFor(() => expect(screen.getAllByText('Something went wrong')).toHaveLength(2));
    getSettings.mockResolvedValue({ dailyTaskCount: 4 });
    fireEvent.click(screen.getAllByRole('button', { name: 'Try again' })[0]);

    expect(await screen.findByLabelText('Tasks per day')).toHaveValue(4);
  });
});
