/**
 * Converts an unknown thrown value into a readable error message.
 *
 * @param error - Unknown caught value.
 * @returns A useful string for logs and CLI output.
 */
export function formatError(error: unknown): string {
  if (error instanceof Error) {
    return `${error.name}: ${error.message}`;
  }

  if (typeof error === 'string') {
    return error;
  }

  try {
    return JSON.stringify(error);
  } catch (jsonError: unknown) {
    return `Unserialisable error: ${String(jsonError)}`;
  }
}

/**
 * Throws if a value is unexpectedly unreachable.
 *
 * @param value - Exhaustiveness marker.
 */
export function assertNever(value: never): never {
  throw new Error(`Unhandled value: ${String(value)}`);
}
