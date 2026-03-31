# The Whispering Isle — Game Guide & Walkthrough

## How to Play

Open the ZZTT console (press `~`) and type `world` to launch the game.

The game auto-saves to your browser's localStorage. Close and reopen to resume where you left off. Type `restart` to start fresh.

## Commands Reference

| Command | Shortcut | Description |
|---------|----------|-------------|
| north/south/east/west | n/s/e/w | Move in a direction |
| up/down | u/d | Climb or descend |
| in/out | | Enter or exit |
| look | l | Describe current room |
| examine \<thing\> | | Inspect something closely |
| take \<item\> | | Pick up an item |
| drop \<item\> | | Drop an item |
| inventory | i | Show what you're carrying |
| talk \<person\> | | Talk to someone |
| talk \<person\> about \<topic\> | | Ask about a specific topic |
| use \<item\> | | Use an item |
| open / unlock | | Open locked doors |
| light lantern | | Light the oil lantern |
| read \<item\> | | Read a document or page |
| listen | | Listen to surroundings |
| smell | | Smell the air |
| map | | View collected map fragments |
| journal | | Read collected journal pages |
| score | | Check progress |
| hint | | Get a contextual hint |
| save | | Save game (also auto-saves) |
| restart | | Start a new game |

## The Story

You wash ashore on a mysterious island after a shipwreck. A research station on this island went dark 10 years ago after the lead researcher, Dr. Elara Voss, activated an ancient artifact deep in the island's caves. The artifact is a beacon, calling out to something across the stars. The whispers you hear everywhere are its transmission.

**Your goals:**
1. Explore the island and uncover what happened
2. Find Dr. Voss's 10 journal pages to piece together the story
3. Collect three keys to silence the beacon at the temple altar
4. Repair the lighthouse radio to call for rescue
5. Achieve the best ending by doing both 3 and 4

## Island Zones

- **Beach/Shore** (south) — Starting area, tidepools, sea cave
- **Jungle** (central) — Dense paths, waterfall, Maya's camp
- **Village** (east-central) — Abandoned fishing village, Old Maro at the dock
- **Research Station** (north-east) — Lab, quarters, Dr. Chen
- **Marsh** (north-central) — Dangerous, requires lantern
- **Caves** (underground) — The artifact, the Hermit, Crystal Grotto
- **Mountain** (north) — Summit, ridge to temple
- **Lighthouse** (west coast) — Captain Briggs, radio workshop
- **Temple Ruins** (east peak) — Endgame area, the altar

## NPCs and Key Topics

### Old Maro (Village Dock)
Topics: hello, island, researchers, voss, caves, whispers, escape, key, artifact, help

### Dr. Chen (Research Lab)
Topics: hello, voss, artifact, research, whispers, temple, keys, radio, help, tablet

### Maya (Jungle Camp)
Topics: hello, island, jungle, machete, marsh, village, herbs, help, net

### The Hermit (Cave Alcove)
Topics: hello, whispers, artifact, temple, keys, voss, blind, help

### Captain Briggs (Lighthouse Workshop)
Topics: hello, lighthouse, radio, parts, escape, voss, key, flare, help

### Dr. Voss's Spirit (Temple Sanctum — requires 7+ journal pages)
Topics: hello, artifact, keys, temple, silence, help

## Key Items

| Item | Location | Purpose |
|------|----------|---------|
| Rusty key | Tidepools | Unlocks village store back room; temple altar (sea) |
| Brass key | Lighthouse lamp room | Unlocks Dr. Voss's room; temple altar (sky) |
| Crystal key | Crystal Grotto (past underground lake) | Temple altar (earth) |
| Oil lantern | Sea cave | Required to enter the marsh |
| Rope | Village store back room | Required to cross underground lake |
| Machete | Groundskeeper's shed | Flavor item |
| Vacuum tube | Lab annex | Radio repair part 1/3 |
| Copper antenna | Village store back room | Radio repair part 2/3 |
| Heavy battery | Research storage | Radio repair part 3/3 |
| Stone tablet | Marsh sulfur pools | Show to Dr. Chen for key sequence |
| Fishing net | Eastern cove | Trade to Maya for waterfall path info |
| Dried herbs | Maya's camp | Burn to quiet whispers |
| Flare gun | Lighthouse storage | Fire after radio is repaired |
| Journal pages (1-10) | Scattered across island | Piece together the story |

## Three Endings

1. **Best Ending** — Silence the beacon AND repair the radio
2. **Escape Ending** — Repair the radio only (beacon still active)
3. **Silence Ending** — Silence the beacon but can't escape

---

# FULL WALKTHROUGH

**Warning: Complete spoilers below.**

## Phase 1: Beach Exploration

1. Start at **Rocky Shore**. Pick up the **compass** and **journal page 1**.
2. Go **east** to **Tidepools**. Pick up the **rusty key**.
3. Go **west**, then **north** to **Sandy Beach**. Pick up **map fragment 1**.
4. Go **east** to **Eastern Cove**. Pick up the **fishing net**.
5. Go **west**, **south**, **east**, **north** to **Eastern Rocks**.
6. Go **in** to **Sea Cave**. Pick up the **lantern** and **journal page 2**.
7. **Light lantern**.
8. Go **out**, **south**, **west**, **north**, **north** to **Beach Path**.

## Phase 2: Jungle & Village

