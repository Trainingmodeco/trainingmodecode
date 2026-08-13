import React from 'react';
import { House, Dumbbell, TrendingUp, User } from 'lucide-react';

const TABS = [
  { id: 'home',     label: 'HOME',     Icon: House },
  { id: 'train',    label: 'TRAIN',    Icon: Dumbbell },
  { id: 'progress', label: 'PROGRESS', Icon: TrendingUp },
  { id: 'profile',  label: 'PROFILE',  Icon: User },
];

export default function BottomNav({ active, onNavigate }) {
  return (
    <div data-guide="nav-tabs" style={{
      background: 'rgba(6,1,14,0.95)',
      borderTop: '1px solid rgba(168,85,247,0.28)',
      padding: '8px 6px calc(10px + env(safe-area-inset-bottom, 0px))',
      display: 'flex',
      justifyContent: 'space-around',
      alignItems: 'center',
      backdropFilter: 'blur(20px)',
    }}>
      {TABS.map(tab => {
        const isActive = active === tab.id;
        const { Icon } = tab;
        // Beta TM-17 — 0.45-alpha white was 4.44:1, just under WCAG AA (4.5).
        // C.faint keeps the inactive tier visually quiet (violet-grey, not
        // brighter than the active violet) at 6.7:1.
        const color = isActive ? '#b06aff' : '#9a90b8';
        return (
          <button
            key={tab.id}
            onClick={() => onNavigate(tab.id)}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 2,
              padding: '6px 8px', // narrower so PROGRESS at 9px still fits 320px
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              flex: 1,
              position: 'relative',
              transition: 'all 0.2s ease',
            }}
          >
            {isActive && (
              <div style={{
                position: 'absolute',
                top: -1,
                width: 18,
                height: 2.5,
                borderRadius: 999,
                background: '#b06aff',
                boxShadow: '0 0 12px rgba(168,85,247,0.7)',
              }}/>
            )}
            <Icon
              size={20}
              color={color}
              strokeWidth={isActive ? 2.3 : 1.6}
              style={{
                filter: isActive ? 'drop-shadow(0 0 7px rgba(168,85,247,0.65))' : 'none',
                transition: 'all 0.2s ease',
              }}
            />
            <span style={{
              fontFamily: "'Orbitron', sans-serif",
              fontWeight: isActive ? 700 : 500,
              fontSize: 9, // beta TM-18 — 7px was below any legible floor
              letterSpacing: '0.08em',
              color,
              transition: 'color 0.2s ease',
            }}>
              {tab.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
