/**
 * Normalizes an email address for identity comparison.
 * For Gmail/Googlemail, it removes dots and ignores everything after a plus sign in the local part.
 * For other providers, it currently just lowercases the entire address.
 */
export function normalizeEmail(email: string): string {
  const lowercaseEmail = email.toLowerCase().trim();
  const [localPart, domain] = lowercaseEmail.split('@');

  if (!localPart || !domain) {
    return lowercaseEmail;
  }

  // Gmail and Googlemail treat dots as non-existent and ignore everything after +
  if (domain === 'gmail.com' || domain === 'googlemail.com') {
    const canonicalLocalPart = localPart.split('+')[0].replace(/\./g, '');
    return `${canonicalLocalPart}@${domain}`;
  }

  // Handle other providers if needed, or just return lowered version
  return lowercaseEmail;
}
