import { ScrollViewStyleReset } from 'expo-router/html';
import React from 'react';

import { colors } from '../src/theme';

/**
 * The HTML shell for the web build. This is what makes "Add to Home Screen" on
 * an iPhone produce a real, fullscreen app rather than a Safari bookmark.
 * Native builds never see this file.
 */
export default function Root({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover"
        />

        <title>TV Tracker</title>
        <meta name="description" content="Keep track of where you are in the shows you watch." />

        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content={colors.bg} />

        {/* iOS reads these rather than the manifest. */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black" />
        <meta name="apple-mobile-web-app-title" content="TV Tracker" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="icon" href="/icon-192.png" />

        <ScrollViewStyleReset />

        <style dangerouslySetInnerHTML={{ __html: shellStyles }} />
        <script dangerouslySetInnerHTML={{ __html: registerServiceWorker }} />
      </head>
      <body>{children}</body>
    </html>
  );
}

const shellStyles = `
  html, body, #root { background-color: ${colors.bg}; }
  body { overscroll-behavior-y: none; }
  /* No text selection or long-press callout — this should not feel like a page. */
  * { -webkit-tap-highlight-color: transparent; -webkit-touch-callout: none; }
`;

const registerServiceWorker = `
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('/sw.js').catch(function () {});
    });
  }
`;
