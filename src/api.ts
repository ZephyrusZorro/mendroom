export async function request<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      method,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(12_000),
    });
  } catch {
    throw new Error('Cannot reach Mendroom. Check that the local server is running, then retry.');
  }
  const result = await response
    .json()
    .catch(() => ({ error: 'The server returned an unexpected response. Please retry.' }));
  if (!response.ok)
    throw new Error(result.error || 'Could not complete this change. Please retry.');
  return result as T;
}
