import { Share2, MessageCircle, Mail, Link, Download, X } from 'lucide-react';
import { C } from './Styles';
import { showShareToast } from './data/shareUtils';
import { PUBLIC_SITE_URL } from './data/links';

function captureCard(cardRef) {
  if (!cardRef?.current) return Promise.resolve(null);
  return import('html2canvas').then(({ default: html2canvas }) =>
    html2canvas(cardRef.current, {
      backgroundColor: '#0a0014',
      useCORS: true,
      scale: 2,
    })
  );
}

function buildCaption({ workoutName, modeName, xpEarned, streakDays, shareLink }) {
  const name = workoutName || 'Training Mode Workout';
  const mode = modeName || 'Training Mode';
  const xp = xpEarned || 0;
  const streak = streakDays || 1;
  const link = shareLink || PUBLIC_SITE_URL;

  return [
    'Share your workout.',
    '',
    `I just completed a Training Mode workout:`,
    name,
    '',
    `Mode: ${mode}`,
    `XP earned: +${xp}`,
    `Streak: ${streak} ${streak === 1 ? 'day' : 'days'}`,
    '',
    'Session done. Momentum gained.',
    '',
    `Start your training arc at:`,
    link,
    '',
    '#TrainingMode #FightFit #CombatComplete #FitnessJourney',
  ].join('\n');
}

function copyToClipboard(text) {
  if (typeof navigator !== 'undefined' && navigator.clipboard) {
    return navigator.clipboard.writeText(text).catch(() => fallbackCopy(text));
  }
  fallbackCopy(text);
  return Promise.resolve();
}

function fallbackCopy(text) {
  if (typeof document === 'undefined') return;
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  document.execCommand('copy');
  document.body.removeChild(ta);
}

function ActionButton({ icon, label, onClick, primary }) {
  return (
    <button onClick={onClick} style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
      background: primary
        ? `linear-gradient(135deg, ${C.yellow}, ${C.gold})`
        : 'rgba(12,2,24,0.85)',
      border: primary ? 'none' : '1px solid rgba(253,224,71,0.15)',
      borderRadius: 10, padding: '10px 8px', minWidth: 56,
      cursor: 'pointer', transition: 'all 0.15s',
      color: primary ? C.bg : C.text,
    }}>
      {icon}
      <span style={{
        fontFamily: "'Orbitron',sans-serif", fontWeight: 700, fontSize: 7,
        letterSpacing: '0.06em', color: primary ? C.bg : C.muted,
      }}>{label}</span>
    </button>
  );
}

export default function ShareActions({ cardRef, shareData, onClose }) {
  const caption = buildCaption(shareData);
  const link = shareData.shareLink || 'https://trainingmode.co';

  const handleShare = async () => {
    try {
      const canvas = await captureCard(cardRef);
      if (canvas && typeof navigator !== 'undefined' && navigator.share && navigator.canShare) {
        canvas.toBlob(async (blob) => {
          if (!blob) { fallbackShareText(); return; }
          const file = new File([blob], 'training-mode-workout-share.png', { type: 'image/png' });
          const data = { files: [file], text: caption };
          if (navigator.canShare(data)) {
            await navigator.share(data);
          } else {
            await navigator.share({ text: caption });
          }
        }, 'image/png');
      } else if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share({ text: caption });
      } else {
        fallbackShareText();
      }
    } catch (_e) {
      fallbackShareText();
    }
  };

  const fallbackShareText = async () => {
    await copyToClipboard(caption);
    showShareToast('Image saved. Caption copied.');
  };

  const handleText = () => {
    const body = encodeURIComponent(caption);
    if (typeof window !== 'undefined') {
      window.open(`sms:?body=${body}`, '_self');
    }
    setTimeout(() => {
      copyToClipboard(caption);
      showShareToast('Workout share text copied.');
    }, 500);
  };

  const handleEmail = () => {
    const subject = encodeURIComponent('I completed a Training Mode workout');
    const body = encodeURIComponent(caption);
    if (typeof window !== 'undefined') {
      window.open(`mailto:?subject=${subject}&body=${body}`, '_self');
    }
    setTimeout(() => {
      copyToClipboard(caption);
      showShareToast('Workout share email copied.');
    }, 500);
  };

  const handleCopyLink = async () => {
    await copyToClipboard(link);
    showShareToast('Training Mode link copied.');
  };

  const handleSaveImage = async () => {
    try {
      const canvas = await captureCard(cardRef);
      if (!canvas) { showShareToast('Image could not be generated.'); return; }
      const dataUrl = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = 'training-mode-workout-share.png';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      showShareToast('Share image saved.');
    } catch (_e) {
      showShareToast('Image could not be saved.');
    }
  };

  return (
    <div style={{
      display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center',
      marginTop: 14, padding: '0 8px',
    }}>
      <ActionButton icon={<Share2 size={16}/>} label="SHARE" onClick={handleShare} primary/>
      <ActionButton icon={<MessageCircle size={16}/>} label="TEXT" onClick={handleText}/>
      <ActionButton icon={<Mail size={16}/>} label="EMAIL" onClick={handleEmail}/>
      <ActionButton icon={<Link size={16}/>} label="COPY LINK" onClick={handleCopyLink}/>
      <ActionButton icon={<Download size={16}/>} label="SAVE IMG" onClick={handleSaveImage}/>
      <ActionButton icon={<X size={16}/>} label="CLOSE" onClick={onClose}/>
    </div>
  );
}
