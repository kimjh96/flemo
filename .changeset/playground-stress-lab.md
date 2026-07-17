---
"@flemo/web": minor
---

Add a first-class "Stress lab" to the playground: an explained screen (reached from the control dock) where you pick a transition, content shape, and render cost, then run a heavy screen to watch the transition play immediately while its content pops in only once ready. Replaces the hidden debug overlay. The panel browser is now its own nested Router with the control dock as persistent chrome, so the dock holds still across panel moves but rides the transition out with the panels screen when entering the stress lab, its entry row choreographed by a part transition.
