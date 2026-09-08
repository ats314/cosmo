class_name CosmoContent
extends RefCounted
## Authored data and arithmetic extracted from Cosmo runtime 01a3a256.
## Index 0 is the first level; ring 0 is the outermost ring.
## The tunnel is presentation. These rules retain the orbital game.

const SOURCE_COMMIT: String = "01a3a25693e1bcbcac1a4d2391efb3e2e6d1ff51"
const BPM: float = 104.0
const BEAT_SECONDS: float = 60.0 / BPM
const STARFALL_SECONDS: float = 16.0 * BEAT_SECONDS
const COMBO_SECONDS: float = 2.5
const HOP_SECONDS: float = 0.14
const LAB_DIFFICULTY: float = 40.0
const RING_RADII: Array[float] = [1.0, 0.76, 0.545]
const BLACK_HOLE_RADII: Array[float] = [1.0, 0.80, 0.62, 0.45]

static func levels() -> Array[Dictionary]:
	var rows: Array[Dictionary] = [
		{"level": 1, "name": "LIFT OFF", "subtitle": "Tap to turn around",
			"rules": ["Tap to turn around", "Swipe to change ring", "Red hits use shields; no shields means game over"],
			"dl_start": 0.0, "dl_end": 90.0, "tonic_midi": 69, "key": "A minor", "world": 0, "world_name": "DRIFT",
			"chord_degrees": [0, 5, 2, 6], "arp": [0, 2, 4, 2, 3, 2, 4, 3], "new_powers": ["shield", "warp", "nova"]},
		{"level": 2, "name": "INTO THE RINGS", "subtitle": "Tap to turn away from walls",
			"rules": ["Tap to turn away from walls", "Swipe to a ring without red obstacles"],
			"dl_start": 90.0, "dl_end": 215.0, "tonic_midi": 67, "key": "G minor", "world": 1, "world_name": "TIDE",
			"chord_degrees": [0, 6, 5, 3], "arp": [0, 3, 1, 4, 2, 4, 3, 1], "new_powers": ["hyper", "slip"]},
		{"level": 3, "name": "THE STORM", "subtitle": "Collect stars, then complete an orbit",
			"rules": ["Tap to turn before a moving wall reaches you", "Collect stars, then complete an orbit"],
			"dl_start": 215.0, "dl_end": 340.0, "tonic_midi": 65, "key": "F minor", "world": 2, "world_name": "DUSTLANE",
			"chord_degrees": [0, 2, 4, 5], "arp": [0, 1, 3, 2, 4, 2, 3, 1], "new_powers": ["spot", "trail"]},
		{"level": 4, "name": "EVENT HORIZON", "subtitle": "Black hole: reach the outer ring at ESCAPE",
			"rules": ["Watch which ring the red obstacle moves to", "Black hole: reach the outer ring at ESCAPE"],
			"dl_start": 340.0, "dl_end": 470.0, "tonic_midi": 63, "key": "Eb minor", "world": 3, "world_name": "GLASS",
			"chord_degrees": [0, 5, 6, 0], "arp": [0, 4, 2, 3, 1, 3, 4, 2], "new_powers": ["blackhole", "mirror"]},
		{"level": 5, "name": "REDSHIFT", "subtitle": "Swipe to the ring with no wall",
			"rules": ["Swipe to the ring with no wall", "Scorch clears red obstacles behind you"],
			"dl_start": 470.0, "dl_end": 610.0, "tonic_midi": 61, "key": "Db minor", "world": 4, "world_name": "EMBERFALL",
			"chord_degrees": [0, 3, 6, 2], "arp": [0, 2, 1, 3, 4, 3, 1, 2], "new_powers": ["scorch"]},
		{"level": 6, "name": "HEAT DEATH", "subtitle": "Collect stars and complete orbits to score",
			"rules": ["Tap to turn; swipe to a ring without red", "Collect stars and complete orbits to score"],
			"dl_start": 610.0, "dl_end": 760.0, "tonic_midi": 59, "key": "B minor", "world": 7, "world_name": "DEEPFIELD",
			"chord_degrees": [0, 3, 4, 5], "arp": [0, 3, 4, 2, 1, 2, 4, 3], "new_powers": [],
			"native_adaptation": "Finite HEAT DEATH finish at difficulty 760; the legacy frontier had no finish line."}
	]
	var all_tiers: Array[Dictionary] = tiers()
	var all_powers: Array[Dictionary] = powers()
	for row: Dictionary in rows:
		var start: float = float(row["dl_start"])
		var finish: float = float(row["dl_end"])
		row["duration"] = finish - start # Difficulty budget, NOT a real-time countdown.
		row["nominal_active_seconds"] = difficulty_age(finish - start)
		row["angular_speed"] = speed_at(start)
		row["rings"] = ring_count(start)
		row["bpm"] = BPM
		var hazard_ids: Array[String] = []
		var encounters: Array[Dictionary] = []
		for tier: Dictionary in all_tiers:
			if float(tier["at"]) < finish and not str(tier["type"]).is_empty():
				hazard_ids.append(str(tier["type"]))
			if float(tier["at"]) >= start and float(tier["at"]) < finish:
				encounters.append(tier.duplicate(true))
		row["hazards"] = hazard_ids
		row["encounters"] = encounters
		var power_ids: Array[String] = []
		for power: Dictionary in all_powers:
			if int(power["min_level"]) <= int(row["level"]):
				power_ids.append(str(power["id"]))
		row["powers"] = power_ids
	return rows

