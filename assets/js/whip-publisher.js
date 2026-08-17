export class WhipPublisher {
  constructor() {
    this.pc = null;
    this.resourceUrl = null;
  }

  async publish(stream, endpoint) {
    if (!endpoint) throw new Error('Debes ingresar la URL WHIP.');
    this.pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.cloudflare.com:3478' }]
    });

    stream.getTracks().forEach(track => this.pc.addTrack(track, stream));
    const offer = await this.pc.createOffer();
    await this.pc.setLocalDescription(offer);
    await this.#waitForIceGathering();

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/sdp' },
      body: this.pc.localDescription.sdp
    });

    if (!response.ok) {
      const details = await response.text().catch(() => '');
      throw new Error(`El servidor WHIP respondió ${response.status}. ${details}`.trim());
    }

    const answerSdp = await response.text();
    await this.pc.setRemoteDescription({ type: 'answer', sdp: answerSdp });
    const location = response.headers.get('Location');
    if (location) this.resourceUrl = new URL(location, endpoint).toString();
    return this.pc;
  }

  async stop() {
    if (this.resourceUrl) {
      await fetch(this.resourceUrl, { method: 'DELETE' }).catch(() => {});
    }
    this.pc?.getSenders().forEach(sender => sender.track?.stop?.());
    this.pc?.close();
    this.pc = null;
    this.resourceUrl = null;
  }

  #waitForIceGathering() {
    if (this.pc.iceGatheringState === 'complete') return Promise.resolve();
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        cleanup();
        reject(new Error('No fue posible completar la conexión de red.'));
      }, 10000);
      const onChange = () => {
        if (this.pc.iceGatheringState === 'complete') {
          cleanup();
          resolve();
        }
      };
      const cleanup = () => {
        clearTimeout(timeout);
        this.pc?.removeEventListener('icegatheringstatechange', onChange);
      };
      this.pc.addEventListener('icegatheringstatechange', onChange);
    });
  }
}
