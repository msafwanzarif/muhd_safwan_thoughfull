export function problemMessage(cause: unknown): string {
  const error = cause as { code?: string; status?: number; message?: string };
  const messages: Record<string, string> = {
    SLOT_TAKEN:
      'Someone else just booked this time. Please choose another time.',
    MEMBER_OVERLAP: 'This time overlaps another session of yours.',
    WITHIN_24_HOURS:
      'This session is less than 24 hours away and can no longer be changed.',
    REQUEST_IN_PROGRESS:
      'Your request is still processing. Retry shortly; the same request will be used.',
    IDEMPOTENCY_KEY_REUSED:
      'The request changed. Please choose the time again.',
  };
  if (error?.code && messages[error.code]) return messages[error.code]!;
  if (error?.status === 429)
    return 'Too many attempts. Please wait a minute and try again.';
  if (error?.status === 401)
    return 'Your session has ended. Please log in again.';
  return error?.message ?? 'Unable to complete the request. Please try again.';
}
