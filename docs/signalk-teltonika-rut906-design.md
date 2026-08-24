# Design: Signal K integration for Teltonika RUT906

Status: design proposal

## 1. Purpose

Create a TypeScript Signal K plugin that connects the Signal K server on the
HALPi2/HALOS installation with the boat's Teltonika RUT906 router.

The plugin shall initially provide:

1. Router and cellular connectivity status.
2. RUT906 GNSS/GPS data in Signal K.
3. A controlled SMS gateway for receiving and sending SMS.

The design shall leave room for later use of the RUT906 as an edge gateway for
a wind instrument, Modbus devices, MQTT data and boat power control.

This is a design document only. No router configuration or SMS command is
changed by this document.

## 2. Context and constraints

- Signal K runs in a container managed by HALOS.
- HALOS uses Traefik for externally exposed services. The plugin must not
  depend on direct external exposure of the RUT906 API.
- The plugin runs inside the Signal K container and reaches the RUT906 over
  the boat LAN using a configured private address.
- The built-in HALPi2 `can0` interface and the HWT905 `can1` integration remain
  separate from this plugin.
- RUT906 firmware and RutOS versions can change API availability and response
  formats. The plugin must record and expose the detected model, firmware and
  API capabilities.
- Router credentials, SMS contents and API tokens are secrets. They must never
  be written to logs, Signal K deltas or Git.

### Confirmed installation parameters

- RUT906 LAN address: `192.168.15.1`
- Router API user: `signalk`
- Router API password: supplied interactively during development/configuration;
  never store it in this repository
- Router date/time: corrected and verified against the development machine and
  browser at the time of this update

## 3. Relevant capabilities

Teltonika documents the RUT906 as supporting GNSS, SMS, JSON-RPC/Web API,
MQTT, Modbus over RS232/RS485/TCP/USB and data-to-server functions. The
official RUT906 material also describes API support as firmware-dependent.

Primary references:

