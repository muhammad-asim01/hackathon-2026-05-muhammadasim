/**
 * PostHog client singleton.
 * Import `posthog` from here wherever you need to fire events directly.
 * Prefer the `useAnalytics()` hook in React components.
 */
import posthog from "posthog-js";

export { posthog };
