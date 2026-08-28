---
"@flemo/web": patch
---

Fix three defects in the playground's container transform. The artwork now flies on an authored morph that carries no ghost, because a copy of the same gradient dissolving over the original at a different size beats against it instead of growing. The detail's header stops running the body's part transition, which blinked it out in 120ms while the card was still shrinking under it. The act name stops being a paired `text` morph, because the date under it stood on a box that grew every frame the type did; it arrives with the rest of the copy instead. The camera moves onto the card, since a morph riding its container cannot move the screen the container is on.
