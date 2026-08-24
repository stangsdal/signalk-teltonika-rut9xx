# Teltonika RUT906 device baseline

Captured from the router status page. Sensitive identifiers such as serial
number, IMEI and MAC addresses are intentionally not stored in the repository.

## Device

- Device name: `Frumadsen`
- Product code: `RUT90600XXXX`
- Hardware revision: `0404`
- Bootloader version: `4.3.0`
- Batch number: `0006`

## System

- RutOS firmware: `RUT9M_R_00.07.24`
- Kernel: `5.15.200`
- Reported uptime at capture: `12h 58m 47s`
- Reported load average: `0.74, 0.79, 0.85`
- Reported local device time: `2026-09-28 10:26:22`

The reported router time is later than the project environment date at the
time of capture. Verify NTP/timezone configuration before using router
timestamps as authoritative Signal K timestamps.

## Internal modem

- Model: `SLM770-A`
- Firmware: `SLM770A_3.0.26_EQ102`
- Temperature at capture: `38 °C`

## Memory and storage

- RAM used: `66.41%`
- RAM buffered: `0.04%`
- Flash used: `19.41%`

## Design implications

- The plugin must record and expose model, RutOS firmware, kernel, modem
  model/firmware and resource usage as diagnostic data.
- API capability discovery must be tested against RutOS
  `RUT9M_R_00.07.24`.
- Modem temperature and resource usage are suitable first diagnostic metrics.
- Serial number, IMEI and MAC addresses may be used at runtime for device
  identity but must be redacted from logs, fixtures and Git.
- The first API evidence capture should include the router's timezone/NTP
  status and the raw timestamp format returned by the API.
