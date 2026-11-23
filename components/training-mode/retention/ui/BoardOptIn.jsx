import { useState } from 'react';
import { ARC } from './tokens';

// The first time a finished session could go on a world board: one short ask,
// before the board. Nobody is listed by surprise. Props only:
//
//   name:     the display name to start from (the profile's name, or empty)
//   country:  the two-letter code the phone reports (shown only if switched on)
//   onJoin({ name, showCountry }) / onLater: JOIN / NOT NOW
//
// Others see the display name (up to 12 letters, numbers, spaces, dots,
// dashes or underscores, checked by the server's name filter) and the level.
// The country is the one place shown, two letters, and only once the athlete
// turns it on: the body says so, so the switch never contradicts it.
export default function BoardOptIn({ name: name0 = '', country = 'US', onJoin, onLater }) {
  const [name, setName] = useState(name0);
  const [showCountry, setShowCountry] = useState(false);
  const label = { font: `700 8px ${ARC.head}`, color: '#b06aff', letterSpacing: '0.16em' };
  const text = { font: `600 14px ${ARC.body}`, color: '#e9e3f7', lineHeight: 1.4, margin: 0 };
  return (
    <div data-retention="board-optin" className="rt-anim" style={{
      background: 'rgba(8,2,18,0.92)', border: '1px solid rgba(253,224,71,0.35)', borderRadius: 14, padding: '14px 14px 14px',
      display: 'flex', flexDirection: 'column', gap: 12, animation: 'rt-sheet .4s both',
    }}>
      <div>
        <div style={label}>WORLD BOARD</div>
        <h2 style={{ margin: '4px 0 6px', font: `900 17px ${ARC.head}`, color: ARC.gold, letterSpacing: '0.04em', lineHeight: 1.25 }}>Put your best scores on the world board?</h2>
        <p style={text}>Each mode keeps your best score on a world list, so you can see where you rank. Others see your display name and level. Never your email or photo. Your country only if you turn it on below.</p>
      </div>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={label}>DISPLAY NAME</span>
        <input
          type="text" value={name} maxLength={12} onChange={(e) => setName(e.target.value.replace(/[^A-Za-z0-9 ._-]/g, ''))}
          placeholder="Up to 12 letters" aria-describedby="sb-name-note"
          style={{
            height: 44, boxSizing: 'border-box', width: '100%', borderRadius: 10, border: '1px solid rgba(176,106,255,0.5)',
            background: 'rgba(176,106,255,0.08)', color: '#fff', padding: '0 12px', font: `700 16px ${ARC.body}`, outline: 'none',
          }}
        />
        <span id="sb-name-note" style={{ font: `600 12px ${ARC.body}`, color: '#a9a3c4' }}>Everyone sees it. Up to 12 letters or numbers.</span>
      </label>
      <button type="button" role="switch" aria-checked={showCountry} onClick={() => setShowCountry((v) => !v)} style={{
        display: 'flex', alignItems: 'center', gap: 12, minHeight: 44, padding: '0 12px', borderRadius: 10, cursor: 'pointer', textAlign: 'left',
        background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', color: '#e9e3f7',
      }}>
        <span style={{ flex: 1, font: `700 14px ${ARC.body}`, lineHeight: 1.25, textWrap: 'balance' }}>Show my country ({country}) next to my name</span>
        <span aria-hidden style={{ width: 42, height: 24, borderRadius: 12, flexShrink: 0, position: 'relative', background: showCountry ? ARC.gold : 'rgba(255,255,255,0.15)', transition: 'background .15s' }}>
          <span style={{ position: 'absolute', top: 3, left: showCountry ? 21 : 3, width: 18, height: 18, borderRadius: 9, background: showCountry ? '#140a00' : '#cbc6e0', transition: 'left .15s' }}/>
        </span>
      </button>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <button type="button" className="rt-go" onClick={onLater} style={{
          height: 46, borderRadius: 11, cursor: 'pointer', background: 'transparent', border: '1px solid rgba(255,255,255,0.18)',
          color: '#cbc6e0', font: `800 12px ${ARC.head}`, letterSpacing: '0.08em',
        }}>NOT NOW</button>
        <button type="button" className="rt-go" onClick={() => onJoin?.({ name: name.trim(), showCountry })} disabled={!name.trim()} style={{
          height: 46, borderRadius: 11, cursor: name.trim() ? 'pointer' : 'default', border: 'none', opacity: name.trim() ? 1 : 0.5,
          background: 'linear-gradient(135deg,#fde047,#f59e0b)', color: '#0a0014', font: `900 13px ${ARC.head}`, letterSpacing: '0.1em',
        }}>JOIN</button>
      </div>
      <p style={{ ...text, font: `600 12px ${ARC.body}`, color: '#a9a3c4', textAlign: 'center' }}>Leave any time in Profile. Your scores come off with you.</p>
    </div>
  );
}
