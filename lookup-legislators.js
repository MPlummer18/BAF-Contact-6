const { sendJson, readJsonBody, lookupDistricts, findLegislator } = require('./_shared');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed. Use POST.' });

  try {
    const body = await readJsonBody(req);
    const { street, city, state = 'PA', zip, manualHouseDistrict, manualSenateDistrict } = body || {};

    if (!street || !city || !state || !zip) {
      return sendJson(res, 400, { error: 'Street address, city, state, and ZIP code are required.' });
    }
    if (String(state).toUpperCase() !== 'PA') {
      return sendJson(res, 400, { error: 'This tool only supports Pennsylvania addresses.' });
    }

    const { houseDistrict, senateDistrict, source, verificationUrl } = await lookupDistricts({
      street, city, state, zip, manualHouseDistrict, manualSenateDistrict
    });

    const house = findLegislator('house', houseDistrict);
    const senate = findLegislator('senate', senateDistrict);

    if (!house || !senate) {
      return sendJson(res, 404, {
        error: 'Districts were found, but one or more legislators were not in the uploaded email list.',
        houseDistrict,
        senateDistrict
      });
    }

    return sendJson(res, 200, {
      source,
      verificationUrl,
      districts: { house: houseDistrict, senate: senateDistrict },
      legislators: { house, senate }
    });
  } catch (error) {
    console.error('lookup-legislators failed:', error);
    return sendJson(res, 500, { error: error.message });
  }
};
