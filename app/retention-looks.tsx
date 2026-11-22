import Head from 'expo-router/head';
import RetentionLooks from '@/components/training-mode/retention/RetentionLooks';

// Phase 0 of PROMPT-RETENTION-1.md: the design gallery of the six retention
// features. Hidden: not linked from the app's menus, not indexed.
export default function RetentionLooksRoute() {
  return (
    <>
      <Head>
        <title>Retention looks · Training Mode</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <RetentionLooks />
    </>
  );
}
