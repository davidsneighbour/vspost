const ENV_PATTERN = /^\$\{([A-Z0-9_]+)\}$/u;

/**
 * Replaces config values of the form ${NAME} with process.env.NAME.
 *
 * @param value - The unknown config value to resolve.
 * @returns The resolved value.
 */
export function resolveEnvPlaceholders(value: unknown): unknown {
  if (typeof value === 'string') {
    const match = ENV_PATTERN.exec(value);

    if (match?.[1] !== undefined) {
      const envValue = process.env[match[1]];

      if (envValue === undefined || envValue.length === 0) {
        throw new Error(`Missing required environment variable: ${match[1]}`);
      }

      return envValue;
    }

    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => resolveEnvPlaceholders(item));
  }

  if (value !== null && typeof value === 'object') {
    const resolved: Record<string, unknown> = {};

    for (const [key, item] of Object.entries(value)) {
      resolved[key] = resolveEnvPlaceholders(item);
    }

    return resolved;
  }

  return value;
}
