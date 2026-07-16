/**
 * StreamingTTSPlayer
 * 兼容 iOS Safari 的流式 TTS 播放器。
 *
 * 原理: 不使用 <audio> + MediaSource(iOS 支持差),
 * 而是用 Web Audio API 手动把每个 PCM 分片转成 AudioBuffer,
 * 按累计时间无缝排队播放(nextStartTime 调度)。
 *
 * 使用要求(iOS 关键点):
 * 1. AudioContext 必须在用户手势(click/touch)回调内创建或 resume()，
 *    否则 iOS 会静音且不报错。
 * 2. 采样率/声道数需要和后端 audio_setting 保持一致(由 server 的 'ready' 消息告知)。
 */
export class StreamingTTSPlayer {
  /**
   * @param {Object} opts
   * @param {string} opts.wsUrl - 后端代理 WebSocket 地址,例如 wss://your.domain/tts
   */
  constructor({ wsUrl }) {
    this.wsUrl = wsUrl;
    this.audioCtx = null;
    this.nextStartTime = 0;
    this.sampleRate = 24000;
    this.channels = 1;
    this.ws = null;
    this.onStatusChange = null; // (status: 'connecting'|'ready'|'playing'|'done'|'error') => void
    this.onError = null;
  }

  /**
   * 必须在用户点击等手势事件处理函数中调用一次,用于解锁 iOS 音频
   */
  unlockAudio() {
    if (!this.audioCtx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      this.audioCtx = new Ctx();
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
    // iOS 静音解锁小技巧: 播放一个极短的空白 buffer
    const buffer = this.audioCtx.createBuffer(1, 1, 22050);
    const src = this.audioCtx.createBufferSource();
    src.buffer = buffer;
    src.connect(this.audioCtx.destination);
    src.start(0);
  }

  /**
   * 开始合成并流式播放
   * @param {Object} params - { text, voiceId, model, speed, emotion, languageBoost }
   */
  speak(params) {
    if (!this.audioCtx) {
      throw new Error('请先在用户点击事件里调用 unlockAudio()');
    }
    this.nextStartTime = this.audioCtx.currentTime;
    this._setStatus('connecting');

    this.ws = new WebSocket(this.wsUrl);
    this.ws.binaryType = 'arraybuffer';

    this.ws.onopen = () => {
      this.ws.send(JSON.stringify({ type: 'synthesize', ...params }));
    };

    this.ws.onmessage = (event) => {
      if (typeof event.data === 'string') {
        this._handleControlMessage(JSON.parse(event.data));
      } else {
        // 二进制 PCM 分片
        this._scheduleChunk(event.data);
      }
    };

    this.ws.onerror = (err) => {
      this._setStatus('error');
      if (this.onError) this.onError(err);
    };

    this.ws.onclose = () => {
      // no-op，由 'done' 控制消息驱动状态
    };
  }

  /** 追加更多文本(同一会话内,可选功能) */
  appendText(text) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'append', text }));
    }
  }

  stop() {
    if (this.ws) this.ws.close();
  }

  _handleControlMessage(msg) {
    switch (msg.type) {
      case 'ready':
        this.sampleRate = msg.sampleRate;
        this.channels = msg.channels;
        this._setStatus('playing');
        break;
      case 'done':
        this._setStatus('done');
        break;
      case 'error':
        this._setStatus('error');
        if (this.onError) this.onError(new Error(msg.message));
        break;
    }
  }

  /**
   * 把收到的 PCM16 二进制分片转成 AudioBuffer 并无缝排入播放队列
   */
  _scheduleChunk(arrayBuffer) {
    const audioBuffer = this._pcm16ToAudioBuffer(arrayBuffer);
    if (!audioBuffer) return;

    const src = this.audioCtx.createBufferSource();
    src.buffer = audioBuffer;
    src.connect(this.audioCtx.destination);

    const now = this.audioCtx.currentTime;
    const startAt = Math.max(this.nextStartTime, now);
    src.start(startAt);
    this.nextStartTime = startAt + audioBuffer.duration;
  }

  _pcm16ToAudioBuffer(arrayBuffer) {
    if (arrayBuffer.byteLength < 2) return null;

    const int16 = new Int16Array(arrayBuffer);
    const frameCount = int16.length / this.channels;
    const audioBuffer = this.audioCtx.createBuffer(
      this.channels,
      frameCount,
      this.sampleRate
    );

    for (let ch = 0; ch < this.channels; ch++) {
      const channelData = audioBuffer.getChannelData(ch);
      for (let i = 0; i < frameCount; i++) {
        // 16bit PCM -> Float32 [-1, 1]
        channelData[i] = int16[i * this.channels + ch] / 32768;
      }
    }
    return audioBuffer;
  }

  _setStatus(status) {
    if (this.onStatusChange) this.onStatusChange(status);
  }
}
