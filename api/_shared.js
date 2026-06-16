const legislators = require('../data/legislators.json');

const PALEGIS_FIND_URL = 'https://www.palegis.us/find-my-legislator';
const GOVERNOR_EMAIL = process.env.GOVERNOR_EMAIL || 'governor@pa.gov';

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(payload));
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
      if (body.length > 1_000_000) {
        reject(new Error('Request body is too large.'));
        req.destroy();
      }
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try { resolve(JSON.parse(body)); } catch (err) { reject(new Error('Invalid JSON request body.')); }
    });
    req.on('error', reject);
  });
}

function normalizeDistrictId(chamber, districtNumber) {
  const prefix = chamber.toLowerCase().startsWith('s') ? 's' : 'h';
  return `${prefix}${String(districtNumber).padStart(3, '0')}`;
}

function findLegislator(chamber, districtNumber) {
  const districtId = normalizeDistrictId(chamber, districtNumber);
  return legislators.find(l => l.district_id === districtId);
}

function stripHtml(html) {
  return String(html)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&#39;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseDistrictFromText(text, chamber) {
  const patterns = chamber === 'house'
    ? [
        /House\s+District\s*(?:No\.?|#)?\s*(\d{1,3})/i,
        /Representative[^.]{0,220}?District\s*(?:No\.?|#)?\s*(\d{1,3})/i,
        /District\s*(\d{1,3})[^.]{0,220}?House/i
      ]
    : [
        /Senate\s+District\s*(?:No\.?|#)?\s*(\d{1,3})/i,
        /Senator[^.]{0,220}?District\s*(?:No\.?|#)?\s*(\d{1,3})/i,
        /District\s*(\d{1,3})[^.]{0,220}?Senate/i
      ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return Number(match[1]);
  }
  return null;
}

function parseDistrictsFromPaLegisHtml(html) {
  const text = stripHtml(html);
  const houseDistrict = parseDistrictFromText(text, 'house');
  const senateDistrict = parseDistrictFromText(text, 'senate');
  if (!houseDistrict || !senateDistrict) {
    throw new Error('The PA site responded, but the House and Senate district numbers could not be read from the response. Use Developer test mode or switch to a geocoding/GIS provider.');
  }
  return { houseDistrict, senateDistrict };
}

async function lookupDistrictsViaPaLegis(address) {
  const url = new URL(PALEGIS_FIND_URL);
  url.searchParams.set('streetAddress', address.street);
  url.searchParams.set('addressCity', address.city);
  url.searchParams.set('state', address.state || 'PA');
  url.searchParams.set('postalCode', address.zip);

  const response = await fetch(url, {
    headers: {
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'User-Agent': 'Mozilla/5.0 PA Constituent Letter Tool'
    }
  });
  if (!response.ok) throw new Error(`The PA legislator lookup site returned status ${response.status}.`);
  const html = await response.text();
  return { ...parseDistrictsFromPaLegisHtml(html), source: 'palegis.us', verificationUrl: url.toString() };
}

function extractDistrictsFromGeocodio(result) {
  const fields = result?.results?.[0]?.fields || {};
  const stateLeg = fields.state_legislative_districts || {};
  const house = stateLeg.house || stateLeg.lower || stateLeg.state_house || {};
  const senate = stateLeg.senate || stateLeg.upper || stateLeg.state_senate || {};
  const houseDistrict = Number(house.district_number || house.district || house.name?.match(/\d+/)?.[0]);
  const senateDistrict = Number(senate.district_number || senate.district || senate.name?.match(/\d+/)?.[0]);
  if (!houseDistrict || !senateDistrict) throw new Error('The address was geocoded, but state legislative districts were not returned.');
  return { houseDistrict, senateDistrict };
}

async function lookupDistrictsViaGeocodio(address) {
  if (!process.env.GEOCODIO_API_KEY) throw new Error('Geocodio lookup is not configured. Add GEOCODIO_API_KEY or set LOOKUP_PROVIDER=palegis.');
  const q = `${address.street}, ${address.city}, ${address.state} ${address.zip}`;
  const url = new URL('https://api.geocod.io/v1.7/geocode');
  url.searchParams.set('q', q);
  url.searchParams.set('fields', 'stateleg');
  url.searchParams.set('api_key', process.env.GEOCODIO_API_KEY);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Address lookup failed with status ${response.status}.`);
  const result = await response.json();
  return { ...extractDistrictsFromGeocodio(result), source: 'geocodio' };
}

async function lookupDistricts(address) {
  if (address.manualHouseDistrict && address.manualSenateDistrict) {
    return { houseDistrict: Number(address.manualHouseDistrict), senateDistrict: Number(address.manualSenateDistrict), source: 'manual-test-mode' };
  }
  const provider = String(process.env.LOOKUP_PROVIDER || 'palegis').toLowerCase();
  if (provider === 'palegis') return lookupDistrictsViaPaLegis(address);
  if (provider === 'geocodio') return lookupDistrictsViaGeocodio(address);
  throw new Error(`Unsupported LOOKUP_PROVIDER: ${provider}`);
}

module.exports = {
  GOVERNOR_EMAIL,
  legislators,
  sendJson,
  readJsonBody,
  findLegislator,
  lookupDistricts
};
