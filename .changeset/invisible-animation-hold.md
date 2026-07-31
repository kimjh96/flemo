---
"@flemo/core": patch
---

Hold invisible consumer animations for the flight. An animation running inside an opacity-0 subtree (a delayed skeleton reveal and its shimmer layers) forces the compositor to create and raster every layer of that subtree the moment it becomes visible — mid-flight, that is a visible twitch. Such animations now pause while the screen is in motion (indistinguishable on glass — their output cannot be seen) and resume with the arrival-hold release at the choreography's rest point; visible animations are never touched.
