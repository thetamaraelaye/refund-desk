import axios, { AxiosError, type AxiosRequestConfig } from 'axios';

interface Envelope<T> {
  success: boolean;
  status: number;
  message: string;
  data: T;
  details?: unknown;
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly details?: unknown,
  ) {
    super(message);
  }
}

// Same origin: Next rewrites /api/v1/* to the API, so the session cookies stay first-party.
const client = axios.create({ baseURL: '/api/v1', timeout: 30_000, withCredentials: true });

// Unwraps the envelope, and turns every failure into an ApiError with the server's message.
export async function request<T>(config: AxiosRequestConfig): Promise<T> {
  try {
    const response = await client.request<Envelope<T> | ''>(config);
    if (response.status === 204 || response.data === '') return undefined as T;
    return response.data.data;
  } catch (error) {
    if (error instanceof AxiosError) {
      const body = error.response?.data as Partial<Envelope<unknown>> | undefined;
      if (error.response) {
        throw new ApiError(
          body?.message ?? `Request failed (${error.response.status})`,
          error.response.status,
          body?.details,
        );
      }
      throw new ApiError(
        error.code === AxiosError.ECONNABORTED
          ? 'The server took too long to answer. Try again.'
          : "Can't reach the server. Check your connection and try again.",
        0,
      );
    }
    throw error;
  }
}
