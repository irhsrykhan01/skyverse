export class SkyVerseError extends Error {
  constructor(message, options = {}) {
    super(message, options);
    this.name = 'SkyVerseError';
    this.code = options.code ?? 'SKYVERSE_ERROR';
    this.expose = options.expose ?? false;
  }
}

export function getErrorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}
