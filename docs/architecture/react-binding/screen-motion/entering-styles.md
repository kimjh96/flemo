# Entering styles and engine leases

`enteringInitialStyle` renders the active entering screen's from-pose as inline style for its first styled frame. Withhold it while parked because it would defeat the park rule.

An engine lease over `transform`/`opacity` captures this flemo-authored inline style as the original. This caused a desktop blank landing; the engine now strips the scope's pose channels at COMPLETED.

Assume the engine may capture and restore any inline styles added here.
