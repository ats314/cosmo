class_name CosmoProfile
extends RefCounted
## Local native records. No account service or browser-save migration implied.
## Upgrade picks belong to the active run, never to the persistent profile.

const CONTENT = preload("res://scripts/cosmo_content.gd")
const SCHEMA_VERSION: int = 1
const MAX_SCORE: int = 2_000_000_000
var profile_path: String = "user://cosmo_profile_v1.json"
var data: Dictionary = _defaults()
var run_upgrades: Dictionary = {}
var offered_upgrades: Dictionary = {}
var last_error: String = ""
var _lab_snapshot: Dictionary = {}
var _lab_run_snapshot: Dictionary = {}
var _lab_offered_snapshot: Dictionary = {}
var lab_active: bool = false:
	set(value):
		if value == lab_active:
			return
		if value:
			_lab_snapshot = data.duplicate(true)
			_lab_run_snapshot = run_upgrades.duplicate(true)
			_lab_offered_snapshot = offered_upgrades.duplicate(true)
		else:
			data = _lab_snapshot.duplicate(true)
			run_upgrades = _lab_run_snapshot.duplicate(true)
			offered_upgrades = _lab_offered_snapshot.duplicate(true)
			_lab_snapshot.clear()
			_lab_run_snapshot.clear()
			_lab_offered_snapshot.clear()
		lab_active = value

static func _defaults() -> Dictionary:
	return {"version": SCHEMA_VERSION, "best": 0, "best_by_start": {},
		"unlocked_level": 1, "completed": false, "full_completions": 0,
		"muted": false, "reduced_motion": false, "swipe_mode": "radial", "tutorial_seen": false}

func load_profile() -> Dictionary:
	if lab_active:
		return data.duplicate(true)
	last_error = ""
	if not FileAccess.file_exists(profile_path):
		data = _defaults()
		return data.duplicate(true) # Reading a new profile must not create a file.
	var file: FileAccess = FileAccess.open(profile_path, FileAccess.READ)
	if file == null:
		last_error = "Cannot read local records: %s" % error_string(FileAccess.get_open_error())
		return data.duplicate(true)
	var json: JSON = JSON.new()
	var parse_error: Error = json.parse(file.get_as_text())
	file.close()
	if parse_error != OK or not json.data is Dictionary:
		last_error = "Local records could not be read. The existing file was preserved."
		return data.duplicate(true)
	data = _sanitize(json.data)
	return data.duplicate(true)

func save_profile() -> bool:
	if lab_active:
		return false
	last_error = ""
	var clean: Dictionary = _sanitize(data)
	var temp_path: String = profile_path + ".tmp"
	var file: FileAccess = FileAccess.open(temp_path, FileAccess.WRITE)
	if file == null:
		last_error = "Cannot save local records: %s" % error_string(FileAccess.get_open_error())
		return false
	file.store_string(JSON.stringify(clean, "\t"))
	file.flush()
	var write_error: Error = file.get_error()
	file.close()
	if write_error != OK:
		last_error = "Writing local records failed: %s" % error_string(write_error)
		return false
	var rename_error: Error = DirAccess.rename_absolute(ProjectSettings.globalize_path(temp_path), ProjectSettings.globalize_path(profile_path))
	if rename_error != OK:
		last_error = "Replacing local records failed: %s" % error_string(rename_error)
		return false
	data = clean
	return true

func record_run(score: int, level: int, start_level: int, won: bool) -> bool:
	if lab_active or score < 0 or level < 1 or level > 6 or start_level < 1 or start_level > level:
		return false
	data = _sanitize(data)
	var valid_score: int = mini(score, MAX_SCORE)
	data["best"] = maxi(int(data["best"]), valid_score)
	var by_start: Dictionary = data["best_by_start"]
	var start_key: String = str(start_level)
	by_start[start_key] = maxi(int(by_start.get(start_key, 0)), valid_score)
	# A chosen later start can set a score. It cannot claim a climb from level 1.
	if start_level == 1:
		data["unlocked_level"] = maxi(int(data["unlocked_level"]), level)
		if won and level == 6:
			data["completed"] = true
			data["full_completions"] = mini(MAX_SCORE, int(data["full_completions"]) + 1)
	return save_profile()

func set_preference(key: String, value: Variant) -> bool:
	if lab_active or key not in ["muted", "reduced_motion", "swipe_mode", "tutorial_seen"]:
		return false
	if key == "swipe_mode":
		if value not in ["radial", "screen"]:
			return false
	elif not value is bool:
		return false
	data[key] = value
	return save_profile()

func begin_run() -> void:
	run_upgrades.clear()
	offered_upgrades.clear()

func begin_lab() -> void:
	lab_active = true
	run_upgrades.clear()
	offered_upgrades.clear()

func end_lab() -> void:
	lab_active = false

func choose_upgrade(id: String, entering_level: int) -> bool:
	var upgrade: Dictionary = CONTENT.upgrade_at(id)
	if lab_active or upgrade.is_empty() or run_upgrades.has(id):
		return false
	if entering_level < 2 or entering_level > 6 or int(upgrade["min_level"]) > entering_level:
		return false
	run_upgrades[id] = true
	return true

func draft(entering_level: int, rng: RandomNumberGenerator) -> Array[Dictionary]:
	var result: Array[Dictionary] = []
	if lab_active or entering_level < 2 or entering_level > 6:
		return result
	var eligible: Array[Dictionary] = []
	var fresh: Array[Dictionary] = []
	for upgrade: Dictionary in CONTENT.upgrades():
		var id: String = str(upgrade["id"])
		if int(upgrade["min_level"]) > entering_level or run_upgrades.has(id):
			continue
		eligible.append(upgrade)
		if not offered_upgrades.has(id):
			fresh.append(upgrade)
	while result.size() < 3:
		var pool: Array[Dictionary] = fresh if not fresh.is_empty() else eligible
		if pool.is_empty():
			break
		var chosen: Dictionary = pool[rng.randi_range(0, pool.size() - 1)]
		result.append(chosen.duplicate(true))
		fresh.erase(chosen)
		eligible.erase(chosen)
		offered_upgrades[str(chosen["id"])] = true
	return result

static func _safe_int(value: Variant, fallback: int = 0) -> int:
	if (value is int or value is float) and is_finite(float(value)):
		return int(clampf(float(value), 0.0, float(MAX_SCORE)))
	return fallback

static func _sanitize(raw: Dictionary) -> Dictionary:
	var clean: Dictionary = _defaults()
	clean["best"] = _safe_int(raw.get("best", 0))
	clean["unlocked_level"] = clampi(_safe_int(raw.get("unlocked_level", 1), 1), 1, 6)
	clean["full_completions"] = _safe_int(raw.get("full_completions", 0))
	for key: String in ["muted", "reduced_motion", "tutorial_seen", "completed"]:
		if raw.get(key) is bool:
			clean[key] = raw[key]
	if raw.get("swipe_mode", "radial") in ["radial", "screen"]:
		clean["swipe_mode"] = raw.get("swipe_mode", "radial")
	var bests: Variant = raw.get("best_by_start", {})
	if bests is Dictionary:
		for level: int in range(1, 7):
			var key: String = str(level)
			if bests.has(key):
				clean["best_by_start"][key] = _safe_int(bests[key])
	# Unknown fields, legacy currency and run upgrades are not persisted.
	return clean
