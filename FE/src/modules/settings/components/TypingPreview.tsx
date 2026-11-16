import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PassageView } from '@/modules/typing/components/PassageView';
import { checkWords, toWords } from '@/modules/typing/utils/typing-session';
import { Panel } from '@/shared/components/panel';
import { TabGroup } from '@/shared/components/tab-group';
import { sectionTitleClass } from '@/shared/lib/panel-styles';
import type { TypingLanguage } from '@/shared/lib/typing-language';

// Three words typed right, one finished wrong (red, wavy underline) and one being typed (the caret): what the typing page shows.
const SAMPLES: Record<TypingLanguage, { passage: string; typed: string[]; current: string }> = {
  vi: {
    passage: 'Mỗi lỗi gõ sai đều để lại một dấu vết nhỏ trên đường học gõ nhanh hơn.',
    typed: ['Mỗi', 'lỗi', 'gõ', 'sau'],
    current: 'đề',
  },
  en: {
    passage: 'Every typing mistake leaves a small trace on the way to typing faster.',
    typed: ['Every', 'typing', 'mistake', 'laeves'],
    current: 'a',
  },
};

const LANGUAGES = [
  { value: 'vi', label: 'VI' },
  { value: 'en', label: 'EN' },
];

/**
 * The sample passage of the Typing tab (a panel titled Preview), drawn by the typing page's own `PassageView` at the font size being chosen.
 * A VI / EN button switches the sample between Vietnamese and English (a view only: nothing is saved, the typing language is not changed).
 */
export const TypingPreview = ({ fontSizeRem }: { fontSizeRem: number }) => {
  const { t } = useTranslation('settings');
  const [language, setLanguage] = useState<TypingLanguage>('vi');
  const { passage, typed, current } = SAMPLES[language];
  const words = toWords(passage);

  return (
    <Panel
      title={t('typing.preview')}
      bare
      titleClassName={sectionTitleClass}
      className="pt-3"
      actions={<TabGroup label={t('typing.previewLanguage')} tabs={LANGUAGES} value={language} onChange={(value) => setLanguage(value as TypingLanguage)} />}
    >
      <span className="sr-only">{passage}</span>
      <div aria-hidden="true">
        <PassageView words={words} results={checkWords(words, typed)} current={current} fontSizeRem={fontSizeRem} />
      </div>
    </Panel>
  );
};
