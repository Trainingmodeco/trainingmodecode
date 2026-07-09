import React, { useState, useRef, useEffect, useCallback } from 'react';
import { CC } from '../CodecStyles';

export default function UploadScreen({ onComplete, onBack, initialAction }) {
  const [text, setText] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [fileName, setFileName] = useState('');
  const [info, setInfo] = useState('');
  const [error, setError] = useState('');
  const [showCamera, setShowCamera] = useState(false);

  const pdfRef = useRef(null);
  const imageRef = useRef(null);
  const cameraRef = useRef(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  // Cleanup webcam stream on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
    };
  }, []);

  // Trigger initial action on mount
  useEffect(() => {
    if (!initialAction) return;
    const timer = setTimeout(() => {
      if (initialAction === 'pdf') {
        pdfRef.current?.click();
      } else if (initialAction === 'image') {
        imageRef.current?.click();
      } else if (initialAction === 'camera') {
        openCamera();
      }
    }, 100);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialAction]);

  const handleFile = async (file) => {
    setError('');
    setInfo('');
    setFileName(file.name);

    const type = file.type;
    const name = file.name.toLowerCase();

    if (type === 'application/pdf' || name.endsWith('.pdf')) {
      setInfo('PDF import is in beta. For now, upload the file for reference and paste the workout text below to decode it.');
      return;
    }

    if (type.startsWith('image/') || name.match(/\.(png|jpg|jpeg|webp)$/)) {
      setInfo('Photo scanning is in beta. For now, attach the image for reference and paste the workout text below to decode it.');
      return;
    }

    if (type === 'text/plain' || name.endsWith('.txt')) {
      const content = await file.text();
      setText(content);
      setInfo('Text file loaded. Review below and decode when ready.');
      return;
    }

    setError('Unsupported file type. Please upload a PDF, image, or text file.');
  };

  const handleCapturedPhoto = (file) => {
    setFileName(file.name);
    setInfo('Photo captured. Photo scanning is in beta. Paste the workout text below to decode it.');
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) handleFile(file);
  };

  const handleFileInput = (e) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const openCamera = useCallback(async () => {
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (isMobile) {
      cameraRef.current?.click();
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setInfo('Camera unavailable. You can still upload a workout screenshot or paste the workout text below.');
      imageRef.current?.click();
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      streamRef.current = stream;
      setShowCamera(true);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      }, 50);
    } catch {
      setInfo('Camera unavailable. You can still upload a workout screenshot or paste the workout text below.');
      imageRef.current?.click();
    }
  }, []);

  const capturePhoto = useCallback(() => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(videoRef.current, 0, 0);

    canvas.toBlob((blob) => {
      if (blob) {
        const file = new File([blob], `capture_${Date.now()}.jpg`, { type: 'image/jpeg' });
        handleCapturedPhoto(file);
      }
      closeCamera();
    }, 'image/jpeg', 0.85);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const closeCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setShowCamera(false);
  }, []);

  const handleProceed = () => {
    if (!text.trim()) {
      setError('Please enter workout text to decode.');
      return;
    }
    let srcType = 'Text Input';
    if (fileName) {
      if (fileName.toLowerCase().endsWith('.pdf')) srcType = 'PDF Upload';
      else srcType = 'Image Upload';
    }
    onComplete(text, srcType);
  };

  return (
    <div className="anim-codec-fade-up no-scrollbar" style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      padding: '0',
      paddingTop: 'calc(44px + env(safe-area-inset-top, 0px))',
      paddingBottom: 'calc(150px + env(safe-area-inset-bottom, 0px))',
      height: '100dvh',
      overflowY: 'auto',
      overflowX: 'hidden',
      WebkitOverflowScrolling: 'touch',
      gap: 12,
    }}>
      {/* Hidden file inputs */}
      <input ref={pdfRef} type="file" accept=".pdf,application/pdf" onChange={handleFileInput} style={{ display: 'none' }} />
      <input ref={imageRef} type="file" accept=".png,.jpg,.jpeg,.webp,image/*" onChange={handleFileInput} style={{ display: 'none' }} />
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" onChange={handleFileInput} style={{ display: 'none' }} />

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={onBack} style={{
          background: 'none', border: 'none', color: CC.muted, padding: 8, cursor: 'pointer',
        }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
          </svg>
        </button>
        <h2 style={{
          fontFamily: "'Orbitron', sans-serif",
          fontWeight: 700,
          fontSize: 16,
          color: CC.text,
          letterSpacing: '0.06em',
        }}>
          IMPORT WORKOUT
        </h2>
      </div>

      {/* Drop Zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => imageRef.current?.click()}
        style={{
          border: `2px dashed ${dragOver ? CC.gold : 'rgba(168,85,247,0.35)'}`,
          borderRadius: 14,
          padding: '24px 20px',
          textAlign: 'center',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          background: dragOver ? 'rgba(250,204,21,0.04)' : 'rgba(10,0,20,0.5)',
        }}
      >
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={dragOver ? CC.gold : CC.neon} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 8 }}>
          <polyline points="16 16 12 12 8 16"/>
          <line x1="12" y1="12" x2="12" y2="21"/>
          <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/>
        </svg>
        <p style={{ fontSize: 14, fontWeight: 600, color: CC.text, marginBottom: 4 }}>
          Drop a file here or tap to browse
        </p>
        <p style={{ fontSize: 12, color: CC.muted }}>
          PDF, PNG, JPG, WebP, or TXT
        </p>
        {fileName && (
          <p style={{ fontSize: 12, color: CC.gold, marginTop: 8, fontWeight: 600 }}>
            {fileName}
          </p>
        )}
      </div>

      {/* Quick actions row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
        <button className="codec-btn" onClick={() => pdfRef.current?.click()} style={{ padding: '10px 8px', fontSize: 10 }}>
          PDF
        </button>
        <button className="codec-btn" onClick={() => imageRef.current?.click()} style={{ padding: '10px 8px', fontSize: 10 }}>
          IMAGE
        </button>
        <button className="codec-btn" onClick={openCamera} style={{ padding: '10px 8px', fontSize: 10 }}>
          CAMERA
        </button>
      </div>

      {/* Info / Beta message */}
      {info && (
        <div style={{
          background: 'rgba(250,204,21,0.05)',
          border: '1px solid rgba(250,204,21,0.25)',
          borderRadius: 10,
          padding: '12px 16px',
        }}>
          <p style={{ fontSize: 13, color: CC.goldDim, lineHeight: 1.5 }}>{info}</p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{
          background: 'rgba(239,68,68,0.06)',
          border: '1px solid rgba(239,68,68,0.3)',
          borderRadius: 10,
          padding: '12px 16px',
        }}>
          <p style={{ fontSize: 13, color: '#ef4444', lineHeight: 1.5 }}>{error}</p>
        </div>
      )}

      {/* Text Area */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <label style={{
          fontFamily: "'Orbitron', sans-serif",
          fontSize: 10,
          color: CC.muted,
          letterSpacing: '0.1em',
          fontWeight: 700,
        }}>
          WORKOUT TEXT
        </label>
        <textarea
          className="codec-textarea no-scrollbar"
          value={text}
          onChange={(e) => { setText(e.target.value); setError(''); }}
          placeholder={`Paste your workout here...\n\nExamples:\nPush Ups 3x15\nSquats 4 sets of 12\nPlank 3 x 45 sec\nJump Rope 5 rounds x 1 min\nRest 60 sec\nBurpees 3 rounds of 20 reps\nBench Press: 5x5\n30 seconds work / 15 seconds rest`}
          style={{
            height: 'clamp(220px, 42vh, 380px)',
            minHeight: 220,
            maxHeight: '48vh',
            resize: 'none',
          }}
        />
      </div>

      {/* Proceed Button */}
      <div style={{
        position: 'sticky',
        bottom: 'calc(78px + env(safe-area-inset-bottom, 0px))',
        zIndex: 50,
        paddingTop: 12,
        paddingBottom: 12,
        marginTop: 10,
        background: 'linear-gradient(to top, rgba(10,0,20,0.98) 60%, rgba(10,0,20,0.85) 80%, transparent)',
      }}>
        <button
          className="codec-btn-gold"
          onClick={handleProceed}
          style={{ width: '100%' }}
        >
          DECODE WORKOUT
        </button>
      </div>

      {/* Camera Modal (Desktop Webcam) */}
      {showCamera && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          background: 'rgba(0,0,0,0.92)',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          padding: 20,
        }}>
          <div style={{
            width: '100%', maxWidth: 400,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', gap: 16,
          }}>
            <p style={{
              fontFamily: "'Orbitron', sans-serif",
              fontSize: 11, color: CC.gold,
              letterSpacing: '0.1em', fontWeight: 700,
            }}>
              CAMERA PREVIEW
            </p>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              style={{
                width: '100%', maxHeight: '60vh',
                borderRadius: 12,
                border: `1px solid rgba(168,85,247,0.3)`,
                background: '#000',
                objectFit: 'cover',
              }}
            />
            <div style={{ display: 'flex', gap: 12 }}>
              <button className="codec-btn-gold" onClick={capturePhoto} style={{ padding: '14px 28px' }}>
                CAPTURE PHOTO
              </button>
              <button className="codec-btn" onClick={closeCamera} style={{ padding: '14px 28px' }}>
                CANCEL
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