static func level_at(index: int) -> Dictionary:
	return levels()[clampi(index, 0, 5)].duplicate(true)

static func tiers() -> Array[Dictionary]:
	var rows: Array[Dictionary] = [
		{"at": 0.0, "type": "single", "name": "", "lesson": "Red hits use shields; no shields means game over"},
		{"at": 12.0, "type": "", "name": "SECOND RING", "rings": 2, "lesson": "Swipe to change ring"},
		{"at": 18.0, "type": "twin", "name": "TWIN SHARDS", "lesson": "Two red obstacles: swipe to another ring"},
		{"at": 40.0, "type": "", "name": "THIRD RING", "rings": 3, "lesson": "Swipe to another ring to reach more stars"},
		{"at": 100.0, "type": "gate", "name": "GATES", "lesson": "A wall blocks every ring; tap to turn around"},
		{"at": 128.0, "type": "drift", "name": "DRIFTERS", "lesson": "This red obstacle moves; tap to turn away"},
		{"at": 165.0, "type": "blink", "name": "SHUTTERS", "lesson": "Pass through the open shape; avoid solid red"},
		{"at": 240.0, "type": "driftgate", "name": "SLIDING GATES", "lesson": "The wall moves; tap to turn before it reaches you"},
		{"at": 275.0, "type": "saucer", "name": "THE SAUCER", "lesson": "Turning triggers its shot; swipe to another ring"},
		{"at": 310.0, "type": "blinktwin", "name": "SHUTTER PAIRS", "lesson": "The shapes take turns opening; pass through the open one"},
		{"at": 395.0, "type": "dive", "name": "DIVERS", "lesson": "It moves to the marked ring; swipe to another ring"},
		{"at": 520.0, "type": "funnel", "name": "THE NARROWS", "lesson": "Swipe to the ring with no wall"},
		{"at": 610.0, "type": "", "name": "THE EYE", "lesson": "Collect stars and complete orbits to score"}
	]
	return rows

static func upgrades() -> Array[Dictionary]:
	# Original UPG IDs remain stable, including the historical stagelight ID.
	# These are free choices in a run's boundary draft, never shop purchases.
	var rows: Array[Dictionary] = [
		{"id": "longstar", "name": "LONGER STAR", "description": "Hypernova lasts about 14 seconds", "min_level": 1, "power": "hyper", "effect": "hyper_beats", "value": 24.0, "color": "#ff4fd8"},
		{"id": "deepbank", "name": "DEEP BANK", "description": "Start each level with 3 shields", "min_level": 1, "power": "shield", "effect": "starting_shields", "value": 3.0, "color": "#7bffc8"},
		{"id": "slowworld", "name": "SLOW WORLD", "description": "Slow-mo lasts 9 seconds", "min_level": 1, "power": "warp", "effect": "slow_seconds", "value": 9.0, "color": "#b48bff"},
		{"id": "richnova", "name": "RICH NOVA", "description": "Each cleared red leaves 2 stars", "min_level": 1, "power": "nova", "effect": "nova_yield", "value": 2.0, "color": "#ffffff"},
		{"id": "hairtrig", "name": "EARLY STARFALL", "description": "Starfall after two star-fed orbits", "min_level": 1, "power": "starfall", "effect": "fed_orbits", "value": 2.0, "color": "#5df0ff"},
		{"id": "stagelight", "name": "LONG MAGNET", "description": "Magnet attracts nearby stars for 16 seconds", "min_level": 1, "power": "spot", "effect": "magnet_seconds", "value": 16.0, "color": "#b48bff"},
		{"id": "longmirror", "name": "LONG MIRROR", "description": "Mirror lasts about 14 seconds", "min_level": 1, "power": "mirror", "effect": "mirror_beats", "value": 24.0, "color": "#4d8cff"},
		{"id": "deepburn", "name": "DEEP BURN", "description": "Scorch lasts 13 seconds", "min_level": 1, "power": "scorch", "effect": "scorch_seconds", "value": 13.0, "color": "#ff8a2b"},
		{"id": "steadyhand", "name": "STEADY HAND", "description": "More forgiving tap timing", "min_level": 1, "power": "timing", "effect": "tight_seconds", "value": 0.045, "color": "#ffc857"},
		{"id": "longslip", "name": "LONG SLIPSTREAM", "description": "Slipstream lasts 18 seconds", "min_level": 2, "power": "slip", "effect": "slip_seconds", "value": 18.0, "color": "#5df0ff"},
		{"id": "longtrail", "name": "LONG STAR TRAIL", "description": "Star trail lasts 24 seconds", "min_level": 3, "power": "trail", "effect": "trail_seconds", "value": 24.0, "color": "#ffc857"}
	]
	return rows

