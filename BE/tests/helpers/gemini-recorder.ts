/**
 * Records requests sent to the Gemini generateContent URL (through the mocked
 * `fetch`) and decides what it answers, so chat tests never call Gemini.
 */
export const geminiRecorder = {
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
