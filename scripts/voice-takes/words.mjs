// Numbers and phrases as the words the generator is prompted with.
const ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
export function num(n) {
  n = Number(n);
  if (n < 20) return ONES[n];
  if (n < 100) return TENS[Math.floor(n / 10)] + (n % 10 ? '-' + ONES[n % 10] : '');
  if (n < 1000) return ONES[Math.floor(n / 100)] + ' hundred' + (n % 100 ? ' ' + num(n % 100) : '');
  return num(Math.floor(n / 1000)) + ' thousand' + (n % 1000 ? ' ' + num(n % 1000) : '');
}
// A bank key's phrase text -> prompt words: digits spelled, the app's short forms said in full.
export function say(text) {
  return String(text)
    .replace(/\bgps\b/g, 'GPS').replace(/\bx p\b/g, 'X P').replace(/\bmph\b/g, 'miles per hour').replace(/\bkph\b/g, 'kilometers per hour')
    .replace(/\bhiit\b/g, 'HIIT')
    .replace(/\d+/g, (d) => num(d));
}
// parts: [{ key (bank key with its mark, or null for filler), text (phrase text), sep (',' ':' '.' '!') }] -> prompt
export function promptOf(parts) {
  let out = '', capNext = true;
  for (const p of parts) {
    let t = say(p.text); if (capNext) t = t.charAt(0).toUpperCase() + t.slice(1);
    out += (out ? ' ' : '') + t + p.sep; capNext = p.sep === '.' || p.sep === '!';
  }
  return out;
}
