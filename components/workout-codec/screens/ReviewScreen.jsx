import React, { useState } from 'react';
import { CC } from '../CodecStyles';
import { uid } from '../workoutParser';
import { saveBlocks } from '../storage';

export default function ReviewScreen({ blocks: initialBlocks, onStart, onBack }) {
  const [blocks, setBlocks] = useState(initialBlocks);
  const [editingId, setEditingId] = useState(null);

  const updateBlock = (id, field, value) => {
    setBlocks(prev => prev.map(b => b.id === id ? { ...b, [field]: value, needsReview: false } : b));
  };

  const deleteBlock = (id) => {
    setBlocks(prev => prev.filter(b => b.id !== id));
  };

  const addBlock = () => {
    const newBlock = {
      id: uid(),
      exercise: 'New Exercise',
      sets: 3,
      reps: '10',
      durationSeconds: null,
      restSeconds: 60,
      equipment: '',
      notes: '',
      needsReview: true,
    };
    setBlocks(prev => [...prev, newBlock]);
    setEditingId(newBlock.id);
  };

  const moveBlock = (idx, dir) => {
    const newBlocks = [...blocks];
    const target = idx + dir;
    if (target < 0 || target >= newBlocks.length) return;
    [newBlocks[idx], newBlocks[target]] = [newBlocks[target], newBlocks[idx]];
    setBlocks(newBlocks);
  };

  const handleStart = () => {
    saveBlocks(blocks);
    onStart(blocks);
  };

  const reviewCount = blocks.filter(b => b.needsReview).length;

  return (
    <div className="anim-codec-fade-up" style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      padding: '24px 0 0',
      minHeight: '100dvh',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <button onClick={onBack} style={{
          background: 'none', border: 'none', color: CC.muted, padding: 8, cursor: 'pointer',
        }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
          </svg>
        </button>
        <div style={{ flex: 1 }}>
          <h2 style={{
            fontFamily: "'Orbitron', sans-serif",
            fontWeight: 700,
            fontSize: 15,
            color: CC.text,
            letterSpacing: '0.06em',
          }}>
            REVIEW MISSION
          </h2>
          <p style={{ fontSize: 12, color: CC.muted }}>
            {blocks.length} exercise{blocks.length !== 1 ? 's' : ''} decoded
            {reviewCount > 0 && <span style={{ color: CC.gold }}> / {reviewCount} need review</span>}
          </p>
        </div>
      </div>

      {/* Disclaimer + Edit note */}
      <div style={{
        background: 'rgba(250,204,21,0.04)',
        border: '1px solid rgba(250,204,21,0.2)',
        borderRadius: 8,
        padding: '10px 14px',
        marginBottom: 12,
      }}>
        <p style={{ fontSize: 11, color: CC.muted, lineHeight: 1.5 }}>
          Always review decoded workouts before starting. Scanned workouts may need corrections. Train within your ability level.
        </p>
        <p style={{ fontSize: 11, color: CC.goldDim, lineHeight: 1.5, marginTop: 6 }}>
          Tap the edit icon on any exercise to adjust details before starting.
        </p>
      </div>

      {/* Exercise Blocks */}
      <div className="no-scrollbar" style={{
        flex: 1,
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        paddingBottom: 180,
      }}>
        {blocks.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '48px 20px',
          }}>
            <p style={{
              fontFamily: "'Orbitron', sans-serif",
              fontSize: 12,
              color: CC.muted,
              letterSpacing: '0.08em',
              marginBottom: 12,
            }}>
              NO EXERCISES DETECTED
            </p>
            <p style={{ fontSize: 14, color: CC.muted, marginBottom: 20 }}>
              Add exercises manually to build your mission.
            </p>
            <button onClick={addBlock} className="codec-btn-gold" style={{ padding: '14px 28px' }}>
              ADD FIRST EXERCISE
            </button>
          </div>
        ) : (
          <>
            {blocks.map((block, idx) => (
              <ExerciseCard
                key={block.id}
                block={block}
                index={idx}
                total={blocks.length}
                isEditing={editingId === block.id}
                onEdit={() => setEditingId(editingId === block.id ? null : block.id)}
                onChange={(field, val) => updateBlock(block.id, field, val)}
                onDelete={() => deleteBlock(block.id)}
                onMove={(dir) => moveBlock(idx, dir)}
              />
            ))}

            <button onClick={addBlock} className="codec-btn" style={{
              width: '100%',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              marginTop: 4,
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              ADD EXERCISE
            </button>
          </>
        )}
      </div>

      {/* Start Button - Fixed above bottom nav */}
      {blocks.length > 0 && (
        <div style={{
          position: 'fixed',
          bottom: 'calc(64px + env(safe-area-inset-bottom, 0px))',
          left: 0,
          right: 0,
          padding: '16px',
          background: 'linear-gradient(to top, rgba(10,0,20,0.98) 60%, rgba(10,0,20,0.8) 80%, transparent)',
          zIndex: 10,
        }}>
          <button
            className="codec-btn-gold anim-codec-glow"
            onClick={handleStart}
            style={{
              width: '100%',
              maxWidth: 448,
              margin: '0 auto',
              display: 'block',
              fontSize: 14,
              padding: '18px 28px',
            }}
          >
            START MISSION
          </button>
        </div>
      )}
    </div>
  );
}

