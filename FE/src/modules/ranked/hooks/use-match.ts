import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { getApiErrorMessage } from '@/shared/api/api-error';
import { openMatchStream, rankedApi } from '../api/ranked.api';
import type { MatchEvent, MatchKind, ProgressInput, PublicMatch, RematchInvite } from '../types/ranked.types';
import { applyRainEvent, type RainDuelState } from '../lib/rain-duel';
import { createServerClock, type ServerClock } from '../lib/server-clock';
import { rankedKeys } from './use-ranked';

/** One server clock per room, fed by the `serverNow` of its rain events, so the stage draws words where the server has them. */
const clocks = new Map<string, ServerClock>();
export const rainClock = (code: string) => {
  if (!clocks.has(code)) clocks.set(code, createServerClock());
  return clocks.get(code)!;
};

/** Cache keys. */
export const matchKeys = {
  all: ['matches'] as const,
  detail: (code: string) => [...matchKeys.all, code] as const,
  /** The rain of a rain duel (`rain` events), apart from the room. */
  rain: (code: string) => [...matchKeys.all, code, 'rain'] as const,
};

/** Applies one stream event to the cached match. */
const applyEvent = (match: PublicMatch | undefined, event: MatchEvent): PublicMatch | undefined => {
  if (event.event === 'state' || event.event === 'result') return event.data;
  if (!match) return match;
  if (event.event === 'countdown') return { ...match, status: 'countdown', countdownEndsAt: event.data.countdownEndsAt };
  if (event.event === 'progress') {
    const { userId, ...update } = event.data;
    return { ...match, players: match.players.map((player) => (player.userId === userId ? { ...player, ...update } : player)) };
  }
  return match;
};

/**
 * The room with this code, kept live by its event stream (open while the component is mounted). `invite` is the rematch
 * the other player asked for; `gone` turns true when the server no longer knows the room for this user.
 */
export const useMatch = (code?: string) => {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: matchKeys.detail(code ?? ''), queryFn: () => rankedApi.get(code!), enabled: Boolean(code) });
  const [stream, setStream] = useState<{ code?: string; invite?: RematchInvite; gone: boolean }>({ gone: false });
  // A new room starts with no invitation and not gone.
  if (stream.code !== code) setStream({ code, gone: false });

  useEffect(() => {
    if (!code) return;
    return openMatchStream(
      code,
      (event) => {
        if (event.event === 'rematch') setStream((current) => ({ ...current, invite: event.data }));
        else if (event.event === 'rain') {
          rainClock(code).observe(event.data.serverNow, Date.now());
          queryClient.setQueryData<RainDuelState>(matchKeys.rain(code), (state) => applyRainEvent(state, event.data));
        }
        else queryClient.setQueryData<PublicMatch>(matchKeys.detail(code), (match) => applyEvent(match, event));
        // The match is settled: the own rating moved.
        if (event.event === 'result') void queryClient.invalidateQueries({ queryKey: rankedKeys.me() });
      },
      { onGone: () => setStream((current) => ({ ...current, gone: true })) },
    );
  }, [code, queryClient]);

  return {
    match: query.data,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    invite: stream.invite,
    gone: stream.gone,
  };
};

// Mutations: no `onError`, the shared query client toasts the backend message.
const useMatchMutation = <TInput,>(mutationFn: (input: TInput) => Promise<PublicMatch>) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: (match) => queryClient.setQueryData(matchKeys.detail(match.code), match),
  });
};

export const useCreateMatch = () => useMatchMutation((kind: MatchKind) => rankedApi.create(kind));
export const useJoinMatch = () => useMatchMutation((code: string) => rankedApi.join(code));
export const useLeaveMatch = () => useMatchMutation((code: string) => rankedApi.leave(code));
export const useReady = () => useMatchMutation(({ code, ready }: { code: string; ready: boolean }) => rankedApi.ready(code, ready));
export const useRematch = () => useMatchMutation((code: string) => rankedApi.rematch(code));

/**
 * No cache write: the stream brings the new counts to both players. A word the server turns down (400/409: the race is
 * over, or the typing area restarted after a reload) is dropped silently; it would toast on every word otherwise.
 */
export const useSendProgress = () =>
  useMutation({
    mutationFn: ({ code, input }: { code: string; input: ProgressInput }) => rankedApi.progress(code, input),
    onError: (error) => {
      const status = (error as { response?: { status?: number } }).response?.status;
      if (status !== 400 && status !== 409) toast.error(getApiErrorMessage(error, 'Something went wrong'));
    },
  });

/**
 * The rain of a duel, filled by the room's stream (`useMatch` must be mounted for the same code) and its server clock.
 * No request of its own: the server sends a snapshot as soon as the stream opens during the duel.
 */
export const useRainDuel = (code: string) => {
  const { data } = useQuery<RainDuelState>({ queryKey: matchKeys.rain(code), queryFn: () => Promise.reject(new Error('Filled by the stream')), enabled: false });
  return { state: data, clock: rainClock(code) };
};

/** A typed word of a rain duel. A word the server turns down (the duel just ended) is dropped silently. */
export const useSendRainWord = () =>
  useMutation({
    mutationFn: ({ code, text }: { code: string; text: string }) => rankedApi.sendRainWord(code, text),
    onError: (error) => {
      const status = (error as { response?: { status?: number } }).response?.status;
      if (status !== 400 && status !== 409) toast.error(getApiErrorMessage(error, 'Something went wrong'));
    },
  });
