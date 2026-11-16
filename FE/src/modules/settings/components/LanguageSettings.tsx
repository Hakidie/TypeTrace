import { useTranslation } from 'react-i18next';
import { Panel } from '@/shared/components/panel';
import { TabGroup } from '@/shared/components/tab-group';
import { sectionTitleClass } from '@/shared/lib/panel-styles';
import { type UiLanguage } from '@/shared/i18n/ui-language';
import { useChangeUiLanguage, useUiLanguage } from '../hooks/use-ui-language';

/** The name of each language in its own language, so a learner who cannot read the page can still find theirs. */
const UI_LANGUAGE_OPTIONS = [
  { value: 'vi', label: 'Tiếng Việt' },
  { value: 'en', label: 'English' },
];

/** In Settings, the Language tab: the language of the interface (SCRUM-327). */
export const LanguageSettings = () => {
  const { t } = useTranslation('settings');
  const language = useUiLanguage();
  const change = useChangeUiLanguage();
  return (
    <Panel title={t('language.title')} titleTip={t('language.description')} bare titleClassName={sectionTitleClass} className="flex items-start justify-between gap-4 pt-3">
      <p className="min-w-0 text-lg text-muted-foreground">{t('language.description')}</p>
      <div className="shrink-0">
        <TabGroup label={t('language.group')} tabs={UI_LANGUAGE_OPTIONS} value={language} onChange={(value) => change(value as UiLanguage)} />
      </div>
    </Panel>
  );
};
