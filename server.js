import { createServer } from 'https';
import { parse } from 'url';
import next from 'next';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();


let httpsOptions;

try {
  httpsOptions = {
    key: readFileSync(join(__dirname, '.certificates', 'localhost-key.pem')),
    cert: readFileSync(join(__dirname, '.certificates', 'localhost.pem')),
  };
} catch (err) {
  console.error(
    'Failed to load HTTPS Certificates from ".certificates' + '\nPlease ensure to follow docs/HTTPS_SETUP.md' 
    + `\nError thrown: ${err}`
  )
  process.exit(1);
}


const port = process.env.PORT || 3000

app.prepare().then(() => {
  createServer(httpsOptions, (req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  }).listen(3000, (err) => {
    if (err) throw err;
    console.log(`> Ready on https://localhost:${port}`);
  });
});
