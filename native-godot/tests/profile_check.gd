extends SceneTree
## Run: godot --headless --path native-godot --script res://tests/profile_check.gd
## A unique disposable fixture sits beside this test, never in the player save.
const C = preload("res://scripts/cosmo_content.gd")
const P = preload("res://scripts/cosmo_profile.gd")
var failures: Array[String] = []

func expect(ok: bool, label: String) -> void:
	if not ok:
		failures.append(label)

func _initialize() -> void:
	var rows: Array[Dictionary] = C.levels()
	expect(rows.size() == 6 and C.tiers().size() == 13 and C.upgrades().size() == 11 and C.powers().size() == 10, "authentic content inventory")
	expect(rows[0]["duration"] == 90.0 and rows[5]["dl_end"] == 760.0, "authored boundary and finite native ending")
	expect(C.difficulty_at(0, 80.0) == 44.0 and C.difficulty_at(0, 126.0) == 90.0 and C.difficulty_at(4, 0.0) == 470.0, "difficulty changes slope without discontinuity")
	expect(C.orbit_score(4, 5) == 86 and C.orbit_score(0, 50) == 6, "fed orbit score and bare-orbit floor")
	expect(C.star_score(6, true, false, true) == 16 and C.star_score(6, false, true, false, false, false, true, true) == 18, "stacked collection rewards")
	expect(C.black_hole_reward(1.0, 3, 0) == 740, "black-hole reward boundary")
	expect(C.ring_count(11.9) == 1 and C.ring_count(12) == 2 and C.ring_count(40) == 3, "ring unlock boundaries")
	var p = P.new()
	p.profile_path = ProjectSettings.globalize_path("res://tests/.profile_check_%s.json" % OS.get_process_id())
	p.load_profile()
	expect(not FileAccess.file_exists(p.profile_path), "loading does not create a profile")
	expect(p.record_run(5000, 6, 6, true), "selected-start record writes")
	expect(p.data["best"] == 5000 and p.data["unlocked_level"] == 1 and not p.data["completed"], "later start cannot claim a full climb")
	expect(p.record_run(80, 3, 1, false) and p.data["unlocked_level"] == 3, "full-start progress unlocks reached level")
	expect(p.record_run(6000, 6, 1, true) and p.data["completed"] and p.data["unlocked_level"] == 6, "full climb records completion")
	var q = P.new()
	q.profile_path = p.profile_path
	q.load_profile()
	expect(q.data == p.data, "atomic replacement survives reload")
	var bytes: PackedByteArray = FileAccess.get_file_as_bytes(p.profile_path)
	var original: Dictionary = p.data.duplicate(true)
	p.begin_lab()
	expect(not p.record_run(999999, 6, 1, true) and not p.set_preference("muted", true), "lab rejects record and preference writes")
	p.data["best"] = 900000
	expect(not p.save_profile(), "lab rejects explicit saving")
	p.end_lab()
	expect(p.data == original and FileAccess.get_file_as_bytes(p.profile_path) == bytes, "lab restores data and preserves save bytes")
	p.begin_run()
	var rng: RandomNumberGenerator = RandomNumberGenerator.new()
	rng.seed = 4401
	for level: int in range(2, 7):
		var cards: Array[Dictionary] = p.draft(level, rng)
		expect(cards.size() == 3, "three available cards at level %s" % level)
		var seen: Dictionary = {}
		for card: Dictionary in cards:
			expect(not p.run_upgrades.has(card["id"]) and not seen.has(card["id"]), "draft excludes taken and duplicate cards")
			seen[card["id"]] = true
		if not cards.is_empty():
			expect(p.choose_upgrade(cards[0]["id"], level) and not p.choose_upgrade(cards[0]["id"], level), "draft pick works exactly once")
	expect(p.run_upgrades.size() == 5 and not p.choose_upgrade("invented", 3), "five run picks and unknown ID rejected")
	expect(p.save_profile(), "record save after drafting")
	q.load_profile()
	expect(not q.data.has("upgrades") and not q.data.has("bank"), "run upgrades never become a persistent shop")
	DirAccess.remove_absolute(p.profile_path)
	if FileAccess.file_exists(p.profile_path + ".tmp"):
		DirAccess.remove_absolute(p.profile_path + ".tmp")
	print(JSON.stringify({"content_profile": "passed" if failures.is_empty() else "failed", "failures": failures}))
	quit(0 if failures.is_empty() else 1)
