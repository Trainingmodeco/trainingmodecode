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
    <div style={{
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
        const color = isActive ? '#b06aff' : 'rgba(255,255,255,0.45)';
        return (
          <button
            key={tab.id}
            onClick={() => onNavigate(tab.id)}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 2,
              padding: '6px 14px',
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
              fontSize: 7,
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
