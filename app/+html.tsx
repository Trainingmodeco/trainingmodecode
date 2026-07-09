import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />

        {/* SEO */}
        <title>Training Mode — Fight & Fit Workout Trainer</title>
        <meta name="description" content="Training Mode turns combat and strength training into a game. Build custom workouts, run Fight Mode and Fit Mode sessions, and level up with every rep." />
        <link rel="canonical" href="https://trainingmode.co/" />

        {/* Open Graph */}
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="Training Mode" />
        <meta property="og:title" content="Training Mode — Fight & Fit Workout Trainer" />
        <meta property="og:description" content="Build custom workouts, run Fight Mode and Fit Mode sessions, and level up with every rep." />
        <meta property="og:url" content="https://trainingmode.co/" />
        <meta property="og:image" content="https://trainingmode.co/social/training-mode-share-card-template.png" />

        {/* Twitter */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Training Mode — Fight & Fit Workout Trainer" />
        <meta name="twitter:description" content="Build custom workouts, run Fight Mode and Fit Mode sessions, and level up with every rep." />
        <meta name="twitter:image" content="https://trainingmode.co/social/training-mode-share-card-template.png" />


        {/* PWA */}
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#0a0014" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Training Mode" />
        <link rel="apple-touch-icon" href="/brand/icon-192.png" />

        {/* Plausible analytics */}
        <script defer data-domain="trainingmode.co" src="https://plausible.io/js/script.js" />

        <ScrollViewStyleReset />
      </head>
      <body style={{ backgroundColor: '#0a0014', margin: 0 }}>
        {children}
      </body>
    </html>
  );
}
