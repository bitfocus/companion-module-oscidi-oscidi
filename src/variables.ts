import type ModuleInstance from './main.js'

export type VariablesSchema = Record<string, string | number | boolean>

export function UpdateVariableDefinitions(self: ModuleInstance): void {
	const cache = self.getStatusCache()
	const definitions: Record<string, { name: string }> = {
		status_available: { name: 'Live status available' },
		route_count: { name: 'Live route count' },
		destination_count: { name: 'Live destination count' },
		route_names: { name: 'Live route names (comma separated)' },
		destination_names: { name: 'Live destination names (comma separated)' },
		route_uuids: { name: 'Live route UUIDs (comma separated)' },
		destination_uuids: { name: 'Live destination UUIDs (comma separated)' },
	}

	cache.routes.forEach((route, index) => {
		const itemNumber = index + 1
		definitions[`route_${itemNumber}_uuid`] = { name: `Route ${itemNumber} UUID (${route.name})` }
		definitions[`route_${itemNumber}_name`] = { name: `Route ${itemNumber} name` }
		definitions[`route_${itemNumber}_enabled`] = { name: `Route ${itemNumber} enabled` }
	})

	cache.destinations.forEach((destination, index) => {
		const itemNumber = index + 1
		definitions[`destination_${itemNumber}_uuid`] = {
			name: `Destination ${itemNumber} UUID (${destination.name})`,
		}
		definitions[`destination_${itemNumber}_name`] = { name: `Destination ${itemNumber} name` }
		definitions[`destination_${itemNumber}_enabled`] = { name: `Destination ${itemNumber} enabled` }
	})

	self.setVariableDefinitions(definitions)
}

export function UpdateVariableValues(self: ModuleInstance): void {
	const cache = self.getStatusCache()
	const values: VariablesSchema = {
		status_available: self.hasStatusData(),
		route_count: cache.routes.length,
		destination_count: cache.destinations.length,
		route_names: cache.routes.map((route) => route.name).join(', '),
		destination_names: cache.destinations.map((destination) => destination.name).join(', '),
		route_uuids: cache.routes.map((route) => route.uuid).join(', '),
		destination_uuids: cache.destinations.map((destination) => destination.uuid).join(', '),
	}

	cache.routes.forEach((route, index) => {
		const itemNumber = index + 1
		values[`route_${itemNumber}_uuid`] = route.uuid
		values[`route_${itemNumber}_name`] = route.name
		values[`route_${itemNumber}_enabled`] = route.enabled
	})

	cache.destinations.forEach((destination, index) => {
		const itemNumber = index + 1
		values[`destination_${itemNumber}_uuid`] = destination.uuid
		values[`destination_${itemNumber}_name`] = destination.name
		values[`destination_${itemNumber}_enabled`] = destination.enabled
	})

	self.setVariableValues(values)
}
