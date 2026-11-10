export class IdempotencyIntent {
  private fingerprint = '';

  private key = '';

  keyFor(payload: unknown): string {
    const fingerprint = JSON.stringify(payload);
    if (fingerprint !== this.fingerprint || !this.key) {
      this.fingerprint = fingerprint;
      this.key = crypto.randomUUID();
    }
    return this.key;
  }

  reset(): void {
    this.fingerprint = '';
    this.key = '';
  }
}
