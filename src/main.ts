import { InstanceBase, InstanceStatus, type SomeCompanionConfigField } from '@companion-module/base'
import osc, { type Argument as OscArgument, type Message as OscMessage, type UDPPort } from 'osc'
import { UpdateActions, type ActionsSchema } from './actions.js'
import { GetConfigFields, normalizeConfig, type ModuleConfig } from './config.js'
import { UpdateFeedbacks, type FeedbacksSchema } from './feedbacks.js'
import { UpdatePresets } from './presets.js'
import { isStatusMessage, parseStatusMessage } from './status.js'
import { createEmptyStatusCache, STATUS_POLL_INTERVAL_MS, type OscidiStatusCache } from './types.js'
import { UpgradeScripts } from './upgrades.js'
import { UpdateVariableDefinitions, UpdateVariableValues, type VariablesSchema } from './variables.js'

export type ModuleSchema = {
	config: ModuleConfig
	secrets: undefined
	actions: ActionsSchema
	feedbacks: FeedbacksSchema
	variables: VariablesSchema
}

export { UpgradeScripts }

export default class ModuleInstance extends InstanceBase<ModuleSchema> {
	config!: ModuleConfig
	private udp?: UDPPort
	private statusPollTimer?: ReturnType<typeof setInterval>
	private statusCache: OscidiStatusCache = createEmptyStatusCache()
	private receivedStatus = false

	constructor(internal: unknown) {
		super(internal)
	}

	async init(config: ModuleConfig): Promise<void> {
		this.config = normalizeConfig(config)

		this.updateActions()
		this.updateFeedbacks()
		this.updatePresets()
		this.refreshVariables()
		this.updateStatus(InstanceStatus.Connecting)
		this.openUDP()
	}

	async destroy(): Promise<void> {
		this.stopStatusPolling()

		const udp = this.udp
		this.udp = undefined
		udp?.close()
	}

	async configUpdated(config: ModuleConfig): Promise<void> {
		this.config = normalizeConfig(config)
		this.updateStatus(InstanceStatus.Connecting)
		this.openUDP()
	}

	getConfigFields(): SomeCompanionConfigField[] {
		return GetConfigFields()
	}

	updateActions(): void {
		UpdateActions(this)
	}

	updateFeedbacks(): void {
		UpdateFeedbacks(this)
	}

	updatePresets(): void {
		UpdatePresets(this)
	}

	updateVariableDefinitions(): void {
		UpdateVariableDefinitions(this)
	}

	updateVariableValues(): void {
		UpdateVariableValues(this)
	}

	getStatusCache(): OscidiStatusCache {
		return this.statusCache
	}

	hasStatusData(): boolean {
		return this.receivedStatus
	}

	sendOsc(address: string, args: OscArgument[] = []): void {
		this.udp?.send({ address, args })
	}

	private openUDP(): void {
		this.stopStatusPolling()
		this.clearStatusCache()

		const previousUdp = this.udp
		this.udp = undefined
		previousUdp?.close()

		const udp = new osc.UDPPort({
			localAddress: '0.0.0.0',
			localPort: 0,
			remoteAddress: this.config.host,
			remotePort: this.config.port,
			metadata: true,
		})

		udp.on('ready', () => {
			if (this.udp !== udp) return

			this.updateStatus(InstanceStatus.Ok)
			this.requestStatus()
			this.startStatusPolling()
		})

		udp.on('message', (message) => {
			if (this.udp !== udp) return

			this.handleIncomingMessage(message)
		})

		udp.on('error', (error) => {
			if (this.udp !== udp) return

			const message = error instanceof Error ? error.message : String(error)
			this.updateStatus(InstanceStatus.UnknownWarning, message)
			this.log('warn', `Oscidi UDP error: ${message}`)
		})

		udp.on('close', () => {
			if (this.udp !== udp) return

			this.stopStatusPolling()
			this.updateStatus(InstanceStatus.Disconnected)
		})

		this.udp = udp
		udp.open()
	}

	private requestStatus(): void {
		this.sendOsc('/oscidi/status')
	}

	private startStatusPolling(): void {
		this.stopStatusPolling()
		this.statusPollTimer = setInterval(() => {
			this.requestStatus()
		}, STATUS_POLL_INTERVAL_MS)
	}

	private stopStatusPolling(): void {
		if (!this.statusPollTimer) return

		clearInterval(this.statusPollTimer)
		this.statusPollTimer = undefined
	}

	private handleIncomingMessage(message: OscMessage): void {
		if (!isStatusMessage(message.address)) return

		const nextCache = parseStatusMessage(message, (warning) => this.log('warn', warning))
		if (!nextCache) return

		this.statusCache = nextCache
		this.receivedStatus = true
		this.refreshVariables()
	}

	private clearStatusCache(): void {
		this.statusCache = createEmptyStatusCache()
		this.receivedStatus = false
		this.refreshVariables()
	}

	private refreshVariables(): void {
		this.updateVariableDefinitions()
		this.updateVariableValues()
	}
}
