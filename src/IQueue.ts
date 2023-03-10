import QueueRecord from './QueueRecord'

export default interface IQueue<Payload> {
  put(payload: Payload): Promise<void>
  get(): Promise<QueueRecord<Payload> | null>
  ping(ack: string): Promise<void>
  done(ack: string, error?: string): Promise<void>
}
