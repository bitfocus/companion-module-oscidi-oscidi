import type { SomeCompanionConfigField } from '@companion-module/base'
import { DEFAULT_CONFIG, type ModuleConfig } from './types.js'

export type { ModuleConfig }

export function GetConfigFields(): SomeCompanionConfigField[] {
	return [
		{
			type: 'textinput',
			id: 'host',
			label: 'Oscidi host',
			width: 8,
			default: DEFAULT_CONFIG.host,
		},
		{
			type: 'number',
			id: 'port',
			label: 'OSC UDP port',
			width: 4,
			default: DEFAULT_CONFIG.port,
			min: 1024,
			max: 65535,
		},
	]
}

export function normalizeConfig(config: ModuleConfig): ModuleConfig {
	return {
		host: config.host || DEFAULT_CONFIG.host,
		port: Number(config.port) || DEFAULT_CONFIG.port,
	}
}
