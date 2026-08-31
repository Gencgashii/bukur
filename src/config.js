export const MEDUSA_URL = process.env.REACT_APP_MEDUSA_URL || 'http://localhost:9000';
export const MEDUSA_PUBLISHABLE_KEY =
  process.env.REACT_APP_MEDUSA_PUBLISHABLE_KEY ||
  'pk_9f814f01f0d29d23cadc137e19b89a0a1f97eceae91382099074319f94df3549';
export const MEDUSA_REGION_ID =
  process.env.REACT_APP_MEDUSA_REGION_ID || 'reg_01KJGNNB7F58NMWSGDHYTHGR0Q';

export const BANK_DETAILS = {
  holder: process.env.REACT_APP_BANK_HOLDER || 'BUKUR',
  iban: process.env.REACT_APP_BANK_IBAN || 'XK00 0000 0000 0000 0000',
  bank: process.env.REACT_APP_BANK_NAME || 'Raiffeisen Bank',
  swift: process.env.REACT_APP_BANK_SWIFT || '',
};
