/**
 * Evolution Agent authorization helpers.
 * Write/mutate routes MUST require a configured Bearer token.
 * Health may remain open without calling isAuthorized.
 */

/**
 * @param {Object} req - Node HTTP request (headers.authorization)
 * @param {string} token - expected Bearer token from config/env
 * @param {Object} [opts]
 * @param {boolean} [opts.allowInsecure=false] - only for explicit test/dev override
 * @returns {boolean}
 */
function isAuthorized(req, token, opts) {
  opts = opts || {};
  if (!token) {
    // No token configured: deny all protected routes unless explicit insecure override
    return opts.allowInsecure === true;
  }
  var auth = (req && req.headers && req.headers.authorization) || '';
  return auth === 'Bearer ' + token;
}

module.exports = { isAuthorized };
