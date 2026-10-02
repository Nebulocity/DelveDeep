# Monster landings and ground alignment

- Enemy waves now choose distinct walkable grid squares. Landings avoid every living character's square and its neighbors; strongest monsters favor the upper center, while the rest spread across the available battlefield.
- Monsters fall into their selected squares and bounce before they join combat. If every legal square is temporarily occupied, the remaining monsters wait and retry instead of disappearing.
- Slime sheet origins now use the visible base of Cave Slime, Elder Slime, and Slime Sovereign art. The old origin sat in transparent pixels, so scaling the sheets enlarged the apparent gap over each ground shadow.
- Wave landing tests cover current Delves, blocked terrain, character clearance, and unavailable squares.
