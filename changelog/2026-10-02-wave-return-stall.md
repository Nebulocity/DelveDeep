# Wave return stall fix

- Lock each adventurer's safe return target when a wave ends, so collision avoidance cannot move the target from side to side during the walk home.
- Let a unit settle after two seconds without progress. A ten-second return limit also keeps unusual paths from blocking the next wave. The usual two-second pause still precedes the countdown.
- Added battle behavior coverage for a blocked returner and the transition timing.
