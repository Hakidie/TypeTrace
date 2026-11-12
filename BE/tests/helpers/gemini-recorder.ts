/** The text Gemini was asked: the `user` message of a `generateContent` body. */
export const promptOf = (request: Record<string, unknown>) =>
  ((request.contents as { parts: { text: string }[] }[]).at(-1)?.parts[0]?.text ?? '') as string;

/**
 * Records requests sent to the Gemini generateContent URL (through the mocked
 * `fetch`) and decides what it answers, so chat tests never call Gemini.
 */
export const geminiRecorder = {
  requests: [] as Record<string, unknown>[],
  /** Text of the next reply. */
  replyText: 'Hello from the test model' as string | null,
  /** When set, the reply is written from the request instead (the Weak spots passage uses the words it was given). */
  replyWith: null as ((request: Record<string, unknown>) => string) | null,
  /** When set, the next call answers with this HTTP status instead of a reply. */
  errorStatus: null as number | null,
  /** When set, the answer comes this many milliseconds later (a request that times out is aborted before). */
  delayMs: 0,
  reset() {
    this.requests = [];
    this.replyText = 'Hello from the test model';
    this.replyWith = null;
    this.errorStatus = null;
    this.delayMs = 0;
  }
};
