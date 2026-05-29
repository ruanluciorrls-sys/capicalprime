export class DeviceRegistry {
  private readonly storageKey = 'aios_device';

  async getDeviceId(): Promise<string> {
    const data = await chrome.storage.local.get(this.storageKey);
    if (data[this.storageKey]?.deviceId) {
      return data[this.storageKey].deviceId;
    }

    const deviceId = crypto.randomUUID();
    await chrome.storage.local.set({
      [this.storageKey]: { deviceId, token: null }
    });
    return deviceId;
  }

  async getToken(): Promise<string | null> {
    const data = await chrome.storage.local.get(this.storageKey);
    return data[this.storageKey]?.token || null;
  }

  async setToken(token: string): Promise<void> {
    const deviceId = await this.getDeviceId();
    await chrome.storage.local.set({
      [this.storageKey]: { deviceId, token }
    });
  }

  async clearToken(): Promise<void> {
    const deviceId = await this.getDeviceId();
    await chrome.storage.local.set({
      [this.storageKey]: { deviceId, token: null }
    });
  }
}
