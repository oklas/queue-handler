import IQueue from '../IQueue'
import QueueRecord from '../QueueRecord'
import {quantDuration, timeout} from 'jest-sequence'
import TestQueueOptions from './TestQueueOptions'

const defaultOptions: TestQueueOptions = {
  quantDuration,
  putDelay: 1,
  getDelay: 1,
  pingDelay: 1,
  doneDelay: 1,
  countDelay: 1,
}

export default class TestQueue<Payload> implements IQueue<Payload> {
  _opts: TestQueueOptions
  _nextId: number = 1
  _queue: Record<number, Payload> = {}
  _acks: Record<number, boolean> = {}
  _dones: Record<number, string> = {}

  constructor(opts: TestQueueOptions) {
    this._opts = {...defaultOptions, ...opts}
  }

  async delay(name: string) {
    const delay = this._opts[name + 'Delay'] as number
    const quantDuration = this._opts.quantDuration || 1000
    await timeout(delay * quantDuration)
  }

  async put(payload: Payload): Promise<void> {
    await this.delay('put')
    this._queue[this._nextId++] = payload
  }

  async get(): Promise<QueueRecord<Payload> | null> {
    await this.delay('get')
    const allAsks = Object.keys(this._queue) as unknown[] as number[]
    const visibleAcks = allAsks.filter((k: number) => !this._acks[k])
    if (!visibleAcks.length) return null
    const ackId = Math.min(...visibleAcks)
    const ack = ackId.toString()
    const payload = this._queue[ackId]
    this._acks[ackId] = true
    return {ack, payload} as QueueRecord<Payload>
  }

  async ping(_ack: string): Promise<void> {
    await this.delay('ping')
  }

  async done(ack: string, error?: string): Promise<void> {
    await this.delay('done')
    const ackId = parseInt(ack)
    delete this._queue[ackId]
    delete this._acks[ackId]
    this._dones[ackId] = error || ''
  }

  async count() {
    await this.delay('count')
    return Object.keys(this._queue).length - Object.keys(this._acks).length
  }

  getError(ack: string): string | undefined {
    const ackId = parseInt(ack)
    return this._dones[ackId]
  }
}
