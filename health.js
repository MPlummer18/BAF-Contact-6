const { sendJson, legislators } = require('./_shared');

module.exports = async function handler(req, res) {
  return sendJson(res, 200, {
    ok: true,
    legislatorCount: legislators.length,
    lookupProvider: process.env.LOOKUP_PROVIDER || 'palegis',
    governorEmail: process.env.GOVERNOR_EMAIL || 'governor@pa.gov'
  });
};
