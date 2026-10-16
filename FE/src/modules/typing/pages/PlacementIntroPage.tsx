import { Keyboard, Target, Timer } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { redGlassCard, redGlassTheme } from '@/shared/lib/red-glass-theme';
import { SESSION_TIME_LIMIT_SECONDS } from '../typing.config';

/** What the learner should know before the test starts. */
const facts = [
  {
    icon: Keyboard,
    text: 'Type one Vietnamese passage with your usual input method. Press Space after each word, Enter after the last one.',
  },
  {
    icon: Timer,
    text: `The timer starts at your first key, and the test ends after ${SESSION_TIME_LIMIT_SECONDS / 60} minutes at most.`,
  },
  {
    icon: Target,
    text: 'You get your speed, your accuracy and the mistakes you make most: tones, vowel marks, đ, hỏi / ngã.',
  },
];

// The first page after logging in or registering (`afterLoginPathFor` in the auth module). Start types the placement
// passage (`/typing?mode=placement`), Skip opens normal practice. Same red glass card as the login page.
export const PlacementIntroPage = () => (
  <div className={`flex flex-1 items-center justify-center p-4 ${redGlassTheme}`}>
    {/* The card is the direct child: semi-transparent with a blurred backdrop. */}
    <div className={`w-full max-w-xl ${redGlassCard}`}>
      <Card>
        <CardHeader>
          <CardTitle>Placement test</CardTitle>
          <CardDescription>
            One short passage shows where you start, so your practice can focus on the mistakes you make most.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <ul className="space-y-3">
            {facts.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-start gap-3">
                <Icon className="mt-0.5 size-5 shrink-0 text-primary" />
                <span>{text}</span>
              </li>
            ))}
          </ul>
          <div className="grid gap-3 sm:grid-cols-2">
            <Button asChild className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              <Link to="/typing?mode=placement">Start</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/typing">Skip</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  </div>
);
