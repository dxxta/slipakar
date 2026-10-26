export type StartContainerOptions = {
  attempts?: number;
  isRetryable?: (error: unknown) => boolean;
};

function isPortBindingTimeout(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return error.message.includes('Timed out after') && error.message.includes('container ports to be bound');
}

export async function startContainer<T>(
  start: () => Promise<T>,
  options: StartContainerOptions = {},
): Promise<T> {
  const attempts = options.attempts ?? 3;
  if (!Number.isInteger(attempts) || attempts < 1) throw new RangeError('attempts must be a positive integer');

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await start();
    } catch (error) {
      const retryable = options.isRetryable ? options.isRetryable(error) : isPortBindingTimeout(error);
      if (!retryable || attempt === attempts) throw error;
      await new Promise<void>((resolve) => setTimeout(resolve, 500));
    }
  }

  throw new Error('Container startup attempts exhausted');
}
