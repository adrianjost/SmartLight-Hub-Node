# SmartLight Hub 🔀

Keeps your local SmartLight devices in sync with the database.
It is currently the best way to control your SmartLight devices using the public API (for IFTTT) or Google Assistant.

## How it works

The Architecture of this Hub is relatively simple. It registeres a Firebase Snapshot Listener on all your saved units in the database and get's informed whenever those change. When a change happens, it forwards the new wanted state to your devices.
The same logic applies vice versa. The Hub always keeps an WebSocket connection to your lights open and whenever those send a state change, the Hub writes those changes into the database.

## Setup

```
npm i

# for development
npm run dev

# for production
npm run start
```

The production script fetches the latest version of this codebase and installs all dependencies before starting the actual server. This enables automatic updates when deployed on a headless raspberry pi. All you need to do, is to register a regular cronjob to restart your pi and execute `npm run start` on boot.
