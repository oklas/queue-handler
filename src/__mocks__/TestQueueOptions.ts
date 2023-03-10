export default interface TestQueueOptions {
  [key: string]: any
  quant?: number
  putDelay?: number
  getDelay?: number
  pingDelay?: number
  doneDelay?: number
  countDelay?: number
}
