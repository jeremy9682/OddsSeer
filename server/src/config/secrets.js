/**
 * Minimal secrets module for the standalone OddsSeer server.
 *
 * Same interface as the original backend/src/config/secrets.js getter used by the
 * search, embedding and comment-analysis services, but it only reads the
 * OpenRouter key from the server process environment. It never loads wallet,
 * Privy, builder, encryption or AWS Secrets Manager credentials.
 */

export async function getOpenRouterApiKey() {
  const value = process.env.OPENROUTER_API_KEY;
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function isOpenRouterConfigured() {
  const value = process.env.OPENROUTER_API_KEY;
  return typeof value === 'string' && value.trim().length > 0;
}

export default { getOpenRouterApiKey, isOpenRouterConfigured };