- [Teltonika Networks Web API](https://developers.teltonika-networks.com/)
- [RUT906 product page](https://www.teltonika-networks.com/products/routers/rut906)
- [RUT906 remote monitoring and administration](https://wiki.teltonika-networks.com/view/RUT906_Remote_Monitoring_%26_Administration)
- [RUT906 services](https://wiki.teltonika-networks.com/view/RUT906_Services_section)

Existing Signal K implementations are useful reference material, but their
transport and register assumptions are not treated as authoritative for this
RUT906 installation:

- [signalk-teltonika-rutx11](https://github.com/meri-imperiumi/signalk-teltonika-rutx11)
- [@rhizomatics/signalk-teltonika-sms-plugin](https://www.npmjs.com/package/@rhizomatics/signalk-teltonika-sms-plugin)

The RUTX11 plugin demonstrates a polling-based Signal K plugin and a Modbus
register mapping. It also closes each Modbus connection because the router
limits concurrent sessions. That is an important operational lesson, but the
register map must be verified independently for RUT906 firmware.

## 4. Proposed plugin shape

Package name:

```text
signalk-teltonika-rut906
```

Suggested layout:

```text
plugin/signalk-teltonika-rut906/
  src/
    index.ts                 # Signal K lifecycle and configuration
    teltonika-client.ts      # authenticated API transport
    capability-discovery.ts  # model, firmware and available endpoints
    status-service.ts        # router/cellular polling
    gps-service.ts           # GNSS polling and validation
    sms-service.ts           # inbox/outbox and controlled send operation
    mappings.ts              # Teltonika response -> Signal K values
    errors.ts
    types.ts
  test/
    fixtures/
    *.test.ts
  package.json
  tsconfig.json
  README.md
```

The core services must not depend directly on Signal K. They return typed
domain objects; `index.ts` maps those objects to Signal K updates. This keeps
the API client testable and makes a later MQTT/Modbus transport possible.

## 5. Transport strategy

### 5.1 Primary: Teltonika Web API / JSON-RPC

Use the official RUTOS Web API as the preferred transport for:

- device identity and firmware
- system and service status
- mobile registration and signal information
- WAN/interface status
- GNSS position, fix quality and satellites
- SMS inbox, status and send operation where supported

The exact methods and response schemas must be captured from the RUT906’s
firmware/API documentation before implementation. The client shall isolate
method names and paths in one module so firmware-specific changes do not leak
into the Signal K mapping layer.

### 5.2 Secondary: Modbus TCP

Modbus TCP is a possible status/GPS fallback and a likely path for a future
wind sensor. It must not be the first implementation unless the RUT906 API
does not expose a required value.

If used:

- maintain a versioned register map per RUTOS/device firmware;
- use explicit endianness and scaling definitions;
- open and close connections safely, or use a bounded pool only after testing;
- never write registers during status polling;
- expose a diagnostic error when a register map is unsupported.

### 5.3 Secondary: MQTT

MQTT is a good future transport for wind data and event-driven telemetry when
the RUT906 is configured as a Modbus-to-MQTT gateway or MQTT publisher. The
plugin should later support an MQTT source adapter, but the MVP should not
require a broker or duplicate the router’s gateway configuration.

### 5.4 Future: edge control and I/O

Router outputs, SMS rules, MQTT commands and a Sonoff integration are control
surfaces. They must be implemented as explicit, separately enabled command
capabilities. Read-only monitoring must remain functional when all command
capabilities are disabled.

## 6. Signal K data model

### 6.1 Standard Signal K paths

Use standard paths where the meaning matches the specification:

- `navigation.position.latitude`
- `navigation.position.longitude`
- `navigation.speedOverGround` when the RUT906 supplies GNSS speed
- `navigation.gnss.satellites`
- `navigation.gnss.horizontalDilution`

The GPS source must include a stable `$source`, for example:

```text
teltonika.rut906.gnss
```

### 6.2 Router diagnostics

Use a namespaced diagnostic tree to avoid pretending that router metrics are
boat instruments:

```text
networking.teltonika.rut906.connection
networking.teltonika.rut906.cellular
networking.teltonika.rut906.wan
networking.teltonika.rut906.wifi
networking.teltonika.rut906.system
networking.teltonika.rut906.sms
```

Candidate values include:

- model, serial-independent identity and firmware version;
- uptime, temperature and service health;
- SIM slot, operator, registration state and roaming;
- RSSI/RSRP/RSRQ/SINR where available;
- network technology and WAN address/state;
- received/transmitted byte counters;
- GPS fix state, timestamp, HDOP and satellites;
- SMS inbox count, last received time and last send result.

Exact names and units are to be finalized in `mappings.ts` after a real API
capture from the RUT906.

## 7. Plugin configuration

The Signal K Admin UI configuration should be simple for the normal case and
explicit about risky features.

### Connection

- RUT906 host/IP address: `192.168.15.1`;
- API username: `signalk`;
- API password: entered through Signal K configuration or a protected runtime
  secret, never committed to Git;
- HTTP versus HTTPS;
- API port;
- request timeout;
- polling interval;
- TLS certificate verification policy;
- credential or token reference, never a value printed in logs.

### Features

- Enable router status polling: default on.
- Enable GPS polling: default on.
- Enable SMS receive/inbox polling: default off until tested.
- Enable SMS sending: default off and separately protected.
- Enable Modbus adapter: default off.
- Enable MQTT adapter: default off.
- Enable control actions (router output/Sonoff integration): default off.

### Safety defaults

- Read-only operation on first install.
- No router reboot, configuration write, SMS send or output switching from
  `start()`.
- Bounded retries with exponential backoff.
- Circuit breaker after repeated authentication or transport failures.
- Stale status reported explicitly rather than retaining an apparently live
  value indefinitely.

## 8. SMS design

SMS is both a data source and an actuator, so it needs stronger safeguards
than ordinary status polling.

### Receive

- Poll or subscribe to the RUT906 inbox using the documented API.
- Deduplicate messages by router-provided ID/timestamp.
- Publish only metadata and safe status to Signal K by default.
- Do not publish full SMS body to a public Signal K path unless explicitly
  enabled.
- Provide a local plugin REST endpoint for an authenticated UI to inspect and
  acknowledge messages.

### Send

- Disabled by default.
- Require explicit plugin configuration and Signal K authorization.
- Validate destination, length and rate limit.
- Never send automatically based only on a received SMS.
- Record send result, not message content, in diagnostics.

## 9. GPS quality and source policy

The plugin must not overwrite a better GPS source blindly.

- Publish RUT906 GNSS as a named source.
- Include fix validity and freshness.
- Do not publish coordinates when the router reports no valid fix.
- Preserve the last value only for diagnostics; mark it stale.
- Make source priority a configuration decision in Signal K rather than an
  implicit plugin behavior.

## 10. HALOS/container deployment

The plugin is installed in the Signal K container through the normal Signal K
plugin mechanism. It must not require Node.js or npm on the HALPi2 host for
runtime operation.

Runtime requirements:

- container network route to the RUT906 private IP;
- DNS or fixed IP configuration documented;
- persistent Signal K plugin configuration volume;
- no dependency on Traefik for container-to-router traffic;
- Traefik remains responsible for external browser/API exposure;
- logs available through the HALOS container service without secrets.

Development can still use a local Signal K container, a mocked RUT906 API and
recorded JSON fixtures. Hardware validation must be performed against the
actual RUT906 firmware before enabling writes or SMS sending.

## 11. Testing strategy

### Unit tests

- API authentication and token refresh/error handling;
- response parsing and unit conversion;
- GPS validity and stale behavior;
- cellular status mappings;
- SMS deduplication and validation;
- Modbus endianness/scaling fixtures;
- MQTT topic/payload parsing;
- redaction of credentials and SMS bodies.

### Integration tests

- mock HTTP/JSON-RPC server matching recorded RUT906 responses;
- Signal K plugin lifecycle and configuration;
- retry/backoff and circuit breaker behavior;
- container-to-router connectivity;
- plugin restart without duplicate SMS processing.

### Hardware acceptance tests

1. Read-only router status.
2. GPS fix and loss of fix.
3. Router reboot and network outage recovery.
4. SMS receive and acknowledgement.
5. SMS send only after explicit approval.
6. Wind sensor input through the selected Modbus/MQTT path.
7. Sonoff/HALPi2 control with a safe power-cycle/rollback plan.

## 12. Phased implementation

### Phase 0 — API evidence

- Record RUT906 model, serial-independent firmware version and enabled API
  services.
- Export or capture the official API definitions for the installed firmware.
- Use `192.168.15.1` as the initial private LAN endpoint.
- Authenticate with the dedicated `signalk` user; enter the password only at
  test/configuration time.
- Confirm API transport, authentication and TLS behavior without weakening
  router access control.
- Capture status, GPS and SMS responses without changing router configuration.

### Phase 1 — Read-only MVP

- TypeScript plugin scaffold.
- Web API client with typed responses.
- Router/cellular diagnostics.
- GPS mapping.
- Signal K Admin configuration.
- Unit and mocked integration tests.

### Phase 2 — SMS receive

- Inbox polling and deduplication.
- Safe diagnostic status.
- Authenticated UI endpoint.
- No send capability yet.

### Phase 3 — SMS send and actions

- Explicitly enabled send operation.
- Rate limiting, authorization and audit-safe result logging.

### Phase 4 — Wind instrument gateway

- Decide between direct Modbus polling, RUT906 MQTT gateway, or RUT906
  Data-to-Server/MQTT publication.
- Add a transport-neutral wind decoder and Signal K mapping.

### Phase 5 — Boat power/control

- Define Sonoff protocol and failure behavior.
- Add explicit control actions for equipment power.
- Add HALPi2 shutdown/start semantics only after hardware interlocks and
  manual recovery are documented.

## 13. Decisions still required

- Installed RUTOS firmware version.
- Whether `192.168.15.1` is reserved/static for the RUT906.
- API version/methods available on the installed firmware.
- TLS certificate strategy for local container-to-router traffic.
- Exact GPS response fields and coordinate/freshness semantics.
- SMS retention, privacy and acknowledgement policy.
- Wind instrument electrical/protocol interface: RS485/Modbus, NMEA, MQTT or
  another output.
- Sonoff model, protocol and safe default state.
- Whether router status should be published to standard Signal K paths,
  custom `networking.teltonika.*` paths, or both.

## 14. First implementation task

Before writing the TypeScript plugin, create an API evidence bundle containing:

```text
docs/teltonika-rut906-api-evidence/
  README.md
  device-info.json
  status.json
  gps.json
  sms-status.json
  api-capabilities.json
```

Redact credentials, phone numbers, SMS bodies and public IP addresses. The
first TypeScript implementation should be read-only and target the recorded
responses, with a mocked API test suite before it is installed in HALOS.

## 15. Codex kickoff in VS Code

The project is ready for the next Codex task in the VS Code Remote-SSH
workspace on HALPi2. Start with the following prompt:

```text
Læs AGENTS.md, README.md, DEVELOPMENT_PLAN.md,
docs/signalk-teltonika-rut906-design.md og
docs/teltonika-rut906-device-baseline.md.

Vi skal starte Phase 0 for Signal K-pluginet til Teltonika RUT906.

Bekræftede værdier:
- RUT906 LAN-IP: 192.168.15.1
- API-bruger: signalk
- API-password må aldrig gemmes i filer, logs eller Git.
- RutOS: RUT9M_R_00.07.24
- Signal K kører i HALOS-containeren.

Lav først en konkret plan for API-evidence og read-only test.
Brug den officielle Teltonika Web API-dokumentation og verificér de faktiske
API-metoder mod routerens firmware. Implementér ikke router-konfiguration,
SMS-afsendelse, reboot eller andre write-operationer endnu.

Opret kun nødvendige sanitiserede evidence-fixtures og tests.
Bed brugeren indtaste password interaktivt ved test, hvis det er nødvendigt.
Kør relevante tests efter ændringer og vis en tydelig opsummering af fundne
API-endpoints, response-formater og næste beslutning.
```
