# RUT906 API evidence

This directory contains sanitized, read-only API captures from the RUT906.
The capture tool authenticates with a runtime password and never stores the
password or the session token.

## Capture

Run this from a host that can reach the router LAN address:

```text
node scripts/capture-rut906-api.js
```

The script prompts for the password without echoing it. It uses HTTPS and
accepts the router's local certificate for this development-only capture.
It performs one login request and GET requests only; it does not change router
configuration, reboot the router, remove SMS messages, or send SMS.

The expected output files are:

- `device-info.json`
- `status.json`
- `gps.json`
- `sms-status.json`
- `api-capabilities.json`

Before committing captures, inspect them manually. The script redacts common
secret and identity fields, phone numbers, message bodies, and public IP
values, but evidence must still be reviewed before it is committed.

The installed device baseline is RutOS `RUT9M_R_00.07.24`. The official API
documentation may show a different API revision, so the router's actual
responses are authoritative for the plugin implementation.

## Capture findings

The dedicated `signalk` account can read these endpoints on the installed
firmware:

- `/api/system/device/status`
- `/api/system/device/usage/status`
- `/api/modems/status`
- `/api/modems/signal/status`
- `/api/sim_cards/status`
- `/api/gps/status`
- `/api/gps/position/status`
- `/api/gps/nmea/status`
- `/api/gps/global`
- `/api/messages/storage/status`
- `/api/messages/status`

`/api/network/devices/status` returned `403`. The GPS service is enabled via
`/api/gps/global`, and the latest capture confirms that the position, NMEA and
GPS status endpoints are readable with the dedicated account.

The latest capture includes a valid GPS position from `/api/gps/position/status`:
latitude, longitude, altitude, accuracy, fix status, timestamp, satellite
count, course and speed. Optional or permission-restricted endpoints must not
prevent the read-only diagnostics from being published.

The modem response provides cellular state, operator, LTE band, signal
metrics, temperature, SIM state, and byte counters. SMS data is available for
read-only inspection; SMS sending has not been tested or enabled.
