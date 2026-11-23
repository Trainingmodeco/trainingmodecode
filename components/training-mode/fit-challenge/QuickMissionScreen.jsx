import { useState } from 'react';
import QuickMissionSetup from '../QuickMissionSetup';
import FitCardSetup from './FitCardSetup';
import { retentionOn } from '../data/retentionFlags';

// The Quick Mission page: with the workout card switch on (data/retentionFlags
// 'fitCard', the owner's preview), the card page (FitCardSetup); off, today's
// page (QuickMissionSetup), unchanged. The switch is read once per mount.
export default function QuickMissionScreen(props) {
  const [card] = useState(() => retentionOn('fitCard'));
  return card ? <FitCardSetup {...props}/> : <QuickMissionSetup {...props}/>;
}
