import React from 'react';
import { CC } from '../CodecStyles';

export default function HomeScreen({ onAction }) {
  return (
    <div className="no-scrollbar" style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '32px 0 12px',
      minHeight: '100dvh',
      overflowY: 'auto',
      overflowX: 'hidden',
      WebkitOverflowScrolling: 'touch',
      gap: 20,
    }}>

      {/* Logo / Title */}
      <div style={{ textAlign: 'center', width: '100%' }}>
        <img
          src="/banners/icons/workout-codex-icon.png"
          alt="Workout Codex"
          loading="lazy"
          decoding="async"
          style={{
            width: 82, height: 82, objectFit: 'contain',
            borderRadius: 22, margin: '0 auto 14px', display: 'block',
            filter: 'drop-shadow(0 0 18px rgba(168,85,247,0.7)) drop-shadow(0 0 10px rgba(245,190,70,0.35))',
          }}
        />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 8 }}>
          <h1 className="anim-codec-title" style={{
            fontFamily: "'Orbitron', sans-serif",
            fontWeight: 900,
            fontSize: 28,
            color: '#FFFFFF',
            textShadow: '0 0 10px rgba(255,255,255,0.55), 0 0 18px rgba(168,85,247,0.55), 0 0 26px rgba(245,190,70,0.25)',
            textAlign: 'center',
          }}>
            WORKOUT CODEX
          </h1>
          <span style={{
            fontFamily: "'Orbitron', sans-serif",
            fontSize: 8,
            fontWeight: 700,
            color: CC.gold,
            background: 'rgba(250,204,21,0.08)',
            border: '1px solid rgba(250,204,21,0.35)',
            borderRadius: 20,
            padding: '3px 8px',
            letterSpacing: '0.1em',
            flexShrink: 0,
          }}>BETA</span>
        </div>
        <p style={{
          fontFamily: "'Orbitron', sans-serif",
          fontSize: 11,
          color: CC.muted,
          letterSpacing: '0.12em',
          fontWeight: 700,
        }}>
          UPLOAD THE WORKOUT. DECODE THE MISSION. START THE TIMER.
        </p>
      </div>

      {/* Description */}
      <div className="codec-panel" style={{
        padding: '14px 20px',
        textAlign: 'center',
        maxWidth: 380,
      }}>
        <p style={{
          fontSize: 14,
          lineHeight: 1.5,
          color: CC.muted,
          fontWeight: 500,
        }}>
          Paste or import a workout plan. Text decoding is live. Photo and PDF scanning are currently in beta.
        </p>
      </div>

      {/* Action Buttons */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        width: '100%',
        maxWidth: 320,
      }}>
        <button className="codec-btn-gold" onClick={() => onAction('pdf')} style={{ width: '100%' }}>
          <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
            </svg>
            UPLOAD PDF
          </span>
        </button>

        <button className="codec-btn" onClick={() => onAction('image')} style={{ width: '100%' }}>
          <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
              <circle cx="8.5" cy="8.5" r="1.5"/>
              <polyline points="21 15 16 10 5 21"/>
            </svg>
            UPLOAD IMAGE
          </span>
        </button>

        <button className="codec-btn" onClick={() => onAction('camera')} style={{ width: '100%' }}>
          <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
              <circle cx="12" cy="13" r="4"/>
            </svg>
            TAKE PHOTO
          </span>
        </button>

        <button className="codec-btn" onClick={() => onAction('manual')} style={{ width: '100%' }}>
          <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
            MANUAL ENTRY
          </span>
        </button>
      </div>

      {/* Footer */}
      <div style={{
        paddingTop: 12,
        textAlign: 'center',
      }}>
        <p style={{
          fontFamily: "'Orbitron', sans-serif",
          fontSize: 9,
          color: 'rgba(167,139,184,0.5)',
          letterSpacing: '0.08em',
        }}>
          TRAINING MODE // WORKOUT CODEX
        </p>
      </div>
    </div>
  );
}
