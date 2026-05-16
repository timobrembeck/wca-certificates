Print certificates for WCA competitions using WCA Live

Hosted at: https://goosly.github.io/wca-certificates/

# Development

Requires Node.js 17+ users to set `NODE_OPTIONS=--openssl-legacy-provider` due to OpenSSL 3 incompatibility with webpack 4. The npm scripts handle this automatically.

To run locally:
1) > npm install
2) > npm start

2) Navigate to http://localhost:4200/

To build & deploy to GitHub Pages, install angular-cli-ghpages and run the bash script:
1) npm install -g angular-cli-ghpages
2) > sh build-prod.sh

This builds the app and pushes the 'dist' directory to a branch called 'gh-pages', which will trigger a build by GitHub Pages
