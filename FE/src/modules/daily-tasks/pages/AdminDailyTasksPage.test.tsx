import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

/** The value of the stat named `label` of a task card, e.g. DONE. */
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

// Right-clicks a task card to open its menu and picks one of its entries.
const pickAction = async (title: string, action: 'Edit' | 'Activate' | 'Deactivate' | 'Delete') => {
  const cards = await screen.findByLabelText('Daily task cards');
  fireEvent.contextMenu(within(cards).getByRole('group', { name: `Actions for ${title}` }));
  fireEvent.click(within(cards).getByRole('menuitem', { name: action }));
};

/** Opens a menu of the form's strip (Type or Focus) and picks an option; the menu opens inside the form. */
const pickOption = (form: ReturnType<typeof formOf>, menu: 'Type' | 'Focus', option: string) => {
  fireEvent.click(form.getByRole('button', { name: new RegExp(`^${menu}:`) }));
  fireEvent.click(form.getByRole('menuitemradio', { name: option }));
};

/** The form of the top panel: New task, or Edit task while a task is being edited. */
const formOf = (name: 'New task' | 'Edit task' = 'New task') => within(screen.getByRole('form', { name }));

/** Opens the Tasks per day menu of the toolbar once it shows `label`, and answers the menu. */
const openTasksPerDay = async (label: string) => {
  await screen.findByText(label);
  fireEvent.click(screen.getByRole('button', { name: 'Tasks per day' }));
  return within(screen.getByRole('menu', { name: 'Tasks per day options' }));
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
    expect(screen.getByLabelText('Search tasks').closest('div.flex')).toHaveTextContent('4Tasks');
    expect(list).toHaveBeenCalledWith(expect.objectContaining({ page: 1, limit: 4, sort: '-createdAt' }));
  });

  it('shows the tasks per day in the toolbar, and in its menu what they mean with the active tasks', async () => {
    renderPage();

    const menu = await openTasksPerDay('2 a day');
    expect(await menu.findByText('Each learner gets 2 of the 3 active tasks every day.')).toBeInTheDocument();
    expect(menu.getByRole('menuitemradio', { name: '2 a day' })).toHaveAttribute('aria-checked', 'true');
  });

  it('saves a new number of tasks per day as soon as it is picked', async () => {
    updateSettings.mockResolvedValue({ dailyTaskCount: 5 });
    renderPage();

    fireEvent.click((await openTasksPerDay('2 a day')).getByRole('menuitemradio', { name: '5 a day' }));

    await waitFor(() => expect(updateSettings).toHaveBeenCalledWith({ dailyTaskCount: 5 }));
    const menu = await openTasksPerDay('5 a day');
    expect(menu.getByRole('menuitemradio', { name: '5 a day' })).toHaveAttribute('aria-checked', 'true');
    expect(await menu.findByText('Only 3 active tasks: learners get 3 a day until more are active.')).toBeInTheDocument();
  });

  it('offers 1 to 10 tasks a day and nothing else, and saves nothing when the saved count is picked again', async () => {
    renderPage();

    const menu = await openTasksPerDay('2 a day');
    expect(menu.getAllByRole('menuitemradio').map((option) => option.textContent)).toEqual(
      Array.from({ length: 10 }, (_, index) => `${index + 1} a day`),
    );
    fireEvent.click(menu.getByRole('menuitemradio', { name: '2 a day' }));

    expect(updateSettings).not.toHaveBeenCalled();
  });

  it('says when the learners get all the active tasks, or none', async () => {
    getSettings.mockResolvedValue({ dailyTaskCount: 3 });
    const { unmount } = renderPage();
    expect(await (await openTasksPerDay('3 a day')).findByText('Each learner gets all 3 active tasks every day.')).toBeInTheDocument();
    unmount();

    listWith([slowDay]);
    renderPage();
    expect(
      await (await openTasksPerDay('3 a day')).findByText('No task is active yet: learners get none until one is.'),
    ).toBeInTheDocument();
  });

  it('adds a task with the form of the top panel, the target checked against its type, then empties the form', async () => {
    create.mockResolvedValue(task('t5', 'Precise'));
    renderPage();
    await screen.findByLabelText('Daily task cards');

    const form = formOf('New task');
    fireEvent.change(form.getByLabelText('Title'), { target: { value: 'Precise' } });
    fireEvent.change(form.getByLabelText('Target'), { target: { value: '99' } });
    fireEvent.click(form.getByRole('button', { name: 'Add task' }));

    expect(await form.findByText('At most 20 for this type')).toBeInTheDocument();
    expect(create).not.toHaveBeenCalled();

    pickOption(form, 'Type', 'Accuracy');
    fireEvent.change(form.getByLabelText('Target'), { target: { value: '98' } });
    expect(await form.findByText('Reach 98% accuracy in one session')).toBeInTheDocument();
    fireEvent.click(form.getByRole('button', { name: 'Add task' }));

    await waitFor(() =>
      expect(create).toHaveBeenCalledWith({ title: 'Precise', description: '', type: 'accuracy', target: 98, errorType: null, isActive: true }),
    );
    await waitFor(() => expect(form.getByLabelText('Title')).toHaveValue(''));
    expect(form.getByRole('button', { name: 'Type: Sessions' })).toBeInTheDocument();
  });

  it('makes a task inactive with the Active menu', async () => {
    create.mockResolvedValue(task('t7', 'Quiet'));
    renderPage();
    await screen.findByLabelText('Daily task cards');

    const form = formOf('New task');
    expect(form.getByRole('button', { name: 'Active: Active' })).toBeInTheDocument();
    fireEvent.change(form.getByLabelText('Title'), { target: { value: 'Quiet' } });
    fireEvent.click(form.getByRole('button', { name: 'Active: Active' }));
    fireEvent.click(form.getByRole('menuitemradio', { name: 'Inactive' }));
    expect(form.getByRole('button', { name: 'Active: Inactive' })).toBeInTheDocument();
    fireEvent.click(form.getByRole('button', { name: 'Add task' }));

    await waitFor(() =>
      expect(create).toHaveBeenCalledWith({ title: 'Quiet', description: '', type: 'sessions', target: 1, errorType: null, isActive: false }),
    );
  });

  it('takes at most 2 digits in the target field', async () => {
    renderPage();
    await screen.findByLabelText('Daily task cards');

    const form = formOf('New task');
    fireEvent.change(form.getByLabelText('Target'), { target: { value: '123' } });
    expect(form.getByLabelText('Target')).toHaveValue(12);
  });

  it('refuses a new task without a title or a target', async () => {
    renderPage();
    await screen.findByLabelText('Daily task cards');

    const form = formOf('New task');
    fireEvent.change(form.getByLabelText('Target'), { target: { value: '' } });
    fireEvent.click(form.getByRole('button', { name: 'Add task' }));

    expect(await form.findByText('Title is required')).toBeInTheDocument();
    expect(form.getByText('Enter a number')).toBeInTheDocument();
    expect(create).not.toHaveBeenCalled();
  });

  it('edits a task in the top panel from the menu of its card, then goes back to a new task', async () => {
    update.mockResolvedValue({ ...speed, target: 45 });
    renderPage();

    await pickAction('Speed run', 'Edit');
    const form = formOf('Edit task');
    expect(form.getByLabelText('Title')).toHaveValue('Speed run');
    expect(form.getByRole('button', { name: 'Type: Speed' })).toBeInTheDocument();
    expect(form.getByLabelText('Description')).toHaveValue('Type fast but clean.');
    fireEvent.change(form.getByLabelText('Target'), { target: { value: '45' } });
    fireEvent.click(form.getByRole('button', { name: 'Update task' }));

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
    expect(await screen.findByRole('form', { name: 'New task' })).toBeInTheDocument();
    expect(formOf('New task').getByLabelText('Title')).toHaveValue('');
  });

  it('cancels an edit without saving, and leaves the edit when the task is deleted', async () => {
    remove.mockResolvedValue(undefined);
    renderPage();

    await pickAction('Speed run', 'Edit');
    fireEvent.click(formOf('Edit task').getByRole('button', { name: 'Cancel' }));
    expect(await screen.findByRole('form', { name: 'New task' })).toBeInTheDocument();
    expect(update).not.toHaveBeenCalled();

    await pickAction('Focus', 'Edit');
    expect(formOf('Edit task').getByLabelText('Title')).toHaveValue('Focus');
    await pickAction('Focus', 'Delete');
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(remove).toHaveBeenCalledWith('t3'));
    expect(await screen.findByRole('form', { name: 'New task' })).toBeInTheDocument();
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
  });

  it('cuts the title and the line under it to one line each, the whole text in the project tooltip on hover', async () => {
    listWith([hoiNga]);
    renderPage();

    await screen.findByLabelText('Daily task cards');
    const goal = within(cardOf('Phân biệt hỏi/ngã')).getByText(hoiNgaGoal);
    expect(goal).toHaveClass('truncate');
    // The shared Tooltip, never the native title attribute.
    expect(goal).not.toHaveAttribute('title');

    await userEvent.setup().hover(goal);
    expect(await screen.findByRole('tooltip')).toHaveTextContent(hoiNgaGoal);
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
    expect(statOf(cardOf('Busy'), 'DONE')).toBe('3');
    // Nobody yet: a note instead of the chart, and 0.
    expect(within(cardOf('Warm-up')).getByText('Nobody completed it in the last 24 hours')).toBeInTheDocument();
    expect(within(cardOf('Warm-up')).queryByRole('img')).not.toBeInTheDocument();
    expect(statOf(cardOf('Warm-up'), 'DONE')).toBe('0');
    expect(statOf(cardOf('Warm-up'), 'SESSIONS')).toBe('3');
    // DONE comes first, then the target.
    const done = within(cardOf('Warm-up')).getByText('DONE');
    expect(done.compareDocumentPosition(within(cardOf('Warm-up')).getByText('SESSIONS')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('offers a Focus error only while the type is Accuracy: None and the five error types', async () => {
    renderPage();
    await screen.findByLabelText('Daily task cards');

    const form = formOf('New task');
    expect(form.getByRole('button', { name: 'Type: Sessions' })).toBeInTheDocument();
    expect(form.queryByRole('button', { name: /^Focus:/ })).not.toBeInTheDocument();

    pickOption(form, 'Type', 'Accuracy');
    fireEvent.click(await form.findByRole('button', { name: 'Focus: None' }));
    expect(within(form.getByRole('menu', { name: 'Focus' })).getAllByRole('menuitemradio').map((option) => option.textContent)).toEqual([
      'None',
      'Wrong letter',
      'Missing stroke on đ',
      'Wrong vowel mark (â ê ô ă ơ ư)',
      'Wrong tone',
      'Hỏi / ngã confusion',
    ]);

    for (const other of ['Speed', 'Minutes']) {
      pickOption(form, 'Type', other);
      await waitFor(() => expect(form.queryByRole('button', { name: /^Focus:/ })).not.toBeInTheDocument());
      pickOption(form, 'Type', 'Accuracy');
      await form.findByRole('button', { name: /^Focus:/ });
    }
  });

  it('creates an accuracy task with the focus error picked, named in the goal', async () => {
    create.mockResolvedValue(hoiNga);
    renderPage();
    await screen.findByLabelText('Daily task cards');

    const form = formOf('New task');
    fireEvent.change(form.getByLabelText('Title'), { target: { value: 'Phân biệt hỏi/ngã' } });
    pickOption(form, 'Type', 'Accuracy');
    fireEvent.change(form.getByLabelText('Target'), { target: { value: '90' } });
    await form.findByRole('button', { name: /^Focus:/ });
    pickOption(form, 'Focus', 'Hỏi / ngã confusion');

    expect(await form.findByText(hoiNgaGoal)).toBeInTheDocument();
    fireEvent.click(form.getByRole('button', { name: 'Add task' }));

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
    await waitFor(() => expect(form.getByLabelText('Title')).toHaveValue(''));
  });

  it('sends no focus error once the type is switched away from Accuracy, though the pick waits for a switch back', async () => {
    create.mockResolvedValue(task('t6', 'Steady'));
    renderPage();
    await screen.findByLabelText('Daily task cards');

    const form = formOf('New task');
    fireEvent.change(form.getByLabelText('Title'), { target: { value: 'Steady' } });
    pickOption(form, 'Type', 'Accuracy');
    await form.findByRole('button', { name: /^Focus:/ });
    pickOption(form, 'Focus', 'Wrong tone');

    pickOption(form, 'Type', 'Minutes');
    await waitFor(() => expect(form.queryByRole('button', { name: /^Focus:/ })).not.toBeInTheDocument());
    pickOption(form, 'Type', 'Accuracy');
    expect(await form.findByRole('button', { name: 'Focus: Wrong tone' })).toBeInTheDocument();

    pickOption(form, 'Type', 'Minutes');
    fireEvent.change(form.getByLabelText('Target'), { target: { value: '10' } });
    expect(await form.findByText('Type 10 minutes in all')).toBeInTheDocument();
    fireEvent.click(form.getByRole('button', { name: 'Add task' }));

    await waitFor(() =>
      expect(create).toHaveBeenCalledWith({ title: 'Steady', description: '', type: 'minutes', target: 10, errorType: null, isActive: true }),
    );
  });

  it('adds a minigames task: the goal in words, a target of at most 10 (SCRUM-300)', async () => {
    create.mockResolvedValue(task('t7', 'Play games'));
    renderPage();
    await screen.findByLabelText('Daily task cards');

    const form = formOf('New task');
    fireEvent.change(form.getByLabelText('Title'), { target: { value: 'Play games' } });
    pickOption(form, 'Type', 'Minigames');
    fireEvent.change(form.getByLabelText('Target'), { target: { value: '11' } });
    fireEvent.click(form.getByRole('button', { name: 'Add task' }));
    expect(await form.findByText('At most 10 for this type')).toBeInTheDocument();
    expect(create).not.toHaveBeenCalled();

    fireEvent.change(form.getByLabelText('Target'), { target: { value: '3' } });
    expect(await form.findByText('Finish 3 minigames')).toBeInTheDocument();
    fireEvent.click(form.getByRole('button', { name: 'Add task' }));

    await waitFor(() =>
      expect(create).toHaveBeenCalledWith({ title: 'Play games', description: '', type: 'minigames', target: 3, errorType: null, isActive: true }),
    );
  });

  it('prefills the focus error of the task being edited, and None takes it away', async () => {
    listWith([hoiNga, warmUp]);
    update.mockResolvedValue({ ...hoiNga, errorType: undefined });
    renderPage();

    await pickAction('Phân biệt hỏi/ngã', 'Edit');
    const form = formOf('Edit task');
    expect(form.getByRole('button', { name: 'Type: Accuracy' })).toBeInTheDocument();
    expect(form.getByRole('button', { name: 'Focus: Hỏi / ngã confusion' })).toBeInTheDocument();
    expect(form.getByText(hoiNgaGoal)).toBeInTheDocument();

    pickOption(form, 'Focus', 'None');
    expect(await form.findByText('Reach 90% accuracy in one session')).toBeInTheDocument();
    fireEvent.click(form.getByRole('button', { name: 'Update task' }));

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
    expect(await screen.findByRole('form', { name: 'New task' })).toBeInTheDocument();
  });

  it('deactivates an active task and activates an inactive one from the menu of its row', async () => {
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
      expect.objectContaining({ q: 'fast', type: 'wpm', isActive: 'false', sort: 'title', page: 1, limit: 4 }),
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

  it('shows an error with Try again when the tasks or the tasks per day cannot be loaded', async () => {
    list.mockRejectedValue(new Error('Network Error'));
    getSettings.mockRejectedValue(new Error('Network Error'));
    renderPage();

    // The list, in the Tasks panel.
    expect(await screen.findByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();

    // The tasks per day, in their menu.
    const menu = await openTasksPerDay('— a day');
    expect(await menu.findByText('The tasks per day could not load.')).toBeInTheDocument();
    getSettings.mockResolvedValue({ dailyTaskCount: 4 });
    fireEvent.click(menu.getByRole('menuitem', { name: 'Try again' }));

    expect(await screen.findByText('4 a day')).toBeInTheDocument();
  });
});
