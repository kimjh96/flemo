# Parts and decorator

`Part.tsx` wraps an element in a named part-transition. Through ScreenContext/RouterIdContext, it carries its screen's status/active attributes and the Router marker, scoping compiled selectors and engine variant queries correctly.

A Part can live outside any screen, such as persistent chrome beside a `<Slot>` or a portal. The engine stamps the transition's anim-hold on these outer Parts: the compiled hold rule pauses only `[data-flemo-anim-hold] [data-flemo-part-name]` descendants. Without the stamp, an outer Part animates through the hold and leads the transition by the hold's entire duration. Parts inside screens or shared bars need no stamp: the binding places the hold attribute on both containers, covering their descendants.

The engine finds outer Parts through `data-flemo-router`, never by walking upward from the scope. Each screen has its own wrapper; that walk would see only the already-held screen subtree and silently cover nothing. The active side owns the stamp. Both transition screens carry a hold; two owners writing one persistent element would let the first release unhold it for the other.

`ScreenDecorator.tsx` renders the dim/decorator element through `decoratorMap`, using the same holds and engine joins.
