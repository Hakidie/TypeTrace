import { Link } from 'react-router-dom';
import { StickyNote, User, Upload } from 'lucide-react';
import { useCurrentUser } from '@/modules/auth/hooks/use-current-user';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';

const quickActions = [
  {
    title: 'Edit Profile',
    description: 'Update your display name, bio, and phone number.',
    icon: User,
    to: '/profile',
  },
  {
    title: 'Upload Avatar',
    description: 'Set a profile picture to personalize your account.',
    icon: Upload,
    to: '/profile',
  },
  {
    title: 'Notes',
    description: 'Example feature to copy when you build your own.',
    icon: StickyNote,
    to: '/notes',
  },
];

export const HomePage = () => {
  const { data: user } = useCurrentUser();

  const displayName = user?.displayName || user?.email?.split('@')[0] || 'User';

  return (
    <div className="space-y-8">
      {/* Hero section */}
      <section className=" border bg-card p-8">
        <p className="text-base font-medium text-primary">Dashboard</p>
        <h1 className="mt-1 text-3xl font-bold">
          Welcome back, <span className="text-primary">{displayName}</span>
        </h1>
        <p className="mt-2 text-muted-foreground">
          Manage your profile and account settings from here.
        </p>
      </section>

      {/* Quick actions */}
      <section>
        <h2 className="mb-4 text-lg font-semibold">Quick Actions</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {quickActions.map((action) => (
            <Link key={action.title} to={action.to} className="group block">
              <Card className="h-full transition-colors group-hover:border-primary/50 group-hover:bg-card/80">
                <CardHeader className="pb-3">
                  <div className="mb-2 inline-flex size-10 items-center justify-center bg-primary/10 text-primary">
                    <action.icon className="size-5" />
                  </div>
                  <CardTitle className="text-base">{action.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription>{action.description}</CardDescription>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
};
