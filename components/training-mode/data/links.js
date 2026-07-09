export const PUBLIC_SITE_URL = process.env.EXPO_PUBLIC_APP_URL || 'https://trainingmode.co';
export const BETA_APP_URL = PUBLIC_SITE_URL;
export const WAITLIST_FORM_URL = 'https://docs.google.com/forms/d/e/1FAIpQLSfcnxvfMVlaPoUQZJ3MkRA-Fgo_6QQIzNC40CLPOTckMuZUsQ/viewform?usp=header';
export const BETA_FEEDBACK_FORM_URL = 'https://docs.google.com/forms/d/e/1FAIpQLSfS54mSuzUJPFGbCDj6zfYHWVTKv1-NVI90Nl-I-BGOmq2lNg/viewform?usp=header';

export function openExternalUrl(url) {
  if (typeof url !== 'string' || !url.startsWith('https://')) {
    showLinkError();
    return false;
  }
  try {
    if (typeof window !== 'undefined') {
      window.open(url, '_blank', 'noopener,noreferrer');
      return true;
    }
  } catch (_e) { /* fall through */ }
  showLinkError();
  return false;
}

function showLinkError() {
  if (typeof document === 'undefined') return;
  const existing = document.getElementById('tm-link-error-toast');
  if (existing) existing.remove();
  const toast = document.createElement('div');
  toast.id = 'tm-link-error-toast';
  toast.textContent = 'This link could not open. Please visit trainingmode.co directly.';
  Object.assign(toast.style, {
    position: 'fixed', bottom: '100px', left: '50%', transform: 'translateX(-50%)',
    padding: '10px 20px', borderRadius: '10px', zIndex: '9999',
    background: 'rgba(12,2,24,0.95)', border: '1px solid rgba(239,68,68,0.5)',
    color: '#ef4444', fontFamily: "'Rajdhani', sans-serif", fontWeight: '600',
    fontSize: '12px', maxWidth: '85vw', textAlign: 'center',
  });
  document.body.appendChild(toast);
  setTimeout(() => { toast.style.opacity = '0'; toast.style.transition = 'opacity 0.3s'; }, 3000);
  setTimeout(() => toast.remove(), 3400);
}
