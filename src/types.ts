export type ModuleConfig = {
	host: string
	port: number
}

export type OscidiTargetType = 'route' | 'destination'

export type OscidiStatusTarget = {
	uuid: string
	name: string
	enabled: boolean
	type: OscidiTargetType
}

export type OscidiStatusCache = {
	routes: OscidiStatusTarget[]
	destinations: OscidiStatusTarget[]
}

export type OscidiStatusRecord = Record<string, unknown>

export const DEFAULT_CONFIG: ModuleConfig = {
	host: '127.0.0.1',
	port: 9000,
}

export const STATUS_POLL_INTERVAL_MS = 5000

export function createEmptyStatusCache(): OscidiStatusCache {
	return { routes: [], destinations: [] }
}
