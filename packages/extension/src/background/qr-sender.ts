export class QrSender {
  private readonly apiUrl = 'https://meu-backend-aios.fly.dev/api/v1';
  private lastError: string | null = null;
  private static readonly AUTH_ERR = 'token_invalido_ou_expirado';

  constructor(private token: string) {}

  setToken(token: string) {
    this.token = token;
  }

  private authHeaders() {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.token}`,
      'X-Device-Token': this.token,
    };
  }

  async send(data: { payload: string; payloadHash: string; sourceUrl: string; isTest?: boolean }): Promise<boolean> {
    try {
      this.lastError = null;
      const res = await fetch(`${this.apiUrl}/qr/ingest`, {
        method: 'POST',
        headers: this.authHeaders(),
        body: JSON.stringify({
          payload: data.payload,
          payloadHash: data.payloadHash,
          sourceUrl: data.sourceUrl,
          capturedAt: new Date().toISOString(),
          isTest: !!data.isTest,
        }),
      });

      if (res.status === 409) {
        console.log('QR Code ignored by backend (global duplicate)');
        return true;
      }

      if (res.status === 401 || res.status === 403) {
        this.lastError = QrSender.AUTH_ERR;
        console.error('Device token invalid or expired');
        return false;
      }

      if (!res.ok) {
        const errorText = await res.text();
        this.lastError = `Failed to send QR Code: ${errorText}`;
        console.error('Failed to send QR Code', errorText);
        return false;
      }

      console.log('QR Code sent successfully');
      return true;
    } catch (err) {
      this.lastError = 'network_error';
      console.error('Network error while sending QR Code', err);
      return false;
    }
  }

  async sendRaw(data: { rawContent: string; rawHash: string; sourceUrl: string; isTest?: boolean }): Promise<boolean> {
    try {
      this.lastError = null;
      const res = await fetch(`${this.apiUrl}/qr/raw-capture`, {
        method: 'POST',
        headers: this.authHeaders(),
        body: JSON.stringify({
          rawContent: data.rawContent,
          rawHash: data.rawHash,
          sourceUrl: data.sourceUrl,
          capturedAt: new Date().toISOString(),
          isTest: !!data.isTest,
        }),
      });

      if (res.status === 409) {
        console.log('Raw capture ignored by backend (global duplicate)');
        return true;
      }

      if (res.status === 401 || res.status === 403) {
        this.lastError = QrSender.AUTH_ERR;
        console.error('Device token invalid or expired');
        return false;
      }

      if (!res.ok) {
        const errorText = await res.text();
        this.lastError = `Failed to send raw capture: ${errorText}`;
        console.error('Failed to send raw capture', errorText);
        return false;
      }

      console.log('Raw capture sent successfully');
      return true;
    } catch (err) {
      this.lastError = 'network_error';
      console.error('Network error while sending raw capture', err);
      return false;
    }
  }

  async heartbeat(deviceId: string, status: 'ONLINE' | 'OFFLINE' | 'ERROR') {
    try {
      await fetch(`${this.apiUrl}/extension/heartbeat`, {
        method: 'POST',
        headers: this.authHeaders(),
        body: JSON.stringify({ deviceId, status, error: this.lastError ?? undefined }),
      });
    } catch {
      // Ignore heartbeat errors
    }
  }

  getLastError() {
    return this.lastError;
  }
}

