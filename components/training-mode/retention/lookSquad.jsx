import { C } from '../Styles';
import { HOME, head, orb, goldText, Look, Feature, Bar, Btn, Sparks, HomeHeader } from './looksKit';
import { WeekChip } from './lookStreak';

// 5 · Squads. 5 to 20 people, one squad at a time, a shared weekly goal and a
// cosmetic chest for everyone who added to it. Preset cheers only, no chat.

const MEMBERS = [
  { name: 'You', rounds: 14, today: 4 }, { name: 'Trainee 03', rounds: 12, today: 6 }, { name: 'Trainee 11', rounds: 10 },
  { name: 'Trainee 07', rounds: 9, today: 3 }, { name: 'Trainee 15', rounds: 8 }, { name: 'Trainee 02', rounds: 6 },
  { name: 'Trainee 09', rounds: 5 }, { name: 'Trainee 21', rounds: 0 },
];
const CHEERS = ['💪 STRONG ROUND', '🔥 ON FIRE', '👊 LET’S GO', '🛡 REST WELL'];

function Chest({ open, size = 56 }) {
  return (
    <span style={{ position: 'relative', display: 'inline-block', width: size, height: size, animation: open ? 'rl-shake .6s .3s 2' : 'none' }}>
      <span style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: size * 0.58, borderRadius: 8, background: 'linear-gradient(180deg,#a8780a,#5a3a00)', border: '2px solid #fde047' }}/>
      <span style={{ position: 'absolute', left: -2, right: -2, top: size * 0.12, height: size * 0.34, borderRadius: '10px 10px 4px 4px', background: 'linear-gradient(180deg,#fde047,#a8780a)', border: '2px solid #fff3b0', animation: open ? 'rl-lid .5s 1.4s both' : 'none', transformOrigin: 'left bottom' }}/>
      <span style={{ position: 'absolute', left: '50%', top: size * 0.42, width: 10, height: 12, marginLeft: -5, borderRadius: 2, background: open ? '#fde047' : '#2a1a00' }}>{!open && <span style={{ fontSize: 8, position: 'absolute', top: -1, left: 1 }}>🔒</span>}</span>
    </span>
  );
}

