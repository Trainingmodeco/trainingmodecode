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
//
// The small square shows the fighter's face: the picture is drawn bigger
// than the square and moved so the face (FACE, where it sits in the art, in
// % of its width and height) is in the middle.
const FACE = { male: [48, 20], female: [43, 23] };
const BOX = 26;
const ART_W = 62;
const ART_H = (ART_W * 5) / 3;

export default function ReviveLine({ sex, style }) {
  const [art, setArt] = useState('pending');
  const [fx, fy] = FACE[String(sex || '').toLowerCase() === 'female' ? 'female' : 'male'];
  return (
    <div data-retention="revive" className="rt-anim" style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8, animation: 'rt-rise .45s .3s both', ...style }}>
      <style dangerouslySetInnerHTML={{ __html: RETENTION_CSS }}/>
      {art !== 'missing' && (
        <span style={{
          display: art === 'ok' ? 'block' : 'none', position: 'relative', width: BOX, height: BOX, borderRadius: 6, overflow: 'hidden',
          border: '1px solid rgba(253,224,71,0.45)', boxShadow: '0 0 8px rgba(168,85,247,0.45)', flexShrink: 0, background: '#0c0218',
        }}>
          <SafeImage
            src={retentionArt('revive', sex)} alt="" loading="eager" preferWebp={false}
            onLoaded={() => setArt('ok')} onFail={() => setArt('missing')}
            style={{ position: 'absolute', width: ART_W, height: ART_H, maxWidth: 'none', left: BOX / 2 - (ART_W * fx) / 100, top: BOX / 2 - (ART_H * fy) / 100 }}
          />
        </span>
      )}
      {art !== 'ok' && <Zap size={12} color="#fde047" fill="#fde047" strokeWidth={0} style={{ flexShrink: 0 }}/>}
      <span style={{ font: "800 8.5px 'Orbitron',sans-serif", letterSpacing: '0.08em', color: '#fde047', lineHeight: 1.3 }}>{REVIVE_LINE}</span>
    </div>
  );
}
