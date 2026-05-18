import {
  CompanionActionDefinitions,
  CompanionVariableDefinition,
  CompanionVariableValues,
  InstanceBase,
  InstanceStatus,
  runEntrypoint,
  SomeCompanionConfigField,
} from '@companion-module/base'
import osc from 'osc'

type OscidiConfig = {
  host: string
  port: number
}

type OscidiTargetType = 'route' | 'destination'

type OscidiStatusTarget = {
  uuid: string
  name: string
  enabled: boolean
  type: OscidiTargetType
}

type OscidiStatusCache = {
  routes: OscidiStatusTarget[]
  destinations: OscidiStatusTarget[]
}

type OscidiStatusRecord = Record<string, unknown>

const STATUS_POLL_INTERVAL_MS = 5000

class OscidiInstance extends InstanceBase<OscidiConfig> {
  private config: OscidiConfig = { host: '127.0.0.1', port: 9000 }
  private udp?: osc.UDPPort
  private statusPollTimer?: ReturnType<typeof setInterval>
  private statusCache: OscidiStatusCache = { routes: [], destinations: [] }
  private hasReceivedStatus = false

  async init(config: OscidiConfig): Promise<void> {
    this.config = config
    this.setActionDefinitions(this.actions())
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

  async configUpdated(config: OscidiConfig): Promise<void> {
    this.config = config
    this.updateStatus(InstanceStatus.Connecting)
    this.openUDP()
  }

  getConfigFields(): SomeCompanionConfigField[] {
    return [
      {
        type: 'textinput',
        id: 'host',
        label: 'Oscidi host',
        width: 8,
        default: '127.0.0.1',
      },
      {
        type: 'number',
        id: 'port',
        label: 'OSC UDP port',
        width: 4,
        default: 9000,
        min: 1024,
        max: 65535,
      },
    ]
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
      remoteAddress: this.config.host || '127.0.0.1',
      remotePort: Number(this.config.port) || 9000,
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

  private send(address: string, args: osc.Argument[] = []): void {
    this.udp?.send({ address, args })
  }

  private requestStatus(): void {
    this.send('/oscidi/status')
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

  private handleIncomingMessage(message: osc.Message): void {
    if (!this.isStatusMessage(message.address)) return

    const nextCache = this.parseStatusMessage(message)
    if (!nextCache) return

    this.statusCache = nextCache
    this.hasReceivedStatus = true
    this.refreshVariables()
  }

  private isStatusMessage(address: string): boolean {
    return address === '/oscidi/status' || address.startsWith('/oscidi/status/')
  }

  private parseStatusMessage(message: osc.Message): OscidiStatusCache | undefined {
    const args = this.unwrapOscArgs(message.args ?? [])
    const items = this.extractStatusItems(args)
    if (!items) return undefined

    return {
      routes: items.filter((item) => item.type === 'route'),
      destinations: items.filter((item) => item.type === 'destination'),
    }
  }

  private unwrapOscArgs(args: osc.MessageArgument[]): unknown[] {
    return args.map((arg) => this.unwrapOscValue(arg))
  }

  private unwrapOscValue(value: osc.MessageArgument): unknown {
    if (Array.isArray(value)) {
      return value.map((item) => this.unwrapOscValue(item))
    }

    if (this.isTypedOscArgument(value)) {
      return this.unwrapOscValue(value.value)
    }

    return value
  }

  private isTypedOscArgument(value: unknown): value is osc.Argument {
    return typeof value === 'object' && value !== null && 'type' in value && 'value' in value
  }

  private extractStatusItems(args: unknown[]): OscidiStatusTarget[] | undefined {
    const jsonArg = args.find(
      (arg): arg is string => typeof arg === 'string' && this.looksLikeJson(arg.trim())
    )
    if (jsonArg) {
      return this.parseStatusJson(jsonArg)
    }

    if (args.length === 0) return undefined

    return this.parseFlatStatusArgs(args)
  }

  private looksLikeJson(value: string): boolean {
    return value.startsWith('{') || value.startsWith('[')
  }

  private parseStatusJson(json: string): OscidiStatusTarget[] | undefined {
    try {
      const parsed = JSON.parse(json) as unknown
      return this.normalizeStatusPayload(parsed)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      this.log('warn', `Failed to parse Oscidi status JSON: ${message}`)
      return undefined
    }
  }

  private normalizeStatusPayload(payload: unknown): OscidiStatusTarget[] {
    if (Array.isArray(payload)) {
      return payload
        .map((item) => this.normalizeStatusItem(item))
        .filter((item): item is OscidiStatusTarget => item !== undefined)
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
      return targets
        .map((item) => this.normalizeStatusItem(item))
        .filter((item): item is OscidiStatusTarget => item !== undefined)
    }

    const routes = Array.isArray(record.routes)
      ? record.routes
          .map((item) => this.normalizeStatusItem(item, 'route'))
          .filter((item): item is OscidiStatusTarget => item !== undefined)
      : []
    const destinations = Array.isArray(record.destinations)
      ? record.destinations
          .map((item) => this.normalizeStatusItem(item, 'destination'))
          .filter((item): item is OscidiStatusTarget => item !== undefined)
      : []

    if (routes.length > 0 || destinations.length > 0) {
      return [...routes, ...destinations]
    }

    const singleItem = this.normalizeStatusItem(record)
    return singleItem ? [singleItem] : []
  }

  private parseFlatStatusArgs(args: unknown[]): OscidiStatusTarget[] | undefined {
    if (args.length % 4 !== 0) return undefined

    const items: OscidiStatusTarget[] = []

    for (let index = 0; index < args.length; index += 4) {
      const item = this.normalizeStatusItem({
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

  private normalizeStatusItem(
    item: unknown,
    fallbackType?: OscidiTargetType
  ): OscidiStatusTarget | undefined {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return undefined

    const record = item as OscidiStatusRecord
    const uuid = this.normalizeString(record.uuid ?? record.id)
    const type = this.normalizeTargetType(record.type, fallbackType)
    const enabled = this.normalizeBoolean(record.enabled)

    if (!uuid || !type || enabled === undefined) return undefined

    return {
      uuid,
      type,
      enabled,
      name: this.normalizeString(record.name) ?? uuid,
    }
  }

  private normalizeString(value: unknown): string | undefined {
    if (typeof value !== 'string') return undefined

    const normalized = value.trim()
    return normalized.length > 0 ? normalized : undefined
  }

  private normalizeTargetType(
    value: unknown,
    fallbackType?: OscidiTargetType
  ): OscidiTargetType | undefined {
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase()
      if (normalized === 'route' || normalized === 'destination') {
        return normalized
      }
    }

    return fallbackType
  }

  private normalizeBoolean(value: unknown): boolean | undefined {
    if (typeof value === 'boolean') return value
    if (typeof value === 'number') return value !== 0

    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase()
      if (['1', 'true', 'yes', 'on', 'enabled'].includes(normalized)) return true
      if (['0', 'false', 'no', 'off', 'disabled'].includes(normalized)) return false
    }

    return undefined
  }

  private clearStatusCache(): void {
    this.statusCache = { routes: [], destinations: [] }
    this.hasReceivedStatus = false
    this.refreshVariables()
  }

  private refreshVariables(): void {
    this.setVariableDefinitions(this.variableDefinitions())
    this.setVariableValues(this.variableValues())
  }

  private variableDefinitions(): CompanionVariableDefinition[] {
    const definitions: CompanionVariableDefinition[] = [
      {
        variableId: 'status_available',
        name: 'Live status available',
      },
      {
        variableId: 'route_count',
        name: 'Live route count',
      },
      {
        variableId: 'destination_count',
        name: 'Live destination count',
      },
      {
        variableId: 'route_names',
        name: 'Live route names (comma separated)',
      },
      {
        variableId: 'destination_names',
        name: 'Live destination names (comma separated)',
      },
      {
        variableId: 'route_uuids',
        name: 'Live route UUIDs (comma separated)',
      },
      {
        variableId: 'destination_uuids',
        name: 'Live destination UUIDs (comma separated)',
      },
    ]

    this.statusCache.routes.forEach((route, index) => {
      const itemNumber = index + 1
      definitions.push(
        {
          variableId: `route_${itemNumber}_uuid`,
          name: `Route ${itemNumber} UUID (${route.name})`,
        },
        {
          variableId: `route_${itemNumber}_name`,
          name: `Route ${itemNumber} name`,
        },
        {
          variableId: `route_${itemNumber}_enabled`,
          name: `Route ${itemNumber} enabled`,
        }
      )
    })

    this.statusCache.destinations.forEach((destination, index) => {
      const itemNumber = index + 1
      definitions.push(
        {
          variableId: `destination_${itemNumber}_uuid`,
          name: `Destination ${itemNumber} UUID (${destination.name})`,
        },
        {
          variableId: `destination_${itemNumber}_name`,
          name: `Destination ${itemNumber} name`,
        },
        {
          variableId: `destination_${itemNumber}_enabled`,
          name: `Destination ${itemNumber} enabled`,
        }
      )
    })

    return definitions
  }

  private variableValues(): CompanionVariableValues {
    const values: CompanionVariableValues = {
      status_available: this.hasReceivedStatus,
      route_count: this.statusCache.routes.length,
      destination_count: this.statusCache.destinations.length,
      route_names: this.statusCache.routes.map((route) => route.name).join(', '),
      destination_names: this.statusCache.destinations.map((destination) => destination.name).join(', '),
      route_uuids: this.statusCache.routes.map((route) => route.uuid).join(', '),
      destination_uuids: this.statusCache.destinations.map((destination) => destination.uuid).join(', '),
    }

    this.statusCache.routes.forEach((route, index) => {
      const itemNumber = index + 1
      values[`route_${itemNumber}_uuid`] = route.uuid
      values[`route_${itemNumber}_name`] = route.name
      values[`route_${itemNumber}_enabled`] = route.enabled
    })

    this.statusCache.destinations.forEach((destination, index) => {
      const itemNumber = index + 1
      values[`destination_${itemNumber}_uuid`] = destination.uuid
      values[`destination_${itemNumber}_name`] = destination.name
      values[`destination_${itemNumber}_enabled`] = destination.enabled
    })

    return values
  }

  private actions(): CompanionActionDefinitions {
    const uuidField = (id: string, label: string, kind: OscidiTargetType) => ({
      type: 'textinput' as const,
      id,
      label,
      default: '',
      useVariables: true,
      description:
        kind === 'route'
          ? 'Paste a route UUID manually, or insert a live route variable if Oscidi status data becomes available.'
          : 'Paste a destination UUID manually, or insert a live destination variable if Oscidi status data becomes available.',
    })

    return {
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
          this.send(`/oscidi/route/${options.routeId}/setEnabled`, [
            { type: 'i', value: Boolean(options.enabled) ? 1 : 0 },
          ])
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
          this.send(`/oscidi/destination/${options.destinationId}/setEnabled`, [
            { type: 'i', value: Boolean(options.enabled) ? 1 : 0 },
          ])
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
          },
        ],
        callback: async ({ options }) => {
          this.send(`/oscidi/route/${options.routeId}/name`, [
            { type: 's', value: String(options.name ?? '') },
          ])
        },
      },
    }
  }
}

runEntrypoint(OscidiInstance, [])
