import { PanelTitleSwitch } from '@/shared/components/panel-title-switch';
import { useWardrobeVersion, type WardrobeVersion } from '../hooks/use-wardrobe-version';

/**
 * The switch to the other wardrobe beside the title of both pages: the icon of the Progress page's titles, with a tooltip.
 * It saves the choice (the same setting as in Settings), so `/wardrobe` opens that version next time. Not on a phone, where the modern wardrobe is the classic page.
 */
export const WardrobeSwitch = ({ to, other }: { to: WardrobeVersion; other: string }) => {
  const { setVersion } = useWardrobeVersion();
  return (
    <span className="max-md:hidden">
      <PanelTitleSwitch other={other} onClick={() => setVersion(to)} />
    </span>
  );
};
