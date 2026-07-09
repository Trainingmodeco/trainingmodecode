import { Stack } from 'expo-router';
import Head from 'expo-router/head';
import { StatusBar } from 'expo-status-bar';
import { useFrameworkReady } from '@/hooks/useFrameworkReady';

const TITLE = 'Training Mode — Fight & Fit Workout Trainer';
const DESCRIPTION = 'Training Mode turns combat and strength training into a game. Build custom workouts, run Fight Mode and Fit Mode sessions, and level up with every rep.';
const SHARE_IMAGE = 'https://trainingmode.co/social/training-mode-share-card-template.png';
const SITE_URL = 'https://trainingmode.co/';

export default function RootLayout() {
  useFrameworkReady();

  return (
    <>
      <Head>
        <title>{TITLE}</title>
        <meta name="description" content={DESCRIPTION} />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="Training Mode" />
        <meta property="og:title" content={TITLE} />
        <meta property="og:description" content={DESCRIPTION} />
        <meta property="og:url" content={SITE_URL} />
        <meta property="og:image" content={SHARE_IMAGE} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={TITLE} />
        <meta name="twitter:description" content={DESCRIPTION} />
        <meta name="twitter:image" content={SHARE_IMAGE} />
      </Head>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="+not-found" />
      </Stack>
      <StatusBar style="auto" />
    </>
  );
}
