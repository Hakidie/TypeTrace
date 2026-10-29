import { useState, type FormEvent } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { useCreateMatch, useJoinMatch } from '../hooks/use-match';

/** No room yet: create one (the code is then shared with a friend) or join one with its code. */
export const RankLobby = ({ onEnter }: { onEnter: (code: string) => void }) => {
  const createMatch = useCreateMatch();
  const joinMatch = useJoinMatch();
  const [code, setCode] = useState('');
  const pending = createMatch.isPending || joinMatch.isPending;

  const join = (event: FormEvent) => {
    event.preventDefault();
    const typed = code.trim().toUpperCase();
    if (typed) joinMatch.mutate(typed, { onSuccess: (match) => onEnter(match.code) });
  };

  return (
    <div className="mx-auto my-auto grid w-full max-w-3xl gap-6 md:grid-cols-2">
      <section className="flex flex-col gap-3 bg-primary/10 p-6 text-primary">
        <h2 className="text-xl font-semibold">Duel a friend</h2>
        <p className="text-muted-foreground">Open a room and share its code. You both type the same English passage.</p>
        <Button className="mt-auto" disabled={pending} onClick={() => createMatch.mutate(undefined, { onSuccess: (match) => onEnter(match.code) })}>
          Create room
        </Button>
      </section>
      <form onSubmit={join} className="flex flex-col gap-3 bg-primary/10 p-6 text-primary">
        <h2 className="text-xl font-semibold">Join a room</h2>
        <label htmlFor="room-code" className="text-muted-foreground">
          Room code
        </label>
        <Input
          id="room-code"
          value={code}
          onChange={(event) => setCode(event.target.value)}
          maxLength={6}
          autoComplete="off"
          placeholder="ABC234"
          className="text-center text-2xl uppercase tracking-[0.3em]"
        />
        <Button type="submit" disabled={pending || code.trim().length !== 6}>
          Join
        </Button>
      </form>
    </div>
  );
};
