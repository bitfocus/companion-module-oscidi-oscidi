import type ModuleInstance from './main.js'
import type { OscidiTargetType } from './types.js'

export type ActionsSchema = {
	set_route_enabled: {
		options: {
			routeId: string
			enabled: boolean
		}
	}
	set_destination_enabled: {
		options: {
			destinationId: string
			enabled: boolean
		}
	}
	rename_route: {
		options: {
			routeId: string
			name: string
		}
	}
}

export function UpdateActions(self: ModuleInstance): void {
	self.setActionDefinitions({
		set_route_enabled: {
			name: 'Set route enabled',
			options: [
				uuidField('routeId', 'Route UUID', 'route'),
				{
					type: 'checkbox',
					id: 'enabled',
					label: 'Enabled',
					default: true,
				},
			],
			callback: async ({ options }) => {
				const routeId = resolveRequiredText(self, options.routeId, 'route UUID')
				if (!routeId) return

				self.sendOsc(`/oscidi/route/${routeId}/setEnabled`, [{ type: 'i', value: options.enabled ? 1 : 0 }])
			},
		},
		set_destination_enabled: {
			name: 'Set destination enabled',
			options: [
				uuidField('destinationId', 'Destination UUID', 'destination'),
				{
					type: 'checkbox',
					id: 'enabled',
					label: 'Enabled',
					default: true,
				},
			],
			callback: async ({ options }) => {
				const destinationId = resolveRequiredText(self, options.destinationId, 'destination UUID')
				if (!destinationId) return

				self.sendOsc(`/oscidi/destination/${destinationId}/setEnabled`, [{ type: 'i', value: options.enabled ? 1 : 0 }])
			},
		},
		rename_route: {
			name: 'Rename route',
			options: [
				uuidField('routeId', 'Route UUID', 'route'),
				{
					type: 'textinput',
					id: 'name',
					label: 'Route name',
					default: '',
					useVariables: true,
				},
			],
			callback: async ({ options }) => {
				const routeId = resolveRequiredText(self, options.routeId, 'route UUID')
				if (!routeId) return

				const name = options.name ?? ''
				self.sendOsc(`/oscidi/route/${routeId}/name`, [{ type: 's', value: name }])
			},
		},
	})
}

function uuidField<TKey extends string>(id: TKey, label: string, kind: OscidiTargetType) {
	return {
		type: 'textinput' as const,
		id,
		label,
		default: '',
		useVariables: true,
		description:
			kind === 'route'
				? 'Paste a route UUID manually, or insert a live route variable if Oscidi status data is available.'
				: 'Paste a destination UUID manually, or insert a live destination variable if Oscidi status data is available.',
	}
}

function resolveRequiredText(self: ModuleInstance, value: unknown, label: string): string | undefined {
	const resolved = stringifyOption(value).trim()
	if (resolved.length > 0) return resolved

	self.log('warn', `Oscidi action skipped: ${label} is empty.`)
	return undefined
}

function stringifyOption(value: unknown): string {
	if (typeof value === 'string') return value
	if (typeof value === 'number' || typeof value === 'boolean') return String(value)
	return ''
}