static func powers() -> Array[Dictionary]:
	var rows: Array[Dictionary] = [
		{"id": "shield", "name": "SHIELD", "description": "Blocks one red hit", "min_level": 1, "duration": 0.0, "weight": 0.302, "color": "#7bffc8"},
		{"id": "warp", "name": "SLOW-MO", "description": "Slows movement for 6 seconds", "min_level": 1, "duration": 6.0, "speed_scale": 0.55, "weight": 0.185, "color": "#b48bff"},
		{"id": "nova", "name": "NOVA", "description": "Turns red obstacles into stars", "min_level": 1, "duration": 0.95, "invulnerability_seconds": 0.95, "sweep_seconds": 0.62, "weight": 0.143, "color": "#ffffff"},
		{"id": "spot", "name": "MAGNET", "description": "Nearby stars curve into you for 10 seconds", "min_level": 3, "duration": 10.0, "range": 110.0, "flight_seconds": 0.38, "weight": 0.134, "color": "#b48bff"},
		{"id": "hyper", "name": "HYPERNOVA", "description": "Move faster, safe from red, for about 9s", "min_level": 2, "duration": 16.0 * BEAT_SECONDS, "beats": 16, "weight": 0.076, "color": "#ff4fd8"},
		{"id": "mirror", "name": "THE MIRROR", "description": "Collects stars on the far side for about 9s", "min_level": 4, "duration": 16.0 * BEAT_SECONDS, "beats": 16, "weight": 0.080, "color": "#4d8cff"},
		{"id": "scorch", "name": "SCORCH", "description": "Clears red behind you for 8 seconds", "min_level": 5, "duration": 8.0, "wake_seconds": 2.6, "weight": 0.080, "color": "#ff8a2b"},
		{"id": "slip", "name": "SLIPSTREAM", "description": "Swipe rings to clear red for 12 seconds", "min_level": 2, "duration": 12.0, "arc": 0.48, "grace": 0.4, "cooldown": 0.8, "weight": 0.095, "color": "#5df0ff"},
		{"id": "trail", "name": "STAR TRAIL", "description": "Nine bonus stars to collect in 16 seconds", "min_level": 3, "duration": 16.0, "stars": 9, "bonus": 4, "weight": 0.095, "color": "#ffc857"},
		{"id": "blackhole", "name": "BLACK HOLE", "description": "Ride the inner ring; swipe out at ESCAPE", "min_level": 3, "guaranteed_level": 4, "duration": 17.0, "escape_at": 12.0, "charge_seconds": 8.0, "pull_seconds": 4.0, "speed_scale": 0.60, "warp_seconds": 0.85, "weight": 0.05, "color": "#9d8bff"}
	]
	return rows

static func power_at(id: String) -> Dictionary:
	for power: Dictionary in powers():
		if power["id"] == id:
			return power
	return {}

const CANONICAL_POWER_NAMES: Dictionary = {
	"shield": "Shield",
	"warp": "Slow-mo",
	"nova": "Nova",
	"spot": "Magnet",
	"hyper": "Hypernova",
	"mirror": "The Mirror",
	"scorch": "Scorch",
	"slip": "Slipstream",
	"trail": "Star Trail",
	"blackhole": "Black Hole",
	"bh": "Black Hole",
}

