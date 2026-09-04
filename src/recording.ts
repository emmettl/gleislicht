interface RecordingOptions {
  readonly duration: number
  readonly onSaving: () => void
  readonly onComplete: () => void
}

export interface CanvasRecording {
  readonly stop: () => void
  readonly cancel: () => void
}

function recordingType(): { mimeType: string; extension: string } {
  const types = [
    { mimeType: 'video/mp4;codecs=h264', extension: 'mp4' },
    { mimeType: 'video/webm;codecs=vp9', extension: 'webm' },
    { mimeType: 'video/webm;codecs=vp8', extension: 'webm' },
    { mimeType: 'video/webm', extension: 'webm' },
  ]
  return types.find(({ mimeType }) => MediaRecorder.isTypeSupported(mimeType)) ?? {
    mimeType: '',
    extension: 'webm',
  }
}

function fileStamp(): string {
  return new Date().toISOString().replaceAll(':', '-').replace(/\.\d{3}Z$/, 'Z')
}

export function recordCanvas(
  canvas: HTMLCanvasElement,
  options: RecordingOptions,
): CanvasRecording {
  const stream = canvas.captureStream(30)
  const type = recordingType()
  const recorder = new MediaRecorder(
    stream,
    type.mimeType ? { mimeType: type.mimeType, videoBitsPerSecond: 8_000_000 } : undefined,
  )
  const chunks: Blob[] = []
  let stopped = false
  let discarded = false
  const timer = window.setTimeout(() => stop(), options.duration)

  recorder.addEventListener('dataavailable', (event) => {
    if (event.data.size) chunks.push(event.data)
  })
  recorder.addEventListener('stop', () => {
    window.clearTimeout(timer)
    stream.getTracks().forEach((track) => track.stop())
    if (discarded) {
      options.onComplete()
      return
    }
    const blob = new Blob(chunks, { type: recorder.mimeType || type.mimeType })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `gleislicht-${fileStamp()}.${type.extension}`
    link.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 1_000)
    options.onComplete()
  })
  recorder.addEventListener('error', () => {
    window.clearTimeout(timer)
    stream.getTracks().forEach((track) => track.stop())
    options.onComplete()
  })
  recorder.start(1_000)

  function stop() {
    if (stopped || recorder.state === 'inactive') return
    stopped = true
    options.onSaving()
    recorder.stop()
  }

  function cancel() {
    discarded = true
    stop()
  }

  return { stop, cancel }
}
