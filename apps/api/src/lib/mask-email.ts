export function maskEmail(email: string): string {
  const separator = email.lastIndexOf('@');
  if (separator <= 0 || separator === email.length - 1) return '*****';
  return `*****@${email.slice(separator + 1)}`;
}
