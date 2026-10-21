import { Panel } from '@/shared/components/panel';
import { Label } from '@/shared/components/ui/label';
import { Switch } from '@/shared/components/ui/switch';
import { useSidebarMode } from '@/shared/hooks/use-sidebar-mode';
import { panelBodyClass, panelTitleClass } from '@/shared/lib/panel-styles';
import { cn } from '@/shared/lib/utils';
import { ThemeTabs } from '../components/ThemeTabs';

export const AdminSettingsPage = () => {
  const { mode, setMode } = useSidebarMode();

  return (
    <div className="space-y-6">
      <Panel title="Appearance" bare titleClassName={panelTitleClass} className={cn(panelBodyClass, 'space-y-4')}>
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
    </div>
  );
};
