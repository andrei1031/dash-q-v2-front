# Push Notifications VAPID Fix - TODO

## Plan Implementation Steps

- [x] Step 1: Edit `src/Components/notifications/EnhancedPushNotifications.js` - Replace REACT_APP_VAPID_KEY with REACT_APP_VAPID_PUBLIC_KEY
- [ ] Step 2: User adds `REACT_APP_VAPID_PUBLIC_KEY=...` to `.env` + restarts dev server (`yarn start` or `npm start`)
- [ ] Step 3: Test push registration in console: look for "Successfully subscribed to Dash-Q Push Notifications."
- [ ] Step 4: Verify backend `/notifications/subscribe` endpoint works with subscription

**Next**: Complete Step 1 via edit_file, then mark done and proceed.
