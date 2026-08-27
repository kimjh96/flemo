---
"@flemo/web": patch
---

Stop the playground's container transform hiding the camera it exists to show. The detail screen faded in on a front-loaded curve, so an opaque rectangle covered the poster grid about 50ms into a 500ms flight and the rest of the camera's push happened behind it, which read as the stage going black around a small card. The card is the surface under this case, so the detail hands it the background and the screen paints nothing of its own; the grid stays lit and visibly pushed out while the card grows opaque over it.
