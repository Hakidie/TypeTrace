import { PlacementMinAccuracySetting } from '@/modules/ranked/components/PlacementMinAccuracySetting';
import { Panel } from '@/shared/components/panel';
import { Label } from '@/shared/components/ui/label';
import { Switch } from '@/shared/components/ui/switch';
import { useSidebarMode } from '@/shared/hooks/use-sidebar-mode';
import { ThemeTabs } from '../components/ThemeTabs';

// The panels of this page have no frame and no tint: the title is only red text, and the content sits directly on the page.
const titleClass = 'text-[1.5rem] text-primary';

export const AdminSettingsPage = () => {
  const { mode, setMode } = useSidebarMode();

  return (
    <div className="space-y-8">
      {/* PANEL Appearance */}
      <Panel title="Appearance" bare titleClassName={titleClass} className="space-y-4">
        {/* Mode: light or dark. Saved on the account and applied at once. */}
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xl font-medium">Theme</p>
            <p className="text-lg text-muted-foreground">Switch between light and dark.</p>
          </div>
          <ThemeTabs />
        </div>

        {/* Compact sidebar: the admin sidebar shows only the icons. Saved in the browser (see `useSidebarMode`). */}
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <Label htmlFor="sidebar-compact" className="text-xl font-medium">
              Compact sidebar
            </Label>
            <p className="text-lg text-muted-foreground">Show only the icons in the sidebar.</p>
          </div>
          <Switch id="sidebar-compact" checked={mode === 'compact'} onCheckedChange={(on) => setMode(on ? 'compact' : 'default')} />
        </div>
      </Panel>

      {/* PANEL Placement leaderboard: the accuracy a placement session needs to be on it (an app setting, US10.1). */}
      <Panel title="Placement leaderboard" bare titleClassName={titleClass}>
        <PlacementMinAccuracySetting />
      </Panel>
    </div>
  );
};
