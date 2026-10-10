import * as React from 'react';
import { cn } from '@/shared/lib/utils';

function Label({ className, ...props }: React.ComponentProps<'label'>) {
  return <label className={cn('text-base font-medium leading-none', className)} {...props} />;
}

export { Label };
