import sharp from 'sharp';
import crypto from 'crypto';

export class SteganographyService {
  /**
   * Encode a message into an image using LSB steganography
   */
  static async encodeMessage(
    imageBuffer: Buffer,
    message: string,
    encryptionKey?: string
  ): Promise<Buffer> {
    try {
      // Encrypt message if key provided
      let processedMessage = message;
      if (encryptionKey) {
        processedMessage = this.encryptMessage(message, encryptionKey);
      }

      // Add delimiter to mark end of message
      const messageWithDelimiter = processedMessage + '\0';
      const messageBytes = Buffer.from(messageWithDelimiter, 'utf8');

      // Get image data
      const { data, info } = await sharp(imageBuffer)
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });

      // Check if image can hold the message
      const maxCapacity = Math.floor((data.length / 4) * 3); // 3 bits per pixel (RGB only)
      const requiredBits = messageBytes.length * 8;

      if (requiredBits > maxCapacity) {
        throw new Error(`Message too large. Max capacity: ${Math.floor(maxCapacity / 8)} bytes, required: ${messageBytes.length} bytes`);
      }

      // Create a copy of the image data
      const modifiedData = Buffer.from(data);

      // Encode message bits into LSBs
      let bitIndex = 0;
      for (let byteIndex = 0; byteIndex < messageBytes.length; byteIndex++) {
        const byte = messageBytes[byteIndex];
        
        for (let bit = 0; bit < 8; bit++) {
          const messageBit = (byte >> (7 - bit)) & 1;
          const pixelIndex = Math.floor(bitIndex / 3) * 4 + (bitIndex % 3); // Skip alpha channel
          
          // Clear LSB and set message bit
          modifiedData[pixelIndex] = (modifiedData[pixelIndex] & 0xFE) | messageBit;
          bitIndex++;
        }
      }

      // Convert back to PNG
      const result = await sharp(modifiedData, {
        raw: {
          width: info.width,
          height: info.height,
          channels: 4
        }
      })
      .png()
      .toBuffer();

      return result;
    } catch (error) {
      throw new Error(`Encoding failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Decode a message from an image using LSB steganography
   */
  static async decodeMessage(
    imageBuffer: Buffer,
    decryptionKey?: string
  ): Promise<string> {
    try {
      // Get image data
      const { data, info } = await sharp(imageBuffer)
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });

      // Extract message bits from LSBs
      const messageBytes: number[] = [];
      let currentByte = 0;
      let bitCount = 0;
      let byteIndex = 0;

      for (let pixelIndex = 0; pixelIndex < data.length; pixelIndex += 4) {
        // Process RGB channels (skip alpha)
        for (let channel = 0; channel < 3; channel++) {
          const lsb = data[pixelIndex + channel] & 1;
          currentByte = (currentByte << 1) | lsb;
          bitCount++;

          if (bitCount === 8) {
            messageBytes[byteIndex] = currentByte;
            byteIndex++;
            currentByte = 0;
            bitCount = 0;

            // Check for null terminator
            if (messageBytes[byteIndex - 1] === 0) {
              // Found end of message
              const messageBuffer = Buffer.from(messageBytes.slice(0, -1));
              let decodedMessage = messageBuffer.toString('utf8');

              // Decrypt if key provided
              if (decryptionKey) {
                decodedMessage = this.decryptMessage(decodedMessage, decryptionKey);
              }

              return decodedMessage;
            }
          }
        }
      }

      throw new Error('No message found or message delimiter not detected');
    } catch (error) {
      throw new Error(`Decoding failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Encrypt a message using AES
   */
  private static encryptMessage(message: string, key: string): string {
    const algorithm = 'aes-256-cbc';
    const keyHash = crypto.createHash('sha256').update(key).digest();
    const iv = crypto.randomBytes(16);
    
    const cipher = crypto.createCipher(algorithm, keyHash);
    let encrypted = cipher.update(message, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    return iv.toString('hex') + ':' + encrypted;
  }

  /**
   * Decrypt a message using AES
   */
  private static decryptMessage(encryptedMessage: string, key: string): string {
    const algorithm = 'aes-256-cbc';
    const keyHash = crypto.createHash('sha256').update(key).digest();
    
    const [ivHex, encrypted] = encryptedMessage.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    
    const decipher = crypto.createDecipher(algorithm, keyHash);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  /**
   * Calculate maximum message capacity for an image
   */
  static async calculateCapacity(imageBuffer: Buffer): Promise<number> {
    const { info } = await sharp(imageBuffer).toBuffer({ resolveWithObject: true });
    const totalPixels = info.width * info.height;
    const maxBits = totalPixels * 3; // 3 bits per pixel (RGB)
    return Math.floor(maxBits / 8); // Convert to bytes
  }
}
