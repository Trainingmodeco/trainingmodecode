import { useEffect, useState } from 'react';
import { C } from '../Styles';
import { getStorageHealth, subscribeStorageHealth, storageNotice, noticeDismissed, dismissNotice } from '../data/storageHealth';

// Says so when this phone will not keep the athlete's progress (see data/storageHealth): storage that
// refuses writes, storage that was wiped since onboarding, or an in-app browser (Instagram, TikTok...)
// that tends to forget. A failure to save is never dismissible; the other two are, and stay dismissed.
export default function StorageNotice() {
  const [health, setHealth] = useState(getStorageHealth());
  const [, bump] = useState(0);
  useEffect(() => subscribeStorageHealth(setHealth), []);
  const notice = storageNotice(health);
  if (!notice || noticeDismissed(notice.kind)) return null;
  const hard = notice.kind === 'cannot-save';
  return (
    <div
      role="alert"
      data-testid="storage-notice"
      data-kind={notice.kind}
      style={{
        position: 'fixed', left: 8, right: 8, top: 'calc(env(safe-area-inset-top, 0px) + 8px)', zIndex: 1400,
        background: 'rgba(24,0,48,0.97)', border: `2px solid ${hard ? C.red : C.gold}`, borderRadius: 12,
        padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 10, boxShadow: '0 6px 24px rgba(0,0,0,0.55)',
        fontFamily: "'Rajdhani', sans-serif", fontSize: 15, fontWeight: 600, lineHeight: 1.25, color: C.text,
      }}
    >
      <span style={{ flex: 1 }}>{notice.text}</span>
      {!hard && (
        <button
          type="button"
          onClick={() => { dismissNotice(notice.kind); bump((n) => n + 1); }}
          style={{
            flexShrink: 0, minWidth: 64, minHeight: 44, borderRadius: 10, border: `1px solid ${C.gold}`, background: 'transparent',
            color: C.gold, fontFamily: "'Orbitron', sans-serif", fontSize: 12, fontWeight: 900, letterSpacing: 1, cursor: 'pointer',
          }}
        >
          GOT IT
        </button>
      )}
    </div>
  );
}
