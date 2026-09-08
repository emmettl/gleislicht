import type { NetworkTrain } from '@motionstudies/core/domain/network'

export const rigiOperator = (train: NetworkTrain) => (train as NetworkTrain & { operator?: string }).operator ?? ''
