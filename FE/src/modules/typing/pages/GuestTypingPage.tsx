import { CloudRain, Gamepad2, Languages, ListChecks, RotateCcw, Shuffle, Trophy } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { GuestResult } from '@/modules/home/components/GuestResult';
import { guestPassagesOf, pickGuestPassage } from '@/modules/home/lib/guest-passages';
import { summarizeGuestRun, type GuestRun } from '@/modules/home/lib/guest-result';
import { RainMode } from '@/modules/rain/components/RainMode';
import { GUEST_RAIN_WORDS } from '@/modules/rain/lib/guest-words';
import { TabGroup } from '@/shared/components/tab-group';
import { Button } from '@/shared/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@/shared/components/ui/dropdown-menu';
import { type TypingLanguage } from '@/shared/lib/typing-language';
import { redGlassTheme } from '@/shared/lib/red-glass-theme';
import { cn } from '@/shared/lib/utils';
import { PassageMenuPanel } from '../components/PassageMenuPanel';
import { TypingArea } from '../components/TypingArea';
import type { PassageOption } from '../types/typing.types';
import { languageNames, modeIcons, modeLabels, timeChoices, unitLabels, type TimeUnit } from '../typing.config';

// The same tabs as the Typing page of a signed-in learner. A guest uses Practice and Minigames (Rain only); the others need an
// account and lead to the Login page (which links to Register).
const modeTabsOf = (t: TFunction) => {
  const needsAccount = t('typing:needsAccount');
  return [
    { value: 'practice', label: modeLabels.practice, icon: modeIcons.practice, hint: t('typing:page.guestPracticeHint') },
    { value: 'placement', label: modeLabels.placement, icon: modeIcons.placement, hint: needsAccount, locked: true },
    { value: 'rank', label: t('typing:page.rank'), icon: Trophy, hint: needsAccount, locked: true },
    { value: 'minigames', label: t('typing:page.minigames'), icon: Gamepad2, hint: t('typing:page.guestMinigamesHint') },
  ];
};

// The passage tabs of the signed-in page: Manual picks one of the fixed passages, Random a new one; Train (Weak spots) needs an account, so it is locked.
const passageTabsOf = (t: TFunction) => [
  { value: 'manual', label: t('typing:page.manual'), icon: ListChecks, hint: t('typing:page.manualHint') },
  { value: 'random', label: t('typing:page.random'), icon: Shuffle, hint: t('typing:page.randomHint') },
  { value: 'train', label: modeLabels.targeted, icon: modeIcons.targeted, hint: t('typing:needsAccount'), locked: true },
];

/** The fixed passages of a language as the items of the passage menu of a signed-in learner: a title, the System tag and the number of words. */
const menuPassagesOf = (language: TypingLanguage): PassageOption[] =>
  guestPassagesOf(language).map((passage, index) => ({
    _id: String(index),
    title: passage.title,
    wordCount: passage.text.split(/\s+/).filter(Boolean).length,
    isSystem: true,
    isOwn: false,
    ownerName: 'TypeTrace',
  }));

const IME_HINT_ID = 'ime-hint';

const nameClass = 'min-w-0 px-4 py-2 text-[1.125rem] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring enabled:hover:bg-muted';

const hoverButtonClass = 'group gap-0 h-auto px-4 py-2 text-[1.125rem] text-muted-foreground';
const hoverWordClass =
  'max-w-0 overflow-hidden opacity-0 transition-all duration-200 group-hover:ml-2 group-hover:max-w-40 group-hover:opacity-100 group-focus-visible:ml-2 group-focus-visible:max-w-40 group-focus-visible:opacity-100';

/**
 * The Typing page for a guest (SCRUM-251), the same look as the signed-in page: Practice types a random passage (Random) or one picked from the fixed
 * list of the frontend (Manual; Train is locked), Minigames plays word rain with a fixed word list, both with a time of the guest's
 * choice. Nothing is sent to the server: no session, streak, rating or saved result. The result asks the guest to register.
 */
