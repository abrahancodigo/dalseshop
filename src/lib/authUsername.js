export const USERNAME_AUTH_DOMAIN = "auth.dalseshop.internal";

export function normalizeUsername(value) {
  return String(value || "").trim().toLowerCase();
}

export function isValidUsername(value) {
  return /^[a-z0-9](?:[a-z0-9._-]{2,29})$/.test(normalizeUsername(value));
}

export function usernameToAuthEmail(username) {
  return `${normalizeUsername(username)}@${USERNAME_AUTH_DOMAIN}`;
}
