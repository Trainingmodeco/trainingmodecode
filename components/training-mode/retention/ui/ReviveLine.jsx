import { useState } from 'react';
import { Zap } from 'lucide-react';
import SafeImage from '../../SafeImage';
import { REVIVE_LINE } from '../../data/power';
import { RETENTION_CSS } from './tokens';
import { retentionArt } from './RustyLook';

// REVIVED (retention, switch `power`): the one calm line on the end screen's
// YOUR PROGRESS card for the first valid finished session after the fighter
// was low or RUSTY, once per revive. The owner's revive art (the fighter
// wiping the dust off) sits beside it, small, when the file exists; until
// then a bolt. Nothing here speaks.
export default function ReviveLine({ sex, style }) {
  const [art, setArt] = useState('pending');
  return (
    <div data-retention="revive" className="rt-anim" style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8, animation: 'rt-rise .45s .3s both', ...style }}>
      <style dangerouslySetInnerHTML={{ __html: RETENTION_CSS }}/>
      {art !== 'missing' && (
        <SafeImage
          src={retentionArt('revive', sex)} alt="" loading="eager" preferWebp={false}
          onLoaded={() => setArt('ok')} onFail={() => setArt('missing')}
          style={{ display: art === 'ok' ? 'block' : 'none', width: 22, height: 22, borderRadius: 6, objectFit: 'cover', objectPosition: '50% 14%', border: '1px solid rgba(253,224,71,0.45)', flexShrink: 0 }}
        />
      )}
      {art !== 'ok' && <Zap size={12} color="#fde047" fill="#fde047" strokeWidth={0} style={{ flexShrink: 0 }}/>}
      <span style={{ font: "800 8.5px 'Orbitron',sans-serif", letterSpacing: '0.08em', color: '#fde047', lineHeight: 1.3 }}>{REVIVE_LINE}</span>
    </div>
  );
}
