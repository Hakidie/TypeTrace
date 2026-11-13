import { Panel } from '@/shared/components/panel';
import { TabGroup } from '@/shared/components/tab-group';
import { sectionTitleClass } from '@/shared/lib/panel-styles';
import { useWardrobeVersion, type WardrobeVersion } from '../hooks/use-wardrobe-version';

const description = 'Choose the wardrobe that opens from the account menu. Modern puts the avatar in the middle with its items in a drawer; phones always get the classic one.';

const VERSIONS = [
  { value: 'classic', label: 'Classic' },
  { value: 'modern', label: 'Modern' },
];

/** In Settings, the Wardrobe tab: which wardrobe `/wardrobe` shows. Saved in the browser (`useWardrobeVersion`). */
export const WardrobeVersionSetting = () => {
  const { version, setVersion } = useWardrobeVersion();
  return (
    <Panel title="Wardrobe" titleTip={description} bare titleClassName={sectionTitleClass} className="flex items-start justify-between gap-4 pt-3">
      <p className="min-w-0 text-lg text-muted-foreground">{description}</p>
      <div className="shrink-0">
        <TabGroup label="Wardrobe version" tabs={VERSIONS} value={version} onChange={(value) => setVersion(value as WardrobeVersion)} />
      </div>
    </Panel>
  );
};
