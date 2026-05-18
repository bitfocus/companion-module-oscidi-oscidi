# Oscidi Companion Module

Bitfocus Companion module for controlling Oscidi over OSC/UDP.

In Companion, the module is listed as:

```text
Oscidi - Oscidi
```

Maintainer: Rasmus Kreiner

## Requirements

- Bitfocus Companion 4.x
- Node.js 22 for local development/builds
- Oscidi with Companion Bridge enabled

## Connection

- Host: the Mac running Oscidi, usually `127.0.0.1` when Companion runs on the same machine.
- Port: the Oscidi Companion Bridge UDP port. Default: `9000`.

Enable the Companion Bridge in Oscidi before sending commands.
The module also polls `/oscidi/status` on a short interval. If Oscidi returns live status data, Companion can cache route and destination metadata and expose live variables without changing the manual UUID workflow.

## Actions

- Set route enabled
- Set destination enabled
- Rename route

Each action keeps a manual UUID field as the fallback path. Paste the UUID directly from Oscidi, or insert a Companion variable if live status data is available.

## OSC Endpoints

### Routes

- `/oscidi/route/{routeId}/enable`
- `/oscidi/route/{routeId}/disable`
- `/oscidi/route/{routeId}/setEnabled true`
- `/oscidi/route/{routeId}/setEnabled false`
- `/oscidi/route/{routeId}/setEnabled 1`
- `/oscidi/route/{routeId}/setEnabled 0`
- `/oscidi/route/{routeId}/name "New route name"`

### Destinations

- `/oscidi/destination/{destinationId}/enable`
- `/oscidi/destination/{destinationId}/disable`
- `/oscidi/destination/{destinationId}/setEnabled true`
- `/oscidi/destination/{destinationId}/setEnabled false`
- `/oscidi/destination/{destinationId}/setEnabled 1`
- `/oscidi/destination/{destinationId}/setEnabled 0`

### Status

- `/oscidi/routes/list`
- `/oscidi/destinations/list`
- `/oscidi/status`

The module is prepared for status payloads containing `uuid`, `name`, `enabled`, and `type` for routes and destinations. If no live payload is returned, manual UUID entry continues to work unchanged.

## Live Variables

When status data exists, the module exposes variables such as:

- `status_available`
- `route_count`
- `destination_count`
- `route_names`
- `destination_names`
- `route_1_uuid`, `route_1_name`, `route_1_enabled`
- `destination_1_uuid`, `destination_1_name`, `destination_1_enabled`

These variables are optional and additive. The module still works with manually entered UUIDs when live status is unavailable.

## Development

Install dependencies:

```sh
npm ci
```

Run TypeScript and Companion module validation:

```sh
npm run check
```

Build the runtime output:

```sh
npm run build
```

Build an installable Companion package:

```sh
npm run build:module
```

The generated `dist/` and `pkg/` folders are ignored by Git. Rebuild them locally when needed.

## Repository Layout

```text
companion/manifest.json  Companion module metadata
companion/HELP.md        Help text shown inside Companion
src/index.ts             Module implementation
src/osc.d.ts             Local type declarations for osc
package.json             Scripts and dependencies
tsconfig.json            TypeScript configuration
```

## License

MIT
