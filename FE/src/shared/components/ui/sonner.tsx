import { Toaster as SonnerToaster } from 'sonner';

function Toaster() {
  return (
    <SonnerToaster
      position="bottom-right"
      toastOptions={{
        unstyled: true,
        classNames: {
          // Same look as the dropdown menus and tooltips: see-through page background with blur, panel border with the soft red hover.
          toast:
            'flex w-full items-center gap-3 border border-border bg-background/75 px-4 py-3 text-sm text-muted-foreground shadow-md backdrop-blur-xs transition-colors hover:border-destructive/40',
          title: 'font-medium',
          description: 'text-muted-foreground',
          error: 'text-destructive',
        },
      }}
    />
  );
}

export { Toaster };
