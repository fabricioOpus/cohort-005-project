# Notifications live in our own database, not in a notification platform

Cadence stores every Notification, with its read/unread state, in its own SQLite table and sends email through Resend, instead of handing notifications to a platform such as Knock. The rules that decide who gets notified and when an email goes out (one Notification per person per event, the per-person email throttle, no email to someone active in the app) live in our code, run offline, and need no third-party account in development. We chose this once the map ruled out a periodic digest, because the digest was the only feature that justified a platform on its free tier.

## Considered Options

- **Knock.** The only free tier with a digest and a hosted preference centre. Rejected: we do not need the digest, and our throttle rules would have to be bent to fit its workflow model.
- **Novu self-hosted, Courier, SuprSend, MagicBell, OneSignal.** Rejected: too heavy to run locally, digest and preferences behind paid plans, or no in-app channel on the web.

## Consequences

We build the per-type opt-out and the one-click unsubscribe ourselves. Moving to a platform later means migrating the stored Notifications and rewriting the delivery rules as platform workflows.
