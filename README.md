Print certificates for WCA competitions using WCA Live

**Fork of [Goosly/wca-certificates](https://github.com/Goosly/wca-certificates) with added support for [Dual Rounds](https://www.worldcubeassociation.org/regulations/#9v) (WCA Regulation 9v).** When an event uses two consecutive rounds where all competitors advance and the podium is determined by each competitor's best result from either round, enable the "Dual rounds (R1+R2)" toggle per event before printing — certificates will reflect the correct combined ranking.

Hosted at: https://timobrembeck.github.io/wca-certificates/

# Development

Requires Node.js 17+ users to set `NODE_OPTIONS=--openssl-legacy-provider` due to OpenSSL 3 incompatibility with webpack 4. The npm scripts handle this automatically.

To run locally:
1) > npm install
2) > npm start

3) Navigate to http://localhost:4200/

# Deployment

Every push to `main` is automatically built and deployed to GitHub Pages via the `deploy.yml` workflow. No manual steps required.

To build locally (e.g. to test the production build):
> npm run build-prod

The output is in `dist/wca-certificates/`. The `build-prod.sh` script can still be used for manual deployments if needed (requires `angular-cli-ghpages` installed globally: `npm install -g angular-cli-ghpages`).
