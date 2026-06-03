export function isWhatsAppPhone(value?: string) {
  return !!value && value.trim().startsWith("+");
}