function SquadScreen() {
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'radial-gradient(ellipse at 50% 0%, rgba(40,20,110,.7), #070010 60%)' }}>
      <div style={{ padding: '16px 16px 6px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ width: 44, height: 44, borderRadius: 12, display: 'grid', placeItems: 'center', background: 'rgba(61,123,255,.25)', border: '1.5px solid rgba(61,123,255,.7)', ...orb(16), color: C.text }}>α</span>
        <div style={{ flex: 1 }}>
          <div style={{ ...orb(16), ...goldText }}>SQUAD ALPHA</div>
          <div style={{ ...head(10, 600), color: HOME.muted }}>8 MEMBERS · CODE 7K2-QX9</div>
        </div>
        <span style={{ color: HOME.muted, fontSize: 20 }}>⋯</span>
      </div>
      <div style={{ margin: '8px 14px', borderRadius: 14, background: HOME.tile, padding: 14, border: '1px solid rgba(253,224,71,.3)', display: 'flex', gap: 12, alignItems: 'center' }}>
        <div style={{ flex: 1 }}>
          <div style={{ ...head(10, 600), color: HOME.muted }}>THIS WEEK&apos;S GOAL · 3 DAYS LEFT</div>
          <div style={{ ...head(22), color: C.text, letterSpacing: 0 }}>64 <span style={{ color: HOME.muted, fontSize: 14 }}>/ 100 ROUNDS</span></div>
          <div style={{ marginTop: 8 }}><Bar value={64} max={100} height={10}/></div>
          <div style={{ fontSize: 12, color: HOME.muted, marginTop: 6 }}>Everyone who adds a round gets the chest.</div>
        </div>
        <Chest/>
      </div>
      <div style={{ ...head(10, 600), color: HOME.muted, padding: '8px 16px 4px' }}>TODAY</div>
      <div style={{ padding: '0 14px', display: 'flex', flexDirection: 'column', gap: 4 }}>
        {MEMBERS.filter((m) => m.today).map((m) => (
          <div key={m.name} style={{ fontSize: 13, color: C.text }}><b style={{ color: m.name === 'You' ? HOME.gold : C.text }}>{m.name}</b> added {m.today} rounds <span style={{ color: HOME.muted }}>· Fight Focus</span></div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 6, padding: '10px 14px', overflowX: 'auto' }}>
        {CHEERS.map((c) => <button key={c} type="button" style={{ ...head(10, 700), whiteSpace: 'nowrap', color: C.text, background: 'rgba(168,85,247,.14)', border: '1px solid rgba(168,85,247,.45)', borderRadius: 999, padding: '8px 10px' }}>{c}</button>)}
      </div>
      <div style={{ ...head(10, 600), color: HOME.muted, padding: '4px 16px 4px' }}>MEMBERS · ROUNDS THIS WEEK</div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 14px 14px' }}>
        {MEMBERS.map((m) => (
          <div key={m.name} style={{ display: 'flex', alignItems: 'center', gap: 10, height: 38, padding: '0 10px', borderRadius: 10, marginBottom: 3, background: m.name === 'You' ? 'rgba(242,190,69,.14)' : HOME.tile }}>
            <span style={{ width: 24, height: 24, borderRadius: 12, background: m.name === 'You' ? HOME.gold : 'rgba(61,123,255,.35)', display: 'grid', placeItems: 'center', ...head(10), color: m.name === 'You' ? '#140a00' : C.text, letterSpacing: 0 }}>{m.name[0]}</span>
            <span style={{ flex: 1, ...head(13, 600), color: m.name === 'You' ? HOME.gold : C.text, letterSpacing: '0.02em' }}>{m.name}</span>
            <span style={{ ...head(12), color: m.rounds ? C.text : HOME.muted, letterSpacing: 0 }}>{m.rounds ? `${m.rounds} rounds` : 'resting'}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Field({ label, value, hint }) {
  return (
    <div>
      <div style={{ ...head(10, 600), color: HOME.muted, marginBottom: 4 }}>{label}</div>
      <div style={{ height: 46, borderRadius: 10, background: HOME.tile, border: '1px solid rgba(255,255,255,.14)', display: 'flex', alignItems: 'center', padding: '0 12px', ...head(15, 600), color: value ? C.text : HOME.muted, letterSpacing: '0.06em' }}>{value || hint}</div>
    </div>
  );
}

export default function LookSquad() {
  return (
    <Feature id="f5" num="FEATURE 5" title="SQUADS"
      reuse="the home tile style, progress bars and gold titles; the challenge-code and share link pattern (ChallengeShareModal, CodeEntryModal)."
      isNew="create or join by code or link, the squad screen with a shared weekly goal, a chest everyone who contributed gets, preset cheers (no chat), and leave, report, block and remove controls.">

      <Look name="Create or join" note="Join by a 6-character code or a shared link. Create sets a name and the weekly goal; size 5 to 20." height={560}>
        <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ ...orb(18), ...goldText, textAlign: 'center' }}>SQUADS</div>
          <div style={{ fontSize: 14, color: C.text, textAlign: 'center' }}>Train with 5 to 20 people. One shared goal a week, one chest for everyone who helped.</div>
          <div style={{ borderRadius: 14, background: HOME.tile, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ ...head(12), color: HOME.gold }}>JOIN A SQUAD</div>
            <Field label="SQUAD CODE" value="7K2-QX9"/>
            <Btn>JOIN SQUAD ALPHA</Btn>
            <div style={{ fontSize: 12, color: HOME.muted, textAlign: 'center' }}>Or open a squad link a friend sent you.</div>
          </div>
          <div style={{ borderRadius: 14, background: HOME.tile, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ ...head(12), color: HOME.gold }}>START A SQUAD</div>
            <Field label="SQUAD NAME" hint="e.g. Squad Alpha"/>
            <div style={{ display: 'flex', gap: 8 }}>
              {['60', '100', '150'].map((g) => <span key={g} style={{ flex: 1, height: 40, borderRadius: 10, display: 'grid', placeItems: 'center', ...head(12), color: g === '100' ? HOME.gold : C.text, border: `1.5px solid ${g === '100' ? HOME.gold : 'rgba(255,255,255,.14)'}` }}>{g} ROUNDS</span>)}
            </div>
            <Btn tone="violet">CREATE AND GET THE CODE</Btn>
          </div>
        </div>
      </Look>

      <Look name="Squad screen" note="The goal, the chest (locked until the goal is met), today's activity, preset cheers, members with this week's rounds." height={640}>
        <SquadScreen/>
      </Look>

      <Look name="Home: squad card" note="One line on home: the goal and what is left." height={170}>
        <HomeHeader right={<WeekChip/>}/>
        <div style={{ margin: '8px 14px', borderRadius: 14, background: HOME.tile, border: '1px solid rgba(61,123,255,.45)', display: 'flex', alignItems: 'center', gap: 12, padding: 12 }}>
          <Chest size={38}/>
          <div style={{ flex: 1 }}>
            <div style={{ ...head(10, 600), color: HOME.muted }}>SQUAD ALPHA · 3 DAYS LEFT</div>
            <div style={{ ...head(14), color: C.text, letterSpacing: '0.02em' }}>36 rounds to open the chest</div>
            <div style={{ marginTop: 6 }}><Bar value={64} max={100} height={6}/></div>
          </div>
        </div>
      </Look>

      <Look name="Chest opened" note="When the goal is met. Rewards are cosmetic, for everyone who added at least one round." height={480} animated>
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, textAlign: 'center', padding: 22, position: 'relative',
          background: 'radial-gradient(ellipse at center, rgba(253,224,71,.16) 0%, rgba(8,0,18,1) 65%)' }}>
          <div style={{ ...orb(12), color: HOME.muted }}>SQUAD ALPHA · 100 / 100 ROUNDS</div>
          <div style={{ position: 'relative', height: 120, display: 'grid', placeItems: 'center' }}>
            <span style={{ position: 'absolute', width: 140, height: 140, borderRadius: 70, background: 'radial-gradient(circle, rgba(253,224,71,.6), transparent 65%)', animation: 'rl-burst 1s 1.7s both' }}/>
            <Chest open size={90}/>
            <div style={{ position: 'absolute', inset: 0 }}><Sparks n={16}/></div>
          </div>
          <div style={{ ...orb(28), ...goldText, animation: 'rl-slam .6s 2s both' }}>CHEST OPEN</div>
          <div style={{ display: 'flex', gap: 8, animation: 'rl-rise .4s 2.5s both' }}>
            <span style={{ padding: '8px 12px', borderRadius: 10, background: HOME.tile, border: '1px solid rgba(253,224,71,.5)', ...head(12), color: HOME.gold }}>🏳 ALPHA BANNER</span>
            <span style={{ padding: '8px 12px', borderRadius: 10, background: HOME.tile, border: '1px solid rgba(168,85,247,.5)', ...head(12), color: C.text }}>+1 SQUAD STAR</span>
          </div>
          <div style={{ fontSize: 13, color: HOME.muted, animation: 'rl-rise .4s 2.7s both' }}>7 of 8 members added rounds and get it.</div>
        </div>
      </Look>

      <Look name="Leave, report, block, remove" note="The ⋯ menu on a member. Remove is for the squad's creator only. No free-text chat in the first version." height={420}>
        <div style={{ height: '100%', position: 'relative' }}>
          <div style={{ position: 'absolute', inset: 0, filter: 'brightness(.35)' }}><SquadScreen/></div>
          <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, borderRadius: '20px 20px 0 0', background: '#0E0B18', borderTop: '1px solid rgba(255,255,255,.15)', padding: 16, display: 'flex', flexDirection: 'column', gap: 8, animation: 'rl-rise .3s both' }}>
            <div style={{ ...head(12), color: C.text, textAlign: 'center', marginBottom: 4 }}>TRAINEE 21</div>
            <Btn tone="ghost">🚩 REPORT</Btn>
            <Btn tone="ghost">⛔ BLOCK</Btn>
            <Btn tone="danger">REMOVE FROM SQUAD</Btn>
            <div style={{ borderTop: '1px solid rgba(255,255,255,.1)', margin: '4px 0' }}/>
            <Btn tone="danger">LEAVE SQUAD ALPHA</Btn>
          </div>
        </div>
      </Look>
    </Feature>
  );
}
