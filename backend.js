// backend.js
// Purpose: Broadcasts service via mDNS and provides a simple API endpoint.
// Technology: Node.js, Express, bonjour-service

import express from 'express';
import { Bonjour } from 'bonjour-service';
import os from 'os';

const PORT = process.env.BACKEND_PORT || 8080; // Use env var or default
const SERVICE_TYPE = '_my-cool-app._tcp';
const SERVICE_NAME = `backend-service-${os.hostname()}-${PORT}`; // Make somewhat unique
const API_ENDPOINT = '/api/v1/hello-world';

const app = express();
const bonjour = new Bonjour();

// --- API Endpoint ---
app.get(API_ENDPOINT, (req, res) => {
  console.log(`[Backend] Received request at ${API_ENDPOINT}`);
  res.json({
    message: "Hello from the Backend!",
    timestamp: new Date().toISOString(),
    source: SERVICE_NAME,
  });
});

// --- mDNS Broadcasting ---
function startBroadcasting() {
 console.log(`[Backend] Attempting to broadcast mDNS service: ${SERVICE_NAME} of type ${SERVICE_TYPE} on port ${PORT}`);
  const service = bonjour.publish({
    name: SERVICE_NAME,
    type: SERVICE_TYPE,
    port: PORT,
    // Optional TXT records for additional metadata
    // txt: { description: 'My awesome backend API' }
  });

  service.on('error', (error) => {
    console.error('[Backend] mDNS Broadcasting Error:', error);
    // Potentially retry or exit gracefully
  });

  service.on('up', () => {
    console.log(`[Backend] Service ${SERVICE_NAME} is up and broadcasting on port ${PORT}.`);
  });

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('[Backend] Shutting down...');
    bonjour.unpublishAll(() => {
      console.log('[Backend] mDNS services unpublished.');
      bonjour.destroy();
      console.log('[Backend] Bonjour instance destroyed.');
      server.close(() => {
        console.log('[Backend] HTTP server closed.');
        process.exit(0);
      });
    });
  });
}

// --- Start Server ---
const server = app.listen(PORT, '0.0.0.0', () => { // Listen on all interfaces
  console.log(`[Backend] Server listening on http://0.0.0.0:${PORT}`);
  // Start broadcasting *after* the server is confirmed listening
  startBroadcasting();
}).on('error', (err) => {
    console.error(`[Backend] Failed to start server on port ${PORT}:`, err);
    process.exit(1);
});