export function authRedirectUrl(path: "/onboarding" | "/reset-password", origin: string): string {
  return new URL(path, origin).toString();
}
