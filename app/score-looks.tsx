import Head from 'expo-router/head';
import { useLocalSearchParams } from 'expo-router';
import ScoreLooks from '@/components/training-mode/score-looks/ScoreLooks';

// The game-over score board, as looks only (sample data, not wired into the
// app, nothing sent to a server). Hidden: not linked from the app's menus, not
// indexed. ?s=<state> draws one state full screen; no state lists them.
export default function ScoreLooksRoute() {
  const { s } = useLocalSearchParams<{ s?: string }>();
  return (
    <>
      <Head>
        <title>Score looks · Training Mode</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <ScoreLooks s={typeof s === 'string' ? s : undefined} />
    </>
  );
}
