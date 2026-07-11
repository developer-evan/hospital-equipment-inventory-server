import * as QRCode from 'qrcode';

/** Encodes the given payload (typically `assetNumber:mongoId`) as a PNG QR code buffer. */
export async function generateQrCodePng(payload: string): Promise<Buffer> {
  return QRCode.toBuffer(payload, { type: 'png', width: 400, margin: 2 });
}
