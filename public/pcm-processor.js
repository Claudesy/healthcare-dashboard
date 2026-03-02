class PCMProcessor extends AudioWorkletProcessor {
  process(inputs) {
    const input = inputs[0];
    if (!input || !input[0]) return true;
    const float32 = input[0];
    const buf = new Int16Array(float32.length);
    for (let i = 0; i < float32.length; i++) {
      const s = Math.max(-1, Math.min(1, float32[i]));
      buf[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    this.port.postMessage(buf.buffer, [buf.buffer]);
    return true;
  }
}
registerProcessor("pcm-processor", PCMProcessor);
