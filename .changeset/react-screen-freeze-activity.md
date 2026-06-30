---
"@flemo/react": minor
---

Freeze inactive screens with React's `<Activity>` instead of a manual
display:none wrapper. Hidden screens keep their DOM state (scroll position, form
values, media) and restore it when shown again, while their effects now suspend
while hidden and remount on show, so timers and subscriptions no longer run on
screens the user can't see. Requires React 19.2+.
