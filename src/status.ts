import type { Argument as OscArgument, Message as OscMessage, MessageArgument as OscMessageArgument } from 'osc'
import type { OscidiStatusCache, OscidiStatusRecord, OscidiStatusTarget, OscidiTargetType } from './types.js'

export function isStatusMessage(address: string): boolean {
	return address === '/oscidi/status' || address.startsWith('/oscidi/status/')
}

export function parseStatusMessage(
	message: OscMessage,
	logWarning: (message: string) => void,
): OscidiStatusCache | undefined {
	const args = unwrapOscArgs(message.args ?? [])
	const items = extractStatusItems(args, logWarning)
	if (!items) return undefined

	return {
		routes: items.filter((item) => item.type === 'route'),
		destinations: items.filter((item) => item.type === 'destination'),
	}
}

function unwrapOscArgs(args: OscMessageArgument[]): unknown[] {
	return args.map((arg) => unwrapOscValue(arg))
}

function unwrapOscValue(value: OscMessageArgument): unknown {
	if (Array.isArray(value)) {
		return value.map((item) => unwrapOscValue(item))
	}

	if (isTypedOscArgument(value)) {
		return unwrapOscValue(value.value)
	}

	return value
}

function isTypedOscArgument(value: unknown): value is OscArgument {
	return typeof value === 'object' && value !== null && 'type' in value && 'value' in value
}

function extractStatusItems(args: unknown[], logWarning: (message: string) => void): OscidiStatusTarget[] | undefined {
	const jsonArg = args.find((arg): arg is string => typeof arg === 'string' && looksLikeJson(arg.trim()))
	if (jsonArg) {
		return parseStatusJson(jsonArg, logWarning)
	}

	if (args.length === 0) return undefined

	return parseFlatStatusArgs(args)
}

function looksLikeJson(value: string): boolean {
	return value.startsWith('{') || value.startsWith('[')
}

function parseStatusJson(json: string, logWarning: (message: string) => void): OscidiStatusTarget[] | undefined {
	try {
		const parsed = JSON.parse(json) as unknown
		return normalizeStatusPayload(parsed)
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error)
		logWarning(`Failed to parse Oscidi status JSON: ${message}`)
		return undefined
	}
}

function normalizeStatusPayload(payload: unknown): OscidiStatusTarget[] {
	if (Array.isArray(payload)) {
		return payload.map((item) => normalizeStatusItem(item)).filter(isStatusTarget)
	}

	if (!payload || typeof payload !== 'object') {
		return []
	}

	const record = payload as OscidiStatusRecord
	const targets = Array.isArray(record.targets)
		? record.targets
		: Array.isArray(record.items)
			? record.items
			: undefined

	if (targets) {
		return targets.map((item) => normalizeStatusItem(item)).filter(isStatusTarget)
	}

	const routes = Array.isArray(record.routes)
		? record.routes.map((item) => normalizeStatusItem(item, 'route')).filter(isStatusTarget)
		: []
	const destinations = Array.isArray(record.destinations)
		? record.destinations.map((item) => normalizeStatusItem(item, 'destination')).filter(isStatusTarget)
		: []

	if (routes.length > 0 || destinations.length > 0) {
		return [...routes, ...destinations]
	}

	const singleItem = normalizeStatusItem(record)
	return singleItem ? [singleItem] : []
}

function parseFlatStatusArgs(args: unknown[]): OscidiStatusTarget[] | undefined {
	if (args.length % 4 !== 0) return undefined

	const items: OscidiStatusTarget[] = []
	for (let index = 0; index < args.length; index += 4) {
		const item = normalizeStatusItem({
			uuid: args[index],
			name: args[index + 1],
			enabled: args[index + 2],
			type: args[index + 3],
		})

		if (!item) return undefined
		items.push(item)
	}

	return items
}

function normalizeStatusItem(item: unknown, fallbackType?: OscidiTargetType): OscidiStatusTarget | undefined {
	if (!item || typeof item !== 'object' || Array.isArray(item)) return undefined

	const record = item as OscidiStatusRecord
	const uuid = normalizeString(record.uuid ?? record.id)
	const type = normalizeTargetType(record.type, fallbackType)
	const enabled = normalizeBoolean(record.enabled)

	if (!uuid || !type || enabled === undefined) return undefined

	return {
		uuid,
		type,
		enabled,
		name: normalizeString(record.name) ?? uuid,
	}
}

function normalizeString(value: unknown): string | undefined {
	if (typeof value !== 'string') return undefined

	const normalized = value.trim()
	return normalized.length > 0 ? normalized : undefined
}

function normalizeTargetType(value: unknown, fallbackType?: OscidiTargetType): OscidiTargetType | undefined {
	if (typeof value === 'string') {
		const normalized = value.trim().toLowerCase()
		if (normalized === 'route' || normalized === 'destination') {
			return normalized
		}
	}

	return fallbackType
}

function normalizeBoolean(value: unknown): boolean | undefined {
	if (typeof value === 'boolean') return value
	if (typeof value === 'number') return value !== 0

	if (typeof value === 'string') {
		const normalized = value.trim().toLowerCase()
		if (['1', 'true', 'yes', 'on', 'enabled'].includes(normalized)) return true
		if (['0', 'false', 'no', 'off', 'disabled'].includes(normalized)) return false
	}

	return undefined
}

function isStatusTarget(item: OscidiStatusTarget | undefined): item is OscidiStatusTarget {
	return item !== undefined
}
