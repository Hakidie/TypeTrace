/**
 * Records requests sent to the OpenAI Chat Completions URL (through the mocked
 * `fetch`) and decides what it answers, so chat tests never call OpenAI.
 */
export const openaiRecorder = {
  requests: [] as Record<string, unknown>[],
  /** Text of the next reply. */
  replyText: 'Hello from the test model' as string | null,
  /** When set, the next call answers with this HTTP status instead of a reply. */
  errorStatus: null as number | null,
  reset() {
    this.requests = [];
    this.replyText = 'Hello from the test model';
    this.errorStatus = null;
  }
};
