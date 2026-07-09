import React, { useState, useCallback } from 'react';
import { CODEC_STYLE } from './CodecStyles';
import { parseWorkoutText, createWorkoutMission, uid } from './workoutParser';
import { saveMission, saveBlocks, saveSummary } from './storage';
import TrainingHeader from '../training-mode/TrainingHeader';
import HomeScreen from './screens/HomeScreen';
import UploadScreen from './screens/UploadScreen';
import DecodeScreen from './screens/DecodeScreen';
import ReviewScreen from './screens/ReviewScreen';
import TimerScreen from './screens/TimerScreen';
import CompleteScreen from './screens/CompleteScreen';

export default function CodecApp({ onBack, onHome }) {
  const [screen, setScreen] = useState('home');
  const [rawText, setRawText] = useState('');
  const [blocks, setBlocks] = useState([]);
  const [, setMission] = useState(null);
  const [source, setSource] = useState('');
  const [summary, setSummary] = useState(null);
  const [initialAction, setInitialAction] = useState(null);

  const handleUploadComplete = useCallback((text, srcType) => {
    setRawText(text);
    setSource(srcType);
    setScreen('decode');
  }, []);

  const handleDecodeComplete = useCallback(() => {
    const parsed = parseWorkoutText(rawText);
    const finalBlocks = parsed.length === 0
      ? [{
          id: uid(),
          exercise: 'Exercise 1',
          sets: 3,
          reps: '10',
          durationSeconds: null,
          restSeconds: 60,
          equipment: '',
          notes: 'No exercises detected - please edit',
          needsReview: true,
        }]
      : parsed;
    setBlocks(finalBlocks);
    saveBlocks(finalBlocks);
    setScreen('review');
  }, [rawText]);

  const handleStartMission = useCallback((editedBlocks) => {
    const m = createWorkoutMission(editedBlocks, 'Decoded Mission', source);
    setMission(m);
    setBlocks(editedBlocks);
    saveMission(m);
    setScreen('timer');
  }, [source]);

  const handleMissionComplete = useCallback((completedCount, totalTime) => {
    const s = {
      totalExercises: blocks.length,
      completedExercises: completedCount,
      estimatedTime: totalTime,
      completedAt: new Date().toISOString(),
    };
    setSummary(s);
    saveSummary(s);
    setScreen('complete');
  }, [blocks]);

  const handleStartAnother = useCallback(() => {
    setRawText('');
    setBlocks([]);
    setMission(null);
    setSummary(null);
    setSource('');
    setInitialAction(null);
    setScreen('home');
  }, []);

  const handleGoUpload = useCallback((action) => {
    setInitialAction(action || null);
    setSource(action === 'manual' ? 'Manual Entry' : '');
    setScreen('upload');
  }, []);

  const handleScreenBack = useCallback((target) => {
    setInitialAction(null);
    setScreen(target || 'home');
  }, []);

  return (
    <div className="codec-scanlines" style={{
      minHeight: '100dvh',
      position: 'relative',
      overflowX: 'hidden',
      overflowY: 'auto',
      WebkitOverflowScrolling: 'touch',
      backgroundImage: `linear-gradient(to bottom, rgba(5,0,10,0.84), rgba(10,0,20,0.92)), url('/brand/brand-bg.png')`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat',
      backgroundAttachment: 'fixed',
    }}>
      <style dangerouslySetInnerHTML={{ __html: CODEC_STYLE }} />

      <TrainingHeader
        title="TRAINING MODE"
        subtitle="Fight. Fit. Evolve."
        onHome={onHome}
        showBack
        onBack={onBack}
      />

      <div style={{
        maxWidth: 460,
        margin: '0 auto',
        padding: '0 16px',
        minHeight: '100dvh',
        paddingBottom: 'calc(160px + env(safe-area-inset-bottom, 0px))',
        display: 'flex',
        flexDirection: 'column',
      }}>
        {screen === 'home' && (
          <HomeScreen
            onAction={handleGoUpload}
          />
        )}
        {screen === 'upload' && (
          <UploadScreen
            onComplete={handleUploadComplete}
            onBack={() => handleScreenBack('home')}
            initialAction={initialAction}
          />
        )}
        {screen === 'decode' && (
          <DecodeScreen
            rawText={rawText}
            onComplete={handleDecodeComplete}
            onBack={() => handleScreenBack('upload')}
          />
        )}
        {screen === 'review' && (
          <ReviewScreen
            blocks={blocks}
            onStart={handleStartMission}
            onBack={() => handleScreenBack('upload')}
          />
        )}
        {screen === 'timer' && (
          <TimerScreen
            blocks={blocks}
            onComplete={handleMissionComplete}
            onBack={() => handleScreenBack('review')}
          />
        )}
        {screen === 'complete' && (
          <CompleteScreen
            summary={summary}
            onStartAnother={handleStartAnother}
            onBackToFitMode={onBack}
          />
        )}
      </div>
    </div>
  );
}
