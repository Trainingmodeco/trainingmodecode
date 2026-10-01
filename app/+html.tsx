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
        <link rel="canonical" href="https://apptrainingmode.com/" />

        {/* Open Graph */}
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="Training Mode" />
        <meta property="og:title" content="Training Mode — Fight & Fit Workout Trainer" />
        <meta property="og:description" content="Build custom workouts, run Fight Mode and Fit Mode sessions, and level up with every rep." />
        <meta property="og:url" content="https://apptrainingmode.com/" />
        <meta property="og:image" content="https://apptrainingmode.com/social/training-mode-share-card-template.png" />

        {/* Twitter */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Training Mode — Fight & Fit Workout Trainer" />
        <meta name="twitter:description" content="Build custom workouts, run Fight Mode and Fit Mode sessions, and level up with every rep." />
        <meta name="twitter:image" content="https://apptrainingmode.com/social/training-mode-share-card-template.png" />


        {/* PWA */}
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#0a0014" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Training Mode" />
        <link rel="apple-touch-icon" href="/brand/icon-192.png" />

        {/* Plausible analytics — the site-specific snippet from the owner's
            Plausible account (apptrainingmode.com), verbatim. NOTE: the web
            export does not use this file — production gets this snippet from
            scripts/copy-public-assets.mjs. Kept identical so the two can't
            drift if this file is ever wired in (the injector then skips its
            own copy). */}
        <script async src="https://plausible.io/js/pa-7d3Zk5sxJ2vgZHF_-M1j2.js" />
        <script dangerouslySetInnerHTML={{ __html: 'window.plausible=window.plausible||function(){(plausible.q=plausible.q||[]).push(arguments)},plausible.init=plausible.init||function(i){plausible.o=i||{}};\nplausible.init()' }} />

        <ScrollViewStyleReset />
      </head>
      <body style={{ backgroundColor: '#0a0014', margin: 0 }}>
        {children}
      </body>
    </html>
  );
}
