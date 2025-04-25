# mDNS Service Discovery Proof-of-Concept

This project demonstrates service discovery in a local network using multicast DNS (mDNS) technology. It consists of three components that work together to showcase how services can discover each other without centralized configuration.

## Components

### 1. Backend Service

A simple Node.js server that:
* Broadcasts itself as an mDNS service on the local network
* Provides a basic API endpoint
* Can be run multiple times on different ports to simulate multiple services

### 2. BFF (Backend-For-Frontend) Service

Acts as a middleware that:
* Discovers backend services via mDNS
* Provides an API for the frontend to get the list of discovered services
* Proxies requests from frontend to the appropriate backend service

### 3. Frontend

A simple HTML page that:
* Polls the BFF for discovered backend services
* Displays the list of available services
* Allows testing API calls to each discovered service

## Prerequisites

* Node.js (v16+)
* npm

## Installation

```bash
# Clone the repository
git clone https://github.com/eiselems/mdns-poc.git
cd mdns

# Install dependencies
npm install
```

## Running the Application

### Step 1: Start the BFF Service

```bash
npm run start:bff
```

This will start the BFF service on port 1337. The BFF will begin scanning for backend services.

### Step 2: Start One or More Backend Services

In a new terminal:

```bash
# Start with default port (8080)
npm run start:backend

# OR start with a custom port
BACKEND_PORT=8081 npm run start:backend

# Start additional backends in new terminals
BACKEND_PORT=8082 npm run start:backend
```

Each backend will broadcast itself with a unique service name.

### Step 3: Open the Frontend

Open `index.html` in your web browser. You'll see:

1. A list of discovered backend services that updates every 5 seconds
2. Buttons to test calling each backend's API

## Testing Across Network Devices

To test service discovery across multiple devices on your local network:

1. Make sure all devices are on the same network
2. Start the BFF on one machine
3. Start backends on multiple machines (or multiple on the same machine)
4. Access the frontend from any device by pointing the browser to `http://<BFF_HOST_IP>:1337`

> **Note:** mDNS might be blocked by some corporate networks or firewalls.

## How It Works

1. **Backend Service**: Broadcasts its presence using mDNS with service type `_my-cool-app._tcp`
2. **BFF Service**: Listens for services with the same type and maintains a registry
3. **Frontend**: Polls the BFF's `/devices` endpoint and displays discovered services
4. When you click "Call Hello World", the frontend sends a request to the BFF's `/proxy/{serviceName}/api/v1/hello-world` endpoint
5. The BFF forwards the request to the appropriate backend and returns the response

## Running on Different Network Setups

* **Single Machine**: All components can run on the same machine for testing
* **Local Network**: Backend services can run on multiple machines while the BFF aggregates them
* **Across Networks**: Note that mDNS typically doesn't span across different subnets without some kind of relay or configuration


---

This project is a proof-of-concept and not intended for production use.