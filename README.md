# PA Legislator Letter Tool - Flat Vercel Version

This version is intentionally flat for Vercel troubleshooting. The front-end files live at the repository root, and the serverless API routes live directly in `/api`.

Your GitHub repository must show these at the top level:

- api/
- data/
- index.html
- app.js
- styles.css
- package.json
- vercel.json

Do not upload the zip file itself. Upload the unzipped files.

## Test after deployment

Open:

https://YOUR-APP.vercel.app/api/health

You should see JSON with `ok: true` and `legislatorCount: 253`.

If you see "The page could not be found," Vercel is still not seeing the `/api` folder at the project root.
