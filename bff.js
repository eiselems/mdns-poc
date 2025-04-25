// bff.js
// Purpose: Discovers backend services via mDNS, provides discovery API, and proxies requests.
// Technology: Node.js, Express, bonjour-service, http-proxy-middleware

import express from 'express';
import { Bonjour } from 'bonjour-service';
import { createProxyMiddleware } from 'http-proxy-middleware';
import cors from 'cors';

const BFF_PORT = 1337;
const SERVICE_TYPE = '_my-cool-app._tcp'; // Must match the backend

const app = express();
const bonjour = new Bonjour();

// In-memory store for discovered services
// Key: service.name (e.g., "backend-service-hostname-8080")
// Value: { name: string, host: string, port: number, discoveredAt: Date }
const discoveredServices = new Map();

// Enable CORS for requests from the frontend (localhost:any)
// In production, restrict the origin more carefully.
app.use(cors());

// --- mDNS Discovery ---
function startDiscovery() {
  console.log(`[BFF] Starting mDNS discovery for type ${SERVICE_TYPE}...`);
  const browser = bonjour.find({ type: SERVICE_TYPE });

  browser.on('up', (service) => {
    // Bonjour might find multiple IPv4/IPv6 addresses. Prefer IPv4 for simplicity in PoC.
    console.log({service});
    const ipv4Address = service.addresses.find(addr => !addr.includes(':')); // Basic IPv4 check
    const host = ipv4Address || service.host; // Fallback to service.host if no explicit IPv4

    if (!discoveredServices.has(service.name)) {
        console.log(`[BFF] Discovered service: ${service.name} at ${host}:${service.port}`);
        discoveredServices.set(service.name, {
          name: service.name,
          host: host, // Use the resolved IP address
          port: service.port,
          discoveredAt: new Date(),
          // You might want to store other info like service.txt here
          referer: service.referer.address,
          fqdn: service.fqdn
        });
    } else {
        // Optional: Handle updates if needed (e.g., port change, although rare with bonjour-service)
        // console.log(`[BFF] Service already known: ${service.name}`);
    }
  });

  browser.on('down', (service) => {
    console.log(`[BFF] Service went down: ${service.name}`);
    discoveredServices.delete(service.name);
  });

  browser.on('error', (error) => {
      console.error('[BFF] mDNS Discovery Error:', error);
  });

  // Start browsing
  browser.start();

  process.on('SIGINT', () => {
    console.log('[BFF] Shutting down...');
    browser.stop();
    console.log('[BFF] mDNS discovery stopped.');
    bonjour.destroy();
    console.log('[BFF] Bonjour instance destroyed.');
    server.close(() => {
      console.log('[BFF] HTTP server closed.');
      process.exit(0);
    });
  });
}

// --- API Endpoints ---

// Endpoint to list discovered services
app.get('/devices', (req, res) => {
  console.log(`[BFF] Request received for /devices`);
  
  const servicesArray = Array.from(discoveredServices.values());
  res.json(servicesArray);
});

// --- Proxy Middleware ---
// Matches /proxy/<serviceName>/<any>/<path>
app.use('/proxy/:serviceName', (req, res, next) => {
    const serviceName = req.params.serviceName;
    const targetService = discoveredServices.get(serviceName);

    console.log(`[BFF] Proxy request for service: ${serviceName}`);

    if (!targetService) {
        console.warn(`[BFF] Target service "${serviceName}" not found in discovered list.`);
        return res.status(404).json({ error: 'Service not found or not discovered yet.' });
    }

    //TODO: check if referer is always a good idea, but feels like this is the ip it will be reachable
    //Ideally we would be using the fqdn, but this seems not to work on first try
    const targetUrl = `http://${targetService.referer}:${targetService.port}`;
    console.log(`[BFF] Proxying to target: ${targetUrl}`);

    // Dynamically create proxy middleware for the specific target
    const proxy = createProxyMiddleware({
        target: targetUrl,
        changeOrigin: true,
        pathRewrite: (path, req) => {
            // Original path: /proxy/serviceName/api/v1/hello-world
            // Rewritten path: /api/v1/hello-world
            const rewrittenPath = path.replace(`/proxy/${serviceName}`, '');
            console.log(`[BFF] Rewriting path from "${path}" to "${rewrittenPath || '/'}"`);
            return rewrittenPath || '/'; // Ensure root path if original was just /proxy/serviceName
        },
        logLevel: 'debug', // For PoC visibility, reduce in production
        onError: (err, req, res) => {
            console.error('[BFF] Proxy error:', err);
            if (!res.headersSent) {
                 res.status(502).json({ error: 'Proxy error', details: err.message });
            }
        },
    });

    proxy(req, res, next);

});

// --- Start Server ---
const server = app.listen(BFF_PORT, 'localhost', () => { 
  console.log(`[BFF] Server listening on http://localhost:${BFF_PORT}`);
  
  startDiscovery();
}).on('error', (err) => {
    console.error(`[BFF] Failed to start server on port ${BFF_PORT}:`, err);
    process.exit(1);
});