9. Go **north** to **Southern Jungle**, then **northeast** to **Jungle Clearing**. Pick up **journal page 3**.
10. Go **west** to **Western Jungle Trail**, then **north** to **Jungle Camp**.
11. Talk to **Maya**. Say `talk maya about net` (give her the fishing net). She reveals the hidden waterfall path.
12. Pick up **dried herbs**.
13. Go **south** to Western Jungle Trail, then **west** to **Hidden Waterfall**. Remember the passage behind the waterfall (shortcut to mountain later).
14. Go **east**, **east**, **east** to **Eastern Jungle**, then **north** to **Village Outskirts**.
15. Go to **Groundskeeper's Shed** (from village outskirts, type `go shed` or check exits). Pick up **machete**.
16. Go to **Village Square**, then **east** to **General Store**.
17. Type `unlock` — uses rusty key on back room.
18. Go **back** to **Store Back Room**. Pick up **rope** and **copper antenna**.
19. Return to square, go **west** to **Tavern**. Pick up **map fragment 2**.
20. Go **down** to **Cellar**. Pick up **journal page 4**.
21. Go **up**, **east**, **north** to **North Village Road**.
22. Go **east** to **Village Dock**. Talk to **Old Maro** about: island, researchers, voss, escape, key.
23. Go **west**, then **west** to **Village Church**. Pick up **faded photograph**.

## Phase 3: Research Station

24. From North Village Road, go... actually from Village Outskirts, the research station is accessed via the north village area. Go to **North Village Road** then find the path north.
25. Head to **Research Station Approach** (from north village, paths lead there through the jungle ruins path area — but the direct route is from village north).
    - Actually: from Village Square, north to North Village Road, and the research station approach connects south from village north.
26. Go to **Research Courtyard**.
27. Go **north** to **Main Laboratory**. Talk to **Dr. Chen** about: voss, artifact, keys, radio, temple.
28. Go **east** to **Lab Annex**. Pick up **vacuum tube** and **journal page 5**.
29. Go **west**, **south**, **west** to **Storage Building**. Pick up **heavy battery** and **crowbar**.
30. Go **east**, **southeast** to **Administration**. Pick up **journal page 7**.
31. Go **northwest**, **east** to **Researchers' Quarters**. The end door is locked with the brass key (don't have it yet).

## Phase 4: Lighthouse & Brass Key

32. Head to the lighthouse. From the beach dunes, go **west** to **Southern Coastal Trail**, then **northwest** to **Coastal Trail**, then **north** to **Lighthouse Grounds**.
33. Go to **workshop**. Talk to **Captain Briggs** about: radio, parts, key, escape.
34. Go **out**, then **tower** to **Lighthouse Base**.
35. Go **up** to **Gallery**, then **up** to **Lamp Room**. Pick up **brass key**.
36. Go **down**, **down**, **storage** to **Lighthouse Storage**. Pick up **flare gun**.
37. Return to workshop. Type `use radio` or `repair radio` — you have all 3 parts (vacuum tube, copper antenna, heavy battery).
38. **Radio is repaired!** (This triggers an ending, but keep going for the best ending.)

## Phase 5: Dr. Voss's Room

39. Return to **Research Station Quarters** (research courtyard, east).
40. Go **end** — brass key unlocks Dr. Voss's room.
41. Pick up **journal page 6**.

## Phase 6: Marsh & Caves

42. Head to **Edge of the Marsh** (from northern jungle). The lantern lets you pass.
43. Go **north** to **Marsh Entrance**, then **north** to **Deep Marsh**.
44. Go **east** to **Sulfur Pools**. Pick up **stone tablet**.
45. Go **west**, find **Marsh Island** (south from deep marsh). Pick up **journal page 8**.
46. Go back north, then **north** to **Marsh Crossing**, then **northeast** to **Cave Entrance**.
47. Go **in** to **Main Tunnel**.
48. Go **left** to **Crystal Gallery**, then **north** to **Underground Lake**.
49. Type `go across` — the rope lets you cross.
50. Pick up **crystal key** in the **Crystal Grotto**.
51. Go **across** back, **south**, **right**, **right** to Main Tunnel.
52. Go **right** to **Steep Descent**, then **down** to **Resonance Chamber**. Pick up the **artifact** (optional).
53. Go **east** to **Hermit's Alcove**. Talk to the **Hermit** about: whispers, artifact, temple, keys, voss.
54. (Optional) Show the stone tablet: `talk hermit about tablet`.

## Phase 7: Temple & Endgame

55. Head to the temple. Options:
    - From caves: go to Deep Passage (south from Resonance Chamber), then up the shaft to Temple Undercroft, then up to Temple Interior.
    - From mountain: use the hidden waterfall path (behind the waterfall in western jungle), climb up to mountain trail, then up to upper trail, east to ridge, east to temple approach.
56. Go through **Temple Interior** to **Temple Sanctum** (go **up**).
57. Pick up **journal page 10** (if you have 7+ pages, Dr. Voss's ghost appears).
58. Pick up **journal page 9** from the **Mountain Summit** (if you haven't already — go back via mountain trail, up to summit).
59. At the **Temple Sanctum**, type `use keys` or `use altar` or `place keys`.
60. With all three keys (rusty, crystal, brass), the beacon is silenced!

If you already repaired the radio, you get the **Best Ending**. If not, go repair it for the full victory.

## Journal Page Locations

1. Rocky Shore (starting area)
2. Sea Cave (eastern beach)
3. Jungle Clearing
4. Tavern Cellar (village)
5. Lab Annex (research station)
6. Dr. Voss's Room (research quarters — needs brass key)
7. Administration Building (research station)
8. Marsh Island
9. Mountain Summit
10. Temple Sanctum

## Quick Tips

- Talk to every NPC about every topic — they give critical information
- The `hint` command adapts to your current progress
- `score` shows your overall completion
- Some exits have non-obvious names — check exits carefully (tower, cottage, workshop, behind_waterfall, across, etc.)
- The waterfall shortcut bypasses the marsh entirely if you want to reach the mountain
- You can complete the game without collecting all 10 journal pages, but you need 7 to see Dr. Voss's ghost
