const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 8080;
const COPILOT_URL = process.env.COPILOT_URL || 'http://localhost:8081';

// Azure Managed Identity env vars (set automatically by App Service)
const IDENTITY_ENDPOINT = process.env.IDENTITY_ENDPOINT;
const IDENTITY_HEADER = process.env.IDENTITY_HEADER;

const MIME = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.ico': 'image/x-icon',
};

// Get a managed identity token for the copilot app
async function getManagedIdentityToken(audience) {
    if (!IDENTITY_ENDPOINT || !IDENTITY_HEADER) return null; // local dev, no MI

    const url = `${IDENTITY_ENDPOINT}?resource=${encodeURIComponent(audience)}&api-version=2019-08-01`;
    const transport = url.startsWith('https') ? https : http;
    return new Promise((resolve, reject) => {
        const req = transport.get(url, { headers: { 'X-IDENTITY-HEADER': IDENTITY_HEADER } }, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(body).access_token || null);
                } catch { resolve(null); }
            });
        });
        req.on('error', () => resolve(null));
    });
}

// Proxy a request to the copilot service
async function proxyCopilot(prompt) {
    const copilotAudience = process.env.COPILOT_APP_ID || '';
    const token = await getManagedIdentityToken(copilotAudience);
    console.log('MI token acquired:', !!token, 'audience:', copilotAudience);

    const target = new URL(COPILOT_URL + '/ask');
    const transport = target.protocol === 'https:' ? https : http;
    const body = JSON.stringify({ prompt });

    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = 'Bearer ' + token;

    return new Promise((resolve, reject) => {
        const req = transport.request(target, { method: 'POST', headers }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                console.log('Copilot response:', res.statusCode, data.slice(0, 200));
                if (res.statusCode === 401) {
                    resolve({ error: 'Copilot rejected auth token (401). MI token present: ' + !!token });
                    return;
                }
                if (res.statusCode !== 200) {
                    resolve({ error: 'Copilot returned ' + res.statusCode + ': ' + data });
                    return;
                }
                try { resolve(JSON.parse(data)); }
                catch { resolve({ error: data || 'empty response' }); }
            });
        });
        req.on('error', err => reject(err));
        req.end(body);
    });
}

http.createServer(async (req, res) => {
    // API route: proxy to copilot
    if (req.method === 'POST' && req.url === '/api/copilot') {
        let body = '';
        for await (const chunk of req) body += chunk;
        try {
            const { prompt } = JSON.parse(body);
            if (!prompt) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Missing prompt' }));
                return;
            }
            const result = await proxyCopilot(prompt);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(result));
        } catch (e) {
            res.writeHead(502, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Copilot unavailable: ' + e.message }));
        }
        return;
    }

    // Static files
    let filePath = '.' + (req.url === '/' ? '/index.html' : req.url.split('?')[0]);
    const ext = path.extname(filePath);
    const contentType = MIME[ext] || 'application/octet-stream';

    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.writeHead(404);
            res.end('Not found');
            return;
        }
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(data);
    });
}).listen(PORT, () => {
    console.log('Listening on port ' + PORT);
    console.log('Copilot proxy -> ' + COPILOT_URL);
});
