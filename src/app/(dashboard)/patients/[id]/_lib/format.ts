// Formatter helpers used across the patient detail page and its sub-components.
// Kept side-effect free so they are safe to import in client components.

export function calcAge(birthDate: string): number {
  const today = new Date();
  const birth = new Date(birthDate);
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

export function fmt(dateStr: string): string {
  return new Date(dateStr).toLocaleString('uz-UZ', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function fmtDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('uz-UZ');
}

export function fmtMoney(amount: number): string {
  return amount.toLocaleString('uz-UZ') + ' so\'m';
}
