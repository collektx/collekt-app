/**
 * NUBAN Name Matcher for Nigerian Bank Accounts
 * Verifies that the recipient name on the bank account matches the registered user or company.
 */
function normalizeName(str) {
  if (!str) return [];
  return String(str)
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, '')
    .split(/\s+/)
    .filter(Boolean);
}

function verifyNubanNameMatch(profileName, accountName, options = {}) {
  if (!profileName || !accountName) {
    return { isMatch: false, reason: 'MISSING_NAMES' };
  }

  const pTokens = normalizeName(profileName);
  const aTokens = normalizeName(accountName);

  if (pTokens.length === 0 || aTokens.length === 0) {
    return { isMatch: false, reason: 'EMPTY_TOKENS' };
  }

  // Check token intersection
  const matchedTokens = pTokens.filter(t => aTokens.includes(t));
  if (matchedTokens.length >= Math.min(2, pTokens.length)) {
    return { isMatch: true, matchType: 'TOKEN_OVERLAP' };
  }

  // If company, also check director name if supplied
  if (options.isCompany && options.directorName) {
    const dTokens = normalizeName(options.directorName);
    const dMatched = dTokens.filter(t => aTokens.includes(t));
    if (dMatched.length >= Math.min(2, dTokens.length)) {
      return { isMatch: true, matchType: 'DIRECTOR_MATCH' };
    }
  }

  // Single word match fallback if profile has only 1 word
  if (pTokens.length === 1 && aTokens.includes(pTokens[0])) {
    return { isMatch: true, matchType: 'SINGLE_TOKEN' };
  }

  return { isMatch: false, reason: 'TOKEN_MISMATCH' };
}

module.exports = {
  verifyNubanNameMatch,
  normalizeName
};
