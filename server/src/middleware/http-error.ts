export function httpError(status: number, code: string, message: string) {
  return Object.assign(new Error(message), { status, code, expose: true });
}
