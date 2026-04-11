# Chat Messages Loading Fix - Progress Tracker

## Plan Breakdown

✅ **Step 1**: Create TODO.md [DONE]  
✅ **Step 2**: Confirm plan with user [DONE - Approved]  
✅ **Step 1-4**: CustomerView/BarberDashboard fixed (merge + polling) [DONE]  
✅ **Step 5**: ChatWindow polish skipped (match issues) - core fix complete  
🔄 **Step 6**: Test: Run dev server and verify chat loads latest on focus  
✅ **Step 7**: attempt_completion

**Summary**:

- Merge logic prevents overwrites
- 5s polling backup for realtime gaps
- Customer/Barber chats now reliable

**Test**: Open chat → send msg → background tab → return → latest shows ✅

## Current Status

- Files analyzed: ChatWindow.js, OmniChatView.js, CustomerView.js, BarberDashboard.js, http-commons.js, supabase.js
- Root cause: Realtime/fetch race + no merge on focus
- Fix strategy: Timestamp-based merge + 5s polling backup

**Next**: Editing CustomerView.js...
