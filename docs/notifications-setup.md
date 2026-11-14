# Booking reminders without Cloud Functions

Booking reminders are scheduled locally on each Android/iOS device with Expo
Notifications. The app requests notification permission when a user creates a
booking, then schedules a reminder 15 minutes before it starts and another 10
minutes before it ends. Reminder history is stored on that device with
AsyncStorage; it is not synchronized between devices or stored in Firestore.
Web builds and Expo Go do not schedule native reminders. In Expo Go, the app
still stores and displays due reminders in its in-app notification list, but
does not load `expo-notifications`; that package registers a remote push-token
listener on import, and remote push notifications are unavailable in Expo Go
on Android. Use a development build to test native local reminders.

No Cloud Scheduler, Firebase Cloud Messaging token, or deployed function is
needed for reminders. Rebuild the native app after installing the
`expo-notifications` config plugin so Android/iOS include the native module.

## Apply Firestore rules

The app now performs check-in and booking extension through client-side
Firestore transactions. Deploy the included rules before using these changes:

```sh
firebase login
firebase use <your-firebase-project-id>
firebase deploy --only firestore:rules
```

The rules restrict booking changes to the booking owner, with check-in also
allowed for users whose Firebase Auth token has the `scanner` or `admin` custom
claim. Room catalog changes require the `admin` claim; initial mock room
documents with IDs `1` through `8` may be seeded by a signed-in user. Booking
documents are readable by signed-in users because the current availability
screen queries bookings across users.

New bookings include Firestore timestamp fields used by the rules to validate
the check-in window. When an owner checks in or extends a legacy booking, the
app first adds the equivalent timestamp fields without changing the booking's
existing date/time values. Because there is no trusted backend doing this
backfill, the Firestore Rules can verify that only the booking owner (or a
scanner/admin) adds those fields, but cannot verify the values derived by the
client.

Booking status values `NO_SHOW` and `COMPLETED` are now derived from the
booking's time range when the app reads it; they are not written by a scheduled
backend job. The app refreshes those derived statuses while open.

The app currently reads booking documents across users to calculate room
availability, so these rules permit signed-in users to read those documents.
Capacity and overlap validation still runs in client transactions; Firestore
Rules enforce ownership and room-revision updates but cannot make those query
checks authoritative against a modified client.

## Remove previously deployed functions

Changing `firebase.json` stops this repository from deploying Functions, but
does not delete functions already deployed to Firebase. After verifying the
client changes and rules, remove the old deployed functions from the Firebase
Console or run:

```sh
firebase functions:delete checkInBooking extendBooking createBookingReminderNotifications --region us-central1
```

Confirm the deletion prompt only after existing app versions and bookings have
been checked. If you want to leave the Blaze plan, change the Firebase
project's plan in the Firebase Console after deleting the deployed functions.
Firestore still has its normal usage quotas; this change removes the project's
Cloud Functions and Scheduler dependency, not all possible Firebase usage
charges.
