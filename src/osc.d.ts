declare module 'osc' {
	export type MessageScalar = string | number | boolean | null
	export type MessageArgument = MessageScalar | MessageArgument[] | Argument

	export type Argument =
		| { type: 's'; value: string }
		| { type: 'i'; value: number }
		| { type: 'f'; value: number }
		| { type: 'T'; value: boolean }
		| { type: 'F'; value: boolean }
		| { type: string; value: MessageArgument }

	export type Message = {
		address: string
		args?: MessageArgument[]
	}

	export class UDPPort {
		constructor(options: {
			localAddress: string
			localPort: number
			remoteAddress: string
			remotePort: number
			metadata?: boolean
		})

		open(): void
		close(): void
		send(message: Message): void
		on(event: 'ready', callback: () => void): this
		on(event: 'close', callback: () => void): this
		on(event: 'error', callback: (error: Error | string) => void): this
		on(event: 'message', callback: (message: Message, timeTag?: unknown, packetInfo?: unknown) => void): this
	}

	const osc: {
		UDPPort: typeof UDPPort
	}

	export default osc
}
