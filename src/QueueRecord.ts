export default interface QueueRecord<Payload> {
  ack: string
  payload: Payload
}