export const GuestTypingPage = () => {
  const { t } = useTranslation('typing');
  const modeTabs = modeTabsOf(t);
  const passageTabs = passageTabsOf(t);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const rain = searchParams.get('mode') === 'minigames';
  // VI / EN in Practice, as on the signed-in page; a guest's choice is only kept while the page is open (nothing is saved).
  const [language, setLanguage] = useState<TypingLanguage>('vi');
  const [passage, setPassage] = useState(() => pickGuestPassage());
  const menuPassages = useMemo(() => menuPassagesOf(language), [language]);
  const [run, setRun] = useState<GuestRun>();
  // Manual: the name of the passage above the text opens the menu of the fixed passages.
  const [manual, setManual] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  // The second choice, 20 seconds, as in Practice of a signed-in learner.
  const [timeUnit, setTimeUnit] = useState<TimeUnit>('sec');
  const [timeIndex, setTimeIndex] = useState(1);
  const [shownUnit, setShownUnit] = useState<TimeUnit>();
  const tabsUnit = shownUnit ?? timeUnit;
  const timeSeconds = timeChoices[timeUnit][timeIndex] * (timeUnit === 'min' ? 60 : 1);
  const timeTabs = timeChoices[tabsUnit].map((n) => ({ value: String(n), label: String(n).padStart(2, '0') }));

  const newPassage = () => {
    setPassage(pickGuestPassage(manual ? undefined : passage.index, undefined, language));
    setRun(undefined);
  };
  const choose = (id: string) => {
    setPassage(pickGuestPassage(undefined, Number(id), language));
    setRun(undefined);
    setMenuOpen(false);
  };
  // A new random passage of the other language, as on the signed-in page: Random again, the menu closed.
  const switchLanguage = (next: TypingLanguage) => {
    setLanguage(next);
    setManual(false);
    setMenuOpen(false);
    setPassage(pickGuestPassage(undefined, undefined, next));
    setRun(undefined);
  };
  // An input method for Vietnamese turns English words into Vietnamese ones: a notification while the guest types English, taken back after.
  const imeHint = !rain && language === 'en';
  useEffect(() => {
    if (!imeHint) return;
    toast.info(t('page.imeHint'), { id: IME_HINT_ID, duration: 8000 });
    return () => {
      toast.dismiss(IME_HINT_ID);
    };
  }, [imeHint, t]);
  const other: TypingLanguage = language === 'vi' ? 'en' : 'vi';
  const languageSwitch = (
    <Button variant="ghost" className={hoverButtonClass} aria-label={t('page.languageSwitch', { current: languageNames[language], other: languageNames[other] })} onClick={() => switchLanguage(other)}>
      <Languages className="size-5" /> <span className={hoverWordClass}>{languageNames[language]}</span>
    </Button>
  );
  const pickPassageTab = (value: string) => {
    if (value === 'train') return navigate('/login');
    setManual(value === 'manual');
    setMenuOpen(value === 'manual');
    if (value === 'random') newPassage();
  };

  const finish = (typedWords: string[], typedAtMs: number[]) => {
    // A run that typed every word ends when the last word was finished, one that ran out of time lasted the whole time.
    const finishedAll = typedWords.length >= passage.words.length;
    setRun(summarizeGuestRun(passage.words, typedWords, finishedAll ? (typedAtMs.at(-1) ?? 0) : timeSeconds * 1000, language));
  };

  return (
    <div className={cn('flex flex-1 flex-col gap-4 p-4 pb-0 pt-0 md:p-8 md:pb-0 md:pt-0', redGlassTheme)}>
      <div className="relative flex flex-col items-center gap-2 xl:grid xl:grid-cols-[1fr_auto_1fr] xl:gap-x-2">
        <div className="flex min-w-0 max-w-full xl:justify-self-end">
          {!rain && <TabGroup label={t('page.passageGroup')} compact tabs={passageTabs} value={manual ? 'manual' : 'random'} onChange={pickPassageTab} />}
        </div>
        <TabGroup
          label={t('page.modeGroup')}
          iconsOnPhones
          // The Placement tab is hidden while the guest types English, as on the signed-in page.
          tabs={language === 'en' ? modeTabs.filter((tab) => tab.value !== 'placement') : modeTabs}
          value={rain ? 'minigames' : 'practice'}
          onChange={(value) => {
            if (value === 'practice') setSearchParams({});
            else if (value === 'minigames') setSearchParams({ mode: 'minigames', game: 'rain' });
            else navigate('/login');
          }}
        />
        <div className="xl:justify-self-start">
          <div className="flex outline outline-1 -outline-offset-1 outline-border">
            <TabGroup
              label={t('page.timeGroup')}
              framed={false}
              tabs={timeTabs}
              value={tabsUnit === timeUnit ? timeTabs[timeIndex].value : ''}
              onChange={(value) => {
                setTimeUnit(tabsUnit);
                setTimeIndex(timeTabs.findIndex((tab) => tab.value === value));
                setShownUnit(undefined);
              }}
            />
            <button
              type="button"
              aria-label={t('page.switchUnit')}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => setShownUnit(tabsUnit === 'sec' ? 'min' : 'sec')}
              className="inline-flex items-center px-3 py-1.5 text-[1.125rem] text-primary transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {unitLabels[tabsUnit]}
            </button>
          </div>
        </div>
      </div>

      {rain ? (
        // Keyed by the time: a new time is a new round.
        <div className="flex flex-1 flex-col justify-center">
          <RainMode key={timeSeconds} guest={{ words: [...GUEST_RAIN_WORDS], roundMs: timeSeconds * 1000 }} />
          <p className="flex items-center justify-center gap-2 text-center text-muted-foreground">
            <CloudRain className="size-4" aria-hidden /> Playing as a guest: nothing is saved.
          </p>
        </div>
      ) : run ? (
        <GuestResult run={run} onTryAgain={newPassage} />
      ) : (
        <TypingArea
          key={`${language}-${passage.index}`}
          targetWords={passage.words}
          language={language}
          statusCenter={languageSwitch}
          timeLimitSeconds={timeSeconds}
          onFinish={finish}
          onTimeUp={() => setRun(summarizeGuestRun(passage.words, [], timeSeconds * 1000, language))}
          header={
            manual ? (
              <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen} className="flex min-w-0 max-w-full">
                <span className="flex min-w-0">
                  <DropdownMenuTrigger aria-label={t('page.choosePassage')} className={cn(nameClass, 'text-primary')}>
                    <span className="block truncate whitespace-nowrap">{passage.title}</span>
                  </DropdownMenuTrigger>
                </span>
                {/* The menu of the signed-in page: the normal background, centered under the name. */}
                <DropdownMenuContent role="menu" aria-label={t('page.passagesMenu')} className="left-1/2 w-[calc(100vw-2rem)] -translate-x-1/2 sm:w-max sm:min-w-[24rem] sm:max-w-[min(32rem,calc(100vw-2rem))] [--color-background:var(--background)]">
                  <PassageMenuPanel mode="practice" language={language} passages={menuPassages} selectedId={String(passage.index)} onSelect={choose} />
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              // Random: the name only shows, as on the signed-in page.
              <span className={cn(nameClass, 'truncate text-muted-foreground')}>{passage.title}</span>
            )
          }
          actions={
            <Button variant="ghost" className={hoverButtonClass} onClick={newPassage}>
              <RotateCcw className="size-5" /> <span className={hoverWordClass}>{t('page.restart')}</span>
            </Button>
          }
        />
      )}
    </div>
  );
};
