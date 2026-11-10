export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}
export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  const value = error as {
    statusCode?: number;
    data?: { code?: string; detail?: string };
  };
  return new ApiError(
    value?.statusCode ?? 0,
    value?.data?.code ?? 'NETWORK_ERROR',
    value?.data?.detail ?? 'Unable to complete the request. Please try again.',
  );
}
