import { useTranslation } from 'react-i18next';
import { Panel } from '@/shared/components/panel';
import { TabGroup } from '@/shared/components/tab-group';
import { sectionTitleClass } from '@/shared/lib/panel-styles';
import { useWardrobeVersion, type WardrobeVersion } from '../hooks/use-wardrobe-version';

/** In Settings, the Wardrobe tab: which wardrobe `/wardrobe` shows. Saved in the browser (`useWardrobeVersion`). */
export const WardrobeVersionSetting = () => {
  const { t } = useTranslation('settings');
  const { version, setVersion } = useWardrobeVersion();
  const versions = [
    { value: 'classic', label: t('wardrobe.classic') },
    { value: 'modern', label: t('wardrobe.modern') },
  ];
  return (
    <Panel title={t('wardrobe.title')} titleTip={t('wardrobe.description')} bare titleClassName={sectionTitleClass} className="flex items-start justify-between gap-4 pt-3">
      <p className="min-w-0 text-lg text-muted-foreground">{t('wardrobe.description')}</p>
      <div className="shrink-0">
        <TabGroup label={t('wardrobe.group')} tabs={versions} value={version} onChange={(value) => setVersion(value as WardrobeVersion)} />
      </div>
    </Panel>
  );
};
