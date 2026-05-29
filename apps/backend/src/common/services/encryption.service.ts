import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;

@Injectable()
export class EncryptionService {
  private readonly logger = new Logger(EncryptionService.name);
  private readonly masterKey: Buffer;

  constructor(private readonly config: ConfigService) {
    const hex = config.get<string>('ENCRYPTION_KEY');
    if (hex) {
      this.masterKey = Buffer.from(hex, 'hex');
      if (this.masterKey.length !== KEY_LENGTH) {
        throw new Error(`ENCRYPTION_KEY must be ${KEY_LENGTH} hex bytes (got ${this.masterKey.length})`);
      }
    } else {
      this.masterKey = crypto.randomBytes(KEY_LENGTH);
      this.logger.warn('No ENCRYPTION_KEY set. Generated ephemeral key. '
        + 'Set ENCRYPTION_KEY in .env for persistence across restarts.');
    }
  }

  encrypt(plaintext: string): string {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, this.masterKey, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    const combined = Buffer.concat([iv, tag, encrypted]);
    return combined.toString('base64');
  }

  decrypt(ciphertext: string): string {
    const combined = Buffer.from(ciphertext, 'base64');
    const iv = combined.subarray(0, IV_LENGTH);
    const tag = combined.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
    const encrypted = combined.subarray(IV_LENGTH + TAG_LENGTH);
    const decipher = crypto.createDecipheriv(ALGORITHM, this.masterKey, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return decrypted.toString('utf8');
  }

  encryptObject<T extends Record<string, unknown>>(obj: T): Record<string, string> {
    const result: Record<string, string> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = this.encrypt(String(value));
    }
    return result;
  }

  decryptObject<T>(encrypted: Record<string, any>): T {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(encrypted || {})) {
      if (typeof value === 'string' && value.length > 0) {
        try {
          result[key] = this.decrypt(value);
        } catch {
          result[key] = value;
        }
      } else {
        result[key] = value;
      }
    }
    return result as T;
  }
}
