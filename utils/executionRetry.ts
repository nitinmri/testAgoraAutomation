const MAX_EXECUTION_RETRIES = 2;

function isAssertionFailure(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'matcherResult' in error
  );
}

export async function retryOnExecutionError<T>(
  operation: () => Promise<T>,
  recover: () => Promise<void>,
): Promise<T> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      if (isAssertionFailure(error) || attempt >= MAX_EXECUTION_RETRIES) {
        throw error;
      }

      console.warn(
        `Test execution failed; retrying (${attempt + 1}/${MAX_EXECUTION_RETRIES}).`,
        error,
      );
      try {
        await recover();
      } catch (recoveryError) {
        console.warn('Retry recovery failed; continuing with the next attempt.', recoveryError);
      }
    }
  }
}