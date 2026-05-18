# Oscidi

This module controls Oscidi over OSC/UDP.

## Configuration

- `Oscidi host`: IP address or hostname of the Mac running Oscidi.
- `OSC UDP port`: Oscidi's Companion bridge port. The default is `9000`.

Enable the Companion bridge in Oscidi before sending commands.
The module also polls `/oscidi/status`. If Oscidi returns live status data in a future version, Companion can expose route and destination variables without removing manual UUID entry.

## Actions

- Set route enabled
- Set destination enabled
- Rename route

Paste route and destination UUIDs manually as the default workflow. If live status support becomes available, you can also insert Companion variables for cached routes and destinations.

## OSC Endpoints

- `/oscidi/route/{routeId}/setEnabled 1`
- `/oscidi/route/{routeId}/setEnabled 0`
- `/oscidi/destination/{destinationId}/setEnabled 1`
- `/oscidi/destination/{destinationId}/setEnabled 0`
- `/oscidi/route/{routeId}/name "New route name"`
- `/oscidi/status`

Oscidi also accepts the older `/enable` and `/disable` route and destination endpoints for compatibility.

## Live Variables

When status data exists, the module can expose variables such as `route_1_uuid`, `route_1_name`, `route_1_enabled`, `destination_1_uuid`, and `destination_1_enabled`.
