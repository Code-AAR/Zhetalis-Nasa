// Device class is independent of the chosen UI layout. Resizing a desktop is not a phone.
export function detectPhone({ mobile, ua = '', coarse = false, touchPoints = 0, width = 0, height = 0 } = {}) {
  if (/iPad|Tablet|Silk|Windows NT|Macintosh|X11|CrOS/i.test(ua)) return false;
  if (/Android/i.test(ua) && !/Mobile/i.test(ua)) return false;
  if (mobile === true || /iPhone|iPod|Android.*Mobile/i.test(ua)) return true;
  if (mobile === false) return false;
  return coarse && touchPoints > 0 && Math.min(width, height) > 0 && Math.min(width, height) <= 600;
}
export function isPhone() {
  return detectPhone({ mobile: navigator.userAgentData?.mobile, ua: navigator.userAgent, coarse: matchMedia('(pointer: coarse)').matches, touchPoints: navigator.maxTouchPoints, width: screen.width, height: screen.height });
}
export function effectiveQuality(requested, phone = isPhone()) {
  if (requested === 'high') return requested;
  return phone ? 'low' : 'high'; // Auto and Lite: only phones are automatically reduced.
}
