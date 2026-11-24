import Head from 'expo-router/head';
import { useLocalSearchParams } from 'expo-router';
import FitLooks from '@/components/training-mode/fit-looks/FitLooks';

// The simplified Fit Mode workout card, as looks only (sample data, not wired
// into the app). Hidden: not linked from the app's menus, not indexed.
// ?s=<state> draws one state full screen; no state lists them.
export default function FitLooksRoute() {
  const { s } = useLocalSearchParams<{ s?: string }>();
  return (
    <>
      <Head>
        <title>Fit looks · Training Mode</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <FitLooks s={typeof s === 'string' ? s : undefined} />
    </>
  );
}