static func power_display_name(id: String) -> String:
	return str(CANONICAL_POWER_NAMES.get(id, id.capitalize()))

static func upgrade_at(id: String) -> Dictionary:
	for upgrade: Dictionary in upgrades():
		if upgrade["id"] == id:
			return upgrade
	return {}

static func finale() -> Dictionary:
	return {"lead_difficulty": 10.0, "star_rings": [0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2],
		"cadence": [4, 3, 2, 4, 3, 2, 1, 3, 2, 1, 0], "angle_lead": 0.9, "angle_step": 0.55,
		"star_score": 30, "quick_score": 60, "quick_seconds": 1.3, "speed_per_star": 0.06,
		"bloom_stars": 8, "bloom_seconds": 30.0, "timeout": 50.0, "complete_score": 100, "perfect_score": 200}

static func difficulty_at(level_index: int, active_age: float, diff: float = 0.0) -> float:
	var starts: Array[float] = [0.0, 90.0, 215.0, 340.0, 470.0, 610.0]
	var age: float = maxf(0.0, active_age) + minf(maxf(0.0, diff) * 0.22, 40.0)
	return starts[clampi(level_index, 0, 5)] + (age * 0.55 if age < 80.0 else 44.0 + age - 80.0)

static func difficulty_age(span: float) -> float:
	return span / 0.55 if span < 44.0 else span + 36.0

static func speed_at(dl: float) -> float:
	return minf(4.2, 1.30 + 1.70 * (1.0 - exp(-dl / 190.0)) + maxf(0.0, dl - 250.0) * 0.0015)

static func warning_time(dl: float) -> float:
	return maxf(0.86, minf(maxf(1.0, 2.35 - dl * 0.0042), 1.0 - (dl - 610.0) * 0.00078))

static func hazard_cap(dl: float) -> int:
	var thresholds: Array[float] = [8.0, 20.0, 32.0, 55.0, 120.0, 200.0, 270.0, 340.0, 445.0, 575.0, 650.0, 780.0, 920.0, 1080.0]
	var count: int = 1
	for threshold: float in thresholds:
		if dl >= threshold:
			count += 1
	return count

static func spawn_gap(dl: float) -> float:
	var floor_gap: float = maxf(0.50, 0.80 - maxf(0.0, dl - 340.0) * 0.00048)
	return maxf(floor_gap, 2.6 - dl * 0.005)

static func star_cap(dl: float, rings: int) -> int:
	return mini(12, int(floor((3.5 + dl * 0.004) * maxi(1, rings) + 0.5)))

static func star_gap(dl: float, rings: int) -> float:
	return maxf(0.30, (1.35 - dl * 0.003) / float(maxi(1, rings)))

static func ring_count(dl: float) -> int:
	return 1 if dl < 12.0 else (2 if dl < 40.0 else 3)

static func shield_max(dl: float) -> int:
	return 3 if dl < 160.0 else (4 if dl < 320.0 else 5)

static func orbit_score(stars: int, streak: int) -> int:
	return 6 + 13 * clampi(stars, 0, 4) + (clampi(7 * (streak - 1), 0, 28) if stars > 0 else 0)

static func star_score(combo: int, trail: bool = false, bh_inner: bool = false, starfall: bool = false, overdrive: bool = false, hyper: bool = false, full_shields: bool = false, bh_active: bool = false) -> int:
	var step: int = clampi(combo, 1, 6)
	var result: int = step * (2 if bh_inner and bh_active else 1) + (4 if trail else 0)
	if starfall and not bh_active:
		result += step
	elif ((overdrive or hyper) and not bh_active) or full_shields:
		result += step
	return result

static func starfall_need(run_upgrades: Variant) -> int:
	if run_upgrades is Dictionary:
		return 2 if bool(run_upgrades.get("hairtrig", false)) else 3
	if run_upgrades is Array:
		return 2 if run_upgrades.has("hairtrig") else 3
	return 3

static func black_hole_reward(charge: float, stars: int, shields_spent: int) -> int:
	var raw: float = (80.0 + 600.0 * clampf(charge, 0.0, 1.0) + 20.0 * maxi(0, stars)) / pow(1.5, clampi(shields_spent, 0, 3))
	return int(floor(raw + 0.5))
