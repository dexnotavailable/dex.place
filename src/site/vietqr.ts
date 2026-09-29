// VietQR (NAPAS 247) transfer payload for Dex's MB Bank account.
//
// Pure string building, no DOM and no dependencies, so it runs in the browser,
// at build time (to prerender the default QR) and under `node --test`.
//
// The payload is an EMVCo merchant-presented QR string: a run of TLV fields
// (two-digit tag, two-digit length, value) closed by a CRC. Field by field:
//
//   00 "01"          payload format indicator
//   01 "11" | "12"   point of initiation: 11 = static (no amount, reusable),
//                    12 = dynamic (carries an amount)
//   38 ...           merchant account information, VietQR template:
//      00 "A000000727"   NAPAS GUID
//      01 ...            beneficiary: 00 = bank BIN (MB Bank 970422),
//                        01 = account number (kept as a string, leading 0)
//      02 "QRIBFTTA"     service: NAPAS 247 transfer to an account
//   53 "704"         currency, ISO 4217 numeric for VND
//   54 amount        whole VND; only present when the amount is above 0
//   58 "VN"          country
//   62 ...           additional data: 08 = purpose, the transfer note
//   63 CRC           CRC-16/CCITT-FALSE over everything before it,
//                    including "6304", as four uppercase hex digits
//
// For 100,000 and 10,000,000 VND this reproduces legacy vietQrPayload() from
// legacy/site/src/worldsite/sections/Donate.tsx byte for byte; Dex checked the
// 100,000 VND code in his MB Bank app on 2026-09-07. The legacy slider started
// at 100,000 and never made a 0 VND code. Here 0 VND means "no amount": the
// static form (01 = "11", no tag 54), so the banking app asks for the amount.

export interface VietQrAccount {
  /** NAPAS bank identification number (BIN). */
  readonly bin: string;
  /** Account number, as printed by the bank. A string: it can start with 0. */
  readonly account: string;
}

/** Dex's MB Bank account. The bank shows the holder's name itself. */
export const MB_BANK: VietQrAccount & { readonly bank: string; readonly holder: string } = {
  bank: "MB Bank",
  bin: "970422",
  account: "0585739325",
  holder: "THIEU GIA MINH",
};

/** Transfer note carried in tag 62/08. */
export const TRANSFER_NOTE = "dex support";

/** Payload bounds, in whole VND. 0 = no amount (the static code). The /donate/ slider itself runs 100,000..MAX_VND (src/site/donate.ts). */
export const MIN_VND = 0;
export const MAX_VND = 10_000_000;

const NAPAS_GUID = "A000000727";
const SERVICE_TO_ACCOUNT = "QRIBFTTA";
const CURRENCY_VND = "704";
const COUNTRY = "VN";

/** True for a whole number of VND between MIN_VND and MAX_VND inclusive. */
export function isDonationAmount(amount: number): boolean {
  return Number.isSafeInteger(amount) && amount >= MIN_VND && amount <= MAX_VND;
}

/** One EMVCo TLV field: id, two-digit length, value. */
export function tlv(id: string, value: string): string {
  if (!/^\d{2}$/.test(id)) throw new RangeError(`bad EMVCo tag: ${id}`);
  if (value.length > 99) throw new RangeError(`EMVCo field ${id} is longer than 99 characters`);
  return id + String(value.length).padStart(2, "0") + value;
}

/**
 * CRC-16/CCITT-FALSE (poly 0x1021, init 0xFFFF, no reflection, no final XOR)
 * as four uppercase hex digits. ASCII input only, which EMVCo payloads are.
 */
export function crc16(input: string): string {
  let crc = 0xffff;
  for (let i = 0; i < input.length; i += 1) {
    const code = input.charCodeAt(i);
    if (code > 0x7f) throw new RangeError("CRC input must be ASCII");
    crc ^= code << 8;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
    }
    crc &= 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

/**
 * The VietQR payload for a donation of `amount` whole VND to `account`.
 * 0 gives the static, amount-free code.
 */
export function vietQrPayload(amount: number, account: VietQrAccount = MB_BANK, note: string = TRANSFER_NOTE): string {
  if (!isDonationAmount(amount)) {
    throw new RangeError(`amount must be a whole number of VND from ${MIN_VND} to ${MAX_VND}`);
  }
  const beneficiary = tlv("00", account.bin) + tlv("01", account.account);
  const merchant = tlv("00", NAPAS_GUID) + tlv("01", beneficiary) + tlv("02", SERVICE_TO_ACCOUNT);
  const body =
    tlv("00", "01") +
    tlv("01", amount > 0 ? "12" : "11") +
    tlv("38", merchant) +
    tlv("53", CURRENCY_VND) +
    (amount > 0 ? tlv("54", String(amount)) : "") +
    tlv("58", COUNTRY) +
    tlv("62", tlv("08", note)) +
    "6304";
  return body + crc16(body);
}
