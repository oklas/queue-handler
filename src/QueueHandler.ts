import QueueHandlerOptions from './QueueHandlerOptions'
import IQueue from './IQueue'
import QueueHandlerFunction from './QueueHandlerFunction'

export default class QueueHandler<Payload> {
  _log: string[] = []
  opts: QueueHandlerOptions
  _queue: IQueue<Payload>
  _handler: QueueHandlerFunction<Payload> | undefined
  _processDone: boolean = false
  _processError: string = ''
  _processAck: string | undefined = undefined
  _stopHandler?: () => void | undefined
  _poolingInterval: number
  _pingingInterval: number
  _timer: NodeJS.Timer | undefined
  _poolingProcess: boolean = false
  _pingingProcess: boolean = false

  constructor(
    opts: QueueHandlerOptions,
    queue: IQueue<Payload>,
    handler?: QueueHandlerFunction<Payload>,
  ) {
    this.opts = opts
    this._queue = queue
    this._handler = handler
    this._poolingInterval = 1000 * this.opts.poolingInterval
    this._pingingInterval = (1000 * this.opts.visibilityInterval) / 2
  }

  log(str?: string) {
    if (str !== undefined) this._log.push(str)
    return this._log
  }

  async put(payload: Payload) {
    this._queue.put(payload)
  }

  start() {
    this._stopHandler = undefined
    this._startPooling()
  }

  async stop() {
    const done = new Promise((resolve) => {
      this._stopHandler = () => {
        resolve(null)
      }
    })
    this._cleanAndStop()
    return done
  }

  _cleanAndStop() {
    if (this._processAck && !this._processDone) return
    if (this._poolingProcess) return
    clearTimeout(this._timer)
    if (!this._stopHandler) throw Error('stop without handler')
    this._stopHandler?.()
  }

  async _pool() {
    this._poolingProcess = true
    const record = await this._queue.get()
    this._poolingProcess = false
    this._timer = undefined
    if (record) {
      this._process(record.ack, record.payload)
    } else if (this._stopHandler) {
      this._stopHandler?.()
    } else {
      this._startPooling()
    }
  }

  _startPooling() {
    if (this._timer) throw Error('share pooloing timer')
    this._timer = setTimeout(this._pool.bind(this), this._poolingInterval)
  }

  async _ping() {
    if (!this._processAck) throw Error('nothing to ping')
    this._pingingProcess = true
    this.log(`ping start ${this._processAck}`)
    await this._queue.ping(this._processAck)
    this.log(`ping finish ${this._processAck}`)
    this._pingingProcess = false
    this._timer = undefined
    if (this._processDone) {
      this.log(`ping call done ${this._processAck}`)
      this._done()
    } else {
      this._startPinging()
    }
  }

  _startPinging() {
    if (this._timer) throw Error('share pinging timer')
    this._timer = setTimeout(this._ping.bind(this), this._pingingInterval)
  }

  async _done() {
    if (this._pingingProcess) return
    if (!this._processAck) throw Error('done with empty ack')
    if (this._timer) clearTimeout(this._timer)
    this._timer = undefined
    this.log(`done start ${this._processAck}`)
    await this._queue.done(this._processAck!, this._processError)
    this.log(`done finish ${this._processAck}`)
    if (this._stopHandler) {
      this._stopHandler?.()
    } else {
      this._startPooling()
    }
  }

  async _process(ack: string, payload: Payload) {
    this._processAck = ack
    this._processDone = false
    this._processError = ''
    this._startPinging()
    try {
      await this._handler?.({ack, payload})
    } catch (e: unknown) {
      let error = 'error unknown type'
      if (typeof e === 'string') {
        error = e
      } else if (e instanceof Error) {
        error = e.message + (this.opts.debug && e.stack ? ' ' + e.stack : '')
      }
      this._processError = error
    }
    this._processDone = true
    this.log(`process call done ${this._processAck}`)
    this._done()
  }
}
