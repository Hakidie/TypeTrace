import { ListOrdered } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/components/ui/tooltip';

/** The button to the leaderboard in a `SeasonPanel`: shows while the panel is hovered or holds the focus (always on touch screens, which cannot hover). */
export const LeaderboardLink = () => (
  <TooltipProvider delayDuration={200}>
    <Tooltip>
      <TooltipTrigger asChild>
        <Link
          to="/leaderboard"
          aria-label="Leaderboard"
          className="flex size-[2.3rem] shrink-0 items-center justify-center text-primary opacity-0 transition hover:bg-primary hover:text-primary-foreground focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring group-hover:opacity-100 group-focus-within:opacity-100 pointer-coarse:opacity-100"
        >
          <ListOrdered className="size-6" aria-hidden="true" />
        </Link>
      </TooltipTrigger>
      <TooltipContent>Leaderboard</TooltipContent>
    </Tooltip>
  </TooltipProvider>
);
