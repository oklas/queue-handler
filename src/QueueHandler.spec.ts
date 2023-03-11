import {expect} from '@jest/globals'
import {Sequence, quant, quantDuration} from 'jest-sequence'
import QueueHandler from './QueueHandler'
import TestQueue from './__mocks__/TestQueue'
import QueueHandlerOptions from './QueueHandlerOptions'
import QueueRecord from './QueueRecord'

const methodsOfTestQueue = ['put', 'get', 'ping', 'done'] as jest.FunctionPropertyNames<
  TestQueue<string>
>[]
const methodsOfQueueHandler = [
  '_process',
  '_done',
  '_startPinging',
  '_ping',
  '_startPooling',
  '_pool',
] as jest.FunctionPropertyNames<QueueHandler<string>>[]

describe('queue handler', () => {
  afterEach(() => {
    jest.restoreAllMocks()
  })

  const opts: QueueHandlerOptions = {
    visibilityInterval: 3 * quantDuration,
    poolingInterval: 2 * quantDuration,
  }

  it('match basic time sequence', async () => {
    let result: string = ''
    const handler = async (record: QueueRecord<string>): Promise<void> => {
      await quant(2)
      result = record.payload
    }
    const queue = new TestQueue<string>({})
    const qh = new QueueHandler(opts, queue, handler)
    const sequence = new Sequence()
    sequence.spyOn(TestQueue.prototype, methodsOfTestQueue)
    sequence.spyOn(QueueHandler.prototype, methodsOfQueueHandler)

    qh.start()
    sequence.add(qh, '_startPooling', [])
    expect(sequence).toMatchSequence()

    await qh.put('first')
    sequence.add(queue, 'put', ['first'])
    expect(sequence).toMatchSequence()
    expect(await queue.count()).toEqual(1)
    expect(result).toEqual('')

    await quant(1)
    sequence.add(qh, '_pool', [])
    sequence.add(queue, 'get', [])
    expect(sequence).toMatchSequence()
    expect(await queue.count()).toEqual(0)
    expect(result).toEqual('')

    await quant(1)
    sequence.add(qh, '_process', ['1', 'first'])
    sequence.add(qh, '_startPinging', [])
    expect(sequence).toMatchSequence()
    expect(await queue.count()).toEqual(0)
    expect(result).toEqual('first')

    await quant(1)
    sequence.add(qh, '_ping', [])
    sequence.add(queue, 'ping', ['1'])
    sequence.add(qh, '_done', [])
    sequence.add(qh, '_done', [])
    sequence.add(queue, 'done', ['1', ''])
    expect(sequence).toMatchSequence()
    expect(await queue.count()).toEqual(0)
    expect(result).toEqual('first')
    expect(queue.getError('1')).toEqual('')
    await qh.stop()
  })

  it('do not starts pinging on quick handler', async () => {
    let result
    const handler = async (record: QueueRecord<string>): Promise<void> => {
      result = record.payload
      throw Error(`error for ${result}`)
    }
    const queue = new TestQueue<string>({})
    const qh = new QueueHandler(opts, queue, handler)
    const sequence = new Sequence()
    sequence.spyOn(TestQueue.prototype, methodsOfTestQueue)
    sequence.spyOn(QueueHandler.prototype, methodsOfQueueHandler)

    qh.start()
    sequence.add(qh, '_startPooling', [])
    expect(sequence).toMatchSequence()

    await qh.put('testerr')
    sequence.add(queue, 'put', ['testerr'])
    expect(sequence).toMatchSequence()

    await quant(1)
    expect(sequence).toMatchSequence()

    await quant(1)
    sequence.add(qh, '_pool', [])
    sequence.add(queue, 'get', [])
    expect(sequence).toMatchSequence()

    await quant(1)
    sequence.add(qh, '_process', ['1', 'testerr'])
    sequence.add(qh, '_startPinging', [])
    sequence.add(qh, '_done', [])
    sequence.add(queue, 'done', ['1', 'error for testerr'])
    expect(sequence).toMatchSequence()

    expect(await queue.count()).toEqual(0)
    sequence.add(qh, '_startPooling', [])
    expect(sequence).toMatchSequence()

    expect(result).toEqual('testerr')
    expect(queue.getError('1')).toMatch(new RegExp(`^error for testerr`))
    await qh.stop()
  })

  it('checks with ping shorter than process', async () => {
    let result
    const queue = new TestQueue<string>({})
    const handler = async (record: QueueRecord<string>): Promise<void> => {
      await quant(3)
      result = record.payload
    }
    const qh = new QueueHandler(opts, queue, handler)
    const sequence = new Sequence()
    sequence.spyOn(TestQueue.prototype, methodsOfTestQueue)
    sequence.spyOn(QueueHandler.prototype, methodsOfQueueHandler)

    qh.start()
    sequence.add(qh, '_startPooling', [])
    expect(sequence).toMatchSequence()

    await qh.put('result')
    sequence.add(queue, 'put', ['result'])
    expect(sequence).toMatchSequence()

    await quant(1)
    expect(sequence).toMatchSequence()

    await quant(1)
    sequence.add(qh, '_pool', [])
    sequence.add(queue, 'get', [])
    expect(sequence).toMatchSequence()

    await quant(1)
    sequence.add(qh, '_process', ['1', 'result'])
    sequence.add(qh, '_startPinging', [])
    expect(sequence).toMatchSequence()

    await quant(1)
    expect(sequence).toMatchSequence()

    await quant(1)
    sequence.add(qh, '_ping', [])
    sequence.add(queue, 'ping', ['1'])
    expect(sequence).toMatchSequence()

    await quant(1)
    sequence.add(qh, '_startPinging', [])
    sequence.add(qh, '_done', [])
    sequence.add(queue, 'done', ['1', ''])
    expect(sequence).toMatchSequence()

    expect(await queue.count()).toEqual(0)
    expect(result).toEqual('result')
    await qh.stop()
  })

  it('checks with ping longer than process', async () => {
    let result
    const queue = new TestQueue<string>({
      pingDelay: 3,
    })
    const handler = async (record: QueueRecord<string>): Promise<void> => {
      await quant(2)
      result = record.payload
    }
    const qh = new QueueHandler(opts, queue, handler)
    const sequence = new Sequence()
    sequence.spyOn(TestQueue.prototype, methodsOfTestQueue)
    sequence.spyOn(QueueHandler.prototype, methodsOfQueueHandler)

    qh.start()
    sequence.add(qh, '_startPooling', [])
    expect(sequence).toMatchSequence()

    await qh.put('result')
    sequence.add(queue, 'put', ['result'])
    expect(sequence).toMatchSequence()

    await quant(1)
    expect(sequence).toMatchSequence()

    await quant(1)
    sequence.add(qh, '_pool', [])
    sequence.add(queue, 'get', [])
    expect(sequence).toMatchSequence()

    await quant(1)
    sequence.add(qh, '_process', ['1', 'result'])
    sequence.add(qh, '_startPinging', [])
    expect(sequence).toMatchSequence()

    await quant(1)
    expect(sequence).toMatchSequence()

    await quant(1)
    sequence.add(qh, '_ping', [])
    sequence.add(queue, 'ping', ['1'])
    sequence.add(qh, '_done', [])
    expect(sequence).toMatchSequence()

    await quant(1)
    expect(sequence).toMatchSequence()

    await quant(1)
    expect(sequence).toMatchSequence()

    await quant(1)
    sequence.add(qh, '_done', [])
    sequence.add(queue, 'done', ['1', ''])
    expect(sequence).toMatchSequence()

    expect(await queue.count()).toEqual(0)
    expect(result).toEqual('result')
    await qh.stop()
  })
})
