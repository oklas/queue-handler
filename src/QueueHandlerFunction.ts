import QueueRecord from './QueueRecord'

declare type QueueHandlerFunction<Payload> = (record: QueueRecord<Payload>) => Promise<void>

export default QueueHandlerFunction
