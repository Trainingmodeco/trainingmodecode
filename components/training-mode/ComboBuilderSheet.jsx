import { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Trash2, Plus } from 'lucide-react';
import { C } from './Styles';
import { getBuilderPalette, loadCombos, saveCombo, deleteCombo, comboText } from './data/customCombos';

// 1.3b — build a combo from strikes, name it, save it. Portal modal so it
// floats over the Combo Coach setup without disturbing its layout.
const VIOLET = '#a855f7';
const GOLD = C.gold;

const sheetCSS = `
@keyframes cb-in { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
.cb-strike:active { transform: scale(0.95); }
`;

export default function ComboBuilderSheet({ discipline, beginner, onClose, onChange }) {
  const palette = getBuilderPalette(discipline, beginner);
  const [seq, setSeq] = useState([]);
  const [name, setName] = useState('');
  const [saved, setSaved] = useState(() => loadCombos(discipline));

  const add = (tok) => setSeq(s => [...s, tok]);
  const removeAt = (i) => setSeq(s => s.filter((_, idx) => idx !== i));
  const clear = () => setSeq([]);

  const commit = () => {
    if (seq.length === 0) return;
    const combo = saveCombo(discipline, { name, strikes: seq });
    if (combo) {
      setSaved(loadCombos(discipline));
      setSeq([]);
      setName('');
      onChange?.();
    }
  };

  const remove = (id) => {
    deleteCombo(discipline, id);
    setSaved(loadCombos(discipline));
    onChange?.();
  };

  return createPortal(
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 400, display: 'flex',
      alignItems: 'center', justifyContent: 'center', padding: 16,
      background: 'rgba(4,0,10,0.82)', backdropFilter: 'blur(4px)',
    }}>
      <style dangerouslySetInnerHTML={{ __html: sheetCSS }}/>
      <div onClick={e => e.stopPropagation()} className="no-scrollbar" style={{
        width: '100%', maxWidth: 340, maxHeight: '92dvh', overflowY: 'auto',
        background: 'linear-gradient(180deg,#160a28,#0a0106)',
        borderRadius: 18, border: `1px solid ${VIOLET}66`,
        boxShadow: '0 0 40px rgba(168,85,247,0.28), 0 20px 50px rgba(0,0,0,0.6)',
        padding: '14px 14px 16px', animation: 'cb-in 0.24s ease both',
      }}>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <div style={{ font: "900 13px 'Orbitron',sans-serif", color: VIOLET, letterSpacing: '0.08em' }}>BUILD A COMBO</div>
          <button onClick={onClose} aria-label="Close" style={{ background: 'transparent', border: 'none', color: C.muted, cursor: 'pointer', padding: 4 }}>
            <X size={18}/>
          </button>
        </div>
        <div style={{ font: "600 10px 'Rajdhani',sans-serif", color: '#a99cc4', marginBottom: 10 }}>
          Tap strikes to chain them. Save it, then drill it in Combo Coach.
        </div>

        {/* Sequence being built */}
        <div style={{
          minHeight: 52, borderRadius: 11, padding: '9px 10px', marginBottom: 8,
          background: 'rgba(8,2,18,0.7)', border: `1px dashed ${VIOLET}55`,
          display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center',
        }}>
          {seq.length === 0 ? (
            <span style={{ font: "600 11px 'Rajdhani',sans-serif", color: '#6f6590' }}>Your combo appears here…</span>
          ) : seq.map((tok, i) => (
            <button key={i} onClick={() => removeAt(i)} style={{
              display: 'flex', alignItems: 'center', gap: 5, padding: '5px 9px', borderRadius: 8,
              background: 'rgba(168,85,247,0.18)', border: `1px solid ${VIOLET}77`,
              color: '#eadcff', font: "800 10px 'Orbitron',sans-serif", letterSpacing: '0.02em', cursor: 'pointer',
            }}>
              <span style={{ color: GOLD }}>{i + 1}</span> {tok.toUpperCase()} <X size={11}/>
            </button>
          ))}
        </div>

        {/* Palette */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
          {palette.map(tok => (
            <button key={tok} className="cb-strike" onClick={() => add(tok)} style={{
              padding: '7px 10px', borderRadius: 8, cursor: 'pointer', transition: 'transform 0.12s',
              background: 'rgba(16,4,30,0.85)', border: '1px solid rgba(168,85,247,0.35)',
              color: '#d9d1ef', font: "800 10px 'Orbitron',sans-serif", letterSpacing: '0.02em',
            }}>{tok.toUpperCase()}</button>
          ))}
        </div>

        {/* Name + save */}
        <div style={{ display: 'flex', gap: 7, marginBottom: seq.length ? 6 : 14 }}>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            maxLength={22}
            placeholder="Name (optional)"
            style={{
              flex: 1, minWidth: 0, padding: '10px 11px', borderRadius: 10, outline: 'none',
              background: 'rgba(8,2,18,0.8)', border: '1px solid rgba(168,85,247,0.3)',
              color: '#fff', font: "700 11px 'Rajdhani',sans-serif", caretColor: VIOLET,
            }}
          />
          <button onClick={commit} disabled={seq.length === 0} style={{
            padding: '0 16px', borderRadius: 10, border: 'none',
            background: seq.length ? `linear-gradient(135deg,${VIOLET},#7c3aed)` : 'rgba(168,85,247,0.2)',
            color: seq.length ? '#fff' : '#8b83a8', font: "900 11px 'Orbitron',sans-serif", letterSpacing: '0.06em',
            cursor: seq.length ? 'pointer' : 'default',
          }}>SAVE</button>
        </div>
        {seq.length > 0 && (
          <button onClick={clear} style={{
            display: 'block', margin: '0 0 12px', background: 'none', border: 'none', cursor: 'pointer',
            color: '#9a90b8', font: "700 9px 'Orbitron',sans-serif", letterSpacing: '0.06em',
          }}>CLEAR</button>
        )}

        {/* Saved combos */}
        {saved.length > 0 && (
          <div>
            <div style={{ font: "700 8px 'Orbitron',sans-serif", color: '#c4a4d8', letterSpacing: '0.16em', marginBottom: 7 }}>
              SAVED ({saved.length})
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {saved.map(combo => (
                <div key={combo.id} style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 10,
                  background: 'rgba(8,2,18,0.7)', border: '1px solid rgba(168,85,247,0.22)',
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ font: "800 10px 'Orbitron',sans-serif", color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{combo.name}</div>
                    <div style={{ font: "600 9.5px 'Rajdhani',sans-serif", color: '#a99cc4', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{comboText(combo)}</div>
                  </div>
                  <button onClick={() => remove(combo.id)} aria-label="Delete combo" style={{
                    background: 'none', border: 'none', color: '#9a6a8a', cursor: 'pointer', padding: 4, flexShrink: 0,
                  }}><Trash2 size={14}/></button>
                </div>
              ))}
            </div>
          </div>
        )}

        <button onClick={onClose} style={{
          width: '100%', marginTop: 14, padding: '11px 0', borderRadius: 11,
          background: 'rgba(168,85,247,0.12)', border: `1px solid ${VIOLET}55`,
          color: '#d9d1ef', font: "800 11px 'Orbitron',sans-serif", letterSpacing: '0.08em', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        }}><Plus size={13} style={{ transform: 'rotate(45deg)' }}/> DONE</button>
      </div>
    </div>,
    document.body
  );
}