function ExerciseCard({ block, index, total, isEditing, onEdit, onChange, onDelete, onMove }) {
  return (
    <div
      className={block.needsReview ? 'codec-card-gold' : 'codec-card'}
      style={{ padding: '14px 16px', position: 'relative' }}
    >
      {/* Card Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: isEditing ? 12 : 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
          <span style={{
            fontFamily: "'Orbitron', sans-serif",
            fontSize: 10,
            color: CC.muted,
            fontWeight: 700,
            minWidth: 24,
            flexShrink: 0,
          }}>
            {String(index + 1).padStart(2, '0')}
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 15, fontWeight: 600, color: CC.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {block.exercise}
            </p>
            {!isEditing && (
              <p style={{ fontSize: 12, color: CC.muted }}>
                {block.sets > 1 ? `${block.sets} sets` : '1 set'}
                {block.reps ? ` x ${block.reps} reps` : ''}
                {block.durationSeconds ? ` x ${block.durationSeconds}s` : ''}
                {block.restSeconds ? ` | ${block.restSeconds}s rest` : ''}
              </p>
            )}
          </div>
          {block.needsReview && (
            <span style={{
              fontSize: 9,
              fontFamily: "'Orbitron', sans-serif",
              color: CC.gold,
              background: 'rgba(250,204,21,0.1)',
              padding: '3px 8px',
              borderRadius: 4,
              fontWeight: 700,
              flexShrink: 0,
            }}>
              REVIEW
            </span>
          )}
        </div>
        <button onClick={onEdit} style={{
          background: 'none', border: 'none', color: CC.neon, padding: 6, cursor: 'pointer', flexShrink: 0,
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {isEditing ? (
              <polyline points="20 6 9 17 4 12"/>
            ) : (
              <>
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </>
            )}
          </svg>
        </button>
      </div>

      {/* Edit Form */}
      {isEditing && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input
            className="codec-input"
            value={block.exercise}
            onChange={(e) => onChange('exercise', e.target.value)}
            placeholder="Exercise name"
          />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            <div>
              <label style={labelStyle}>SETS</label>
              <input
                className="codec-input"
                type="number"
                min="1"
                value={block.sets}
                onChange={(e) => onChange('sets', parseInt(e.target.value) || 1)}
              />
            </div>
            <div>
              <label style={labelStyle}>REPS</label>
              <input
                className="codec-input"
                value={block.reps}
                onChange={(e) => onChange('reps', e.target.value)}
                placeholder="--"
              />
            </div>
            <div>
              <label style={labelStyle}>DURATION (s)</label>
              <input
                className="codec-input"
                type="number"
                min="0"
                value={block.durationSeconds || ''}
                onChange={(e) => onChange('durationSeconds', parseInt(e.target.value) || null)}
                placeholder="--"
              />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div>
              <label style={labelStyle}>REST (s)</label>
              <input
                className="codec-input"
                type="number"
                min="0"
                value={block.restSeconds}
                onChange={(e) => onChange('restSeconds', parseInt(e.target.value) || 0)}
              />
            </div>
            <div>
              <label style={labelStyle}>EQUIPMENT</label>
              <input
                className="codec-input"
                value={block.equipment}
                onChange={(e) => onChange('equipment', e.target.value)}
                placeholder="Optional"
              />
            </div>
          </div>
          <div>
            <label style={labelStyle}>NOTES</label>
            <input
              className="codec-input"
              value={block.notes}
              onChange={(e) => onChange('notes', e.target.value)}
              placeholder="Optional notes"
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={() => onMove(-1)} disabled={index === 0} style={{ ...moveBtn, opacity: index === 0 ? 0.3 : 1 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="18 15 12 9 6 15"/></svg>
              </button>
              <button onClick={() => onMove(1)} disabled={index === total - 1} style={{ ...moveBtn, opacity: index === total - 1 ? 0.3 : 1 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
              </button>
            </div>
            <button className="codec-btn-danger" onClick={onDelete} style={{ padding: '6px 12px', fontSize: 10 }}>
              DELETE
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const labelStyle = {
  fontFamily: "'Orbitron', sans-serif",
  fontSize: 9,
  color: CC.muted,
  letterSpacing: '0.08em',
  fontWeight: 700,
  display: 'block',
  marginBottom: 4,
};

const moveBtn = {
  background: 'rgba(168,85,247,0.1)',
  border: '1px solid rgba(168,85,247,0.3)',
  borderRadius: 6,
  padding: 6,
  color: CC.neon,
  cursor: 'pointer',
};
