extends Node
## Native host: exactly one physics, input, audio and lifecycle owner.
const Simulation = preload("res://scripts/simulation.gd")
const Gestures = preload("res://scripts/gestures.gd")
const Content = preload("res://scripts/cosmo_content.gd")
const Profile = preload("res://scripts/cosmo_profile.gd")
const Backdrop = preload("res://scripts/living_backdrop.gd")
const Audio = preload("res://scripts/reactive_audio.gd")
const Spatial = preload("res://scripts/spatial_world.gd")
var sim = Simulation.new()
var gestures = Gestures.new()
var profile = Profile.new()
var backdrop
var spatial
var music
var hud: Control
var page: Control
var stats: Label
var level_label: Label
var status: Label
var instruction: Label
var progress: ProgressBar
var pause_button: Button
var skip_button: Button
var mode = "menu"
var menu_time = 0.0
var instruction_left = 0.0
var hud_clock = 0.0
var ui_size = Vector2(540, 960)
var safe_top = 30.0
var safe_bottom = 28.0
var last_haptic = -1000.0
var run_won = false
var capture_time = -1.0
var capture_output = ""
var automated = false
var auto_elapsed = 0.0
var auto_duration = 20.0
var shutting_down = false
var _font: SystemFont
const CYAN = Color("74ecf8")
const GOLD = Color("e6bf76")
const INK = Color("08101e")

func _ready() -> void:
	get_tree().auto_accept_quit = false
	Input.use_accumulated_input = false
	_font = SystemFont.new()
	_font.font_names = PackedStringArray(["Bahnschrift", "Avenir Next", "Segoe UI"])
	profile.load_profile()
	gestures.mode = str(profile.data.swipe_mode)
	var back_layer = CanvasLayer.new()
	back_layer.layer = -10
	add_child(back_layer)
	backdrop = Backdrop.new()
	back_layer.add_child(backdrop)
	spatial = Spatial.new()
	add_child(spatial)
	spatial.set_reduced_motion(bool(profile.data.reduced_motion))
	music = Audio.new()
	music.name = "ReactiveAudioEngine"
	add_child(music)
	music.set_muted(bool(profile.data.muted))
	var ui_layer = CanvasLayer.new()
	ui_layer.layer = 10
	add_child(ui_layer)
	hud = Control.new()
	hud.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	hud.mouse_filter = Control.MOUSE_FILTER_IGNORE
	ui_layer.add_child(hud)
	hud.theme = _theme()
	stats = _label(hud, "", 25, Color("eef4f9"))
	level_label = _label(hud, "", 13, Color("bed0dc"))
	status = _label(hud, "", 15, GOLD)
	instruction = _label(hud, "", 20, Color("e0eef6"))
	instruction.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	instruction.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	progress = ProgressBar.new()
	progress.show_percentage = false
	progress.max_value = 1.0
	progress.mouse_filter = Control.MOUSE_FILTER_IGNORE
	hud.add_child(progress)
	pause_button = _button(hud, "Ⅱ", _pause, false)
	skip_button = _button(hud, "Skip introduction", _skip_tutorial, false)
	page = Control.new()
	page.mouse_filter = Control.MOUSE_FILTER_IGNORE
	hud.add_child(page)
	sim.event.connect(_game_event)
	sim.message.connect(_show_instruction)
	sim.ended.connect(_ended)
	gestures.turned.connect(sim.turn)
	gestures.hopped.connect(_hop)
	get_viewport().size_changed.connect(_resize)
	_resize()
	_menu()
	_parse_test_arguments()

func _theme() -> Theme:
	var theme = Theme.new()
	theme.default_font = _font
	theme.default_font_size = 19
	var normal = StyleBoxFlat.new()
	normal.bg_color = Color(0.035, 0.07, 0.11, 0.90)
	normal.border_color = Color(0.31, 0.64, 0.72, 0.42)
	normal.set_border_width_all(1)
	normal.set_corner_radius_all(12)
	normal.content_margin_left = 16
	normal.content_margin_right = 16
	normal.content_margin_top = 13
	normal.content_margin_bottom = 13
	var hover = normal.duplicate()
	hover.bg_color = Color(0.065, 0.18, 0.23, 0.97)
	hover.border_color = CYAN
	var pressed = normal.duplicate()
	pressed.bg_color = Color("13303d")
	theme.set_stylebox("normal", "Button", normal)
	theme.set_stylebox("hover", "Button", hover)
	theme.set_stylebox("pressed", "Button", pressed)
	theme.set_stylebox("focus", "Button", StyleBoxEmpty.new())
	theme.set_color("font_color", "Button", Color("dcebf1"))
	theme.set_color("font_hover_color", "Button", Color.WHITE)
	var track = StyleBoxFlat.new()
	track.bg_color = Color(0.16, 0.29, 0.35, 0.25)
	var fill = StyleBoxFlat.new()
	fill.bg_color = Color(0.30, 0.67, 0.73, 0.70)
	theme.set_stylebox("background", "ProgressBar", track)
	theme.set_stylebox("fill", "ProgressBar", fill)
	return theme

func _resize() -> void:
	ui_size = get_viewport().get_visible_rect().size
	safe_top = 30.0
	safe_bottom = 28.0
	if OS.has_feature("mobile"):
		var safe = DisplayServer.get_display_safe_area()
		var window_size = DisplayServer.window_get_size()
		var scale_y = ui_size.y / maxf(1.0, window_size.y)
		safe_top = maxf(24.0, float(safe.position.y) * scale_y + 12.0)
		safe_bottom = maxf(24.0, float(window_size.y - safe.end.y) * scale_y + 12.0)
	var horizontal = minf(ui_size.x * 0.405, maxf(100.0, (ui_size.y - safe_top - safe_bottom - 240.0) / 2.826))
	sim.geometry.center = ui_size * 0.5
	sim.geometry.radii = Vector2(horizontal, horizontal * 1.413)
	backdrop.configure(ui_size, sim.geometry.center, sim.geometry.radii)
	spatial.configure(ui_size, sim.geometry.center, sim.geometry.radii)
	stats.position = Vector2(30, safe_top)
	stats.size = Vector2(ui_size.x - 120, 68)
	level_label.position = Vector2(30, safe_top + 38)
	level_label.size = Vector2(ui_size.x - 120, 20)
	status.position = Vector2(30, safe_top + 77)
	status.size = Vector2(ui_size.x - 60, 42)
	pause_button.position = Vector2(ui_size.x - 82, safe_top - 2)
	pause_button.size = Vector2(52, 48)
	progress.position = Vector2(30, safe_top + 64)
	progress.size = Vector2(ui_size.x - 60, 2)
	instruction.position = Vector2(35, ui_size.y - safe_bottom - 102)
	instruction.size = Vector2(ui_size.x - 70, 62)
	skip_button.position = Vector2(ui_size.x * 0.5 - 115, ui_size.y - safe_bottom - 47)
	skip_button.size = Vector2(230, 40)
	page.size = ui_size
	if mode != "play" and is_instance_valid(page):
		_rebuild_page()

func _physics_process(dt: float) -> void:
	gestures.tick(dt)
	if mode == "play":
		sim.step(dt)
		instruction_left = maxf(0.0, instruction_left - dt)
		if automated:
			_auto_play(dt)

func _process(dt: float) -> void:
	if automated:
		auto_elapsed += dt
		if auto_elapsed >= auto_duration and capture_output.is_empty():
			print(JSON.stringify({"native_game_smoke":"passed" if mode == "play" else "ended", "seconds":sim.time, "score":sim.score, "orbits":sim.orbits, "objects":sim.count_kind("hazard"), "mode":mode}))
			_quit_cleanly(0)
			return
	if mode in ["menu", "levels", "settings", "labselect"]:
		menu_time += dt
		sim.angle += dt * 0.38
		sim.visual_time = menu_time
		sim.travel = menu_time * 55.0
		sim.lane = 1.0
		sim.target_lane = 1
		sim.rings = 3
	var release = 0.0
	if sim.starfall_left > 0.0:
		var elapsed = Content.STARFALL_SECONDS - sim.starfall_left
		release = minf(1.0, elapsed / 0.9) * minf(1.0, sim.starfall_left / 1.2)
	backdrop.update_world(sim.visual_time, sim.angle, sim.lane, sim.travel, float(sim.charge) / Content.starfall_need(sim.upgrades), release, 1.0 if sim.has_power("spot") else 0.0, bool(profile.data.reduced_motion))
	spatial.update_simulation(sim, 0.0 if mode in ["pause", "result", "draft"] else dt)
	hud_clock += dt
	if hud_clock >= 0.08:
		hud_clock = 0.0
		_update_hud()
		music.set_lane(sim.target_lane)
		music.set_intensity(clampf(sim.flow * 0.7 + sim.difficulty / 1500.0 + (0.35 if sim.starfall_left > 0.0 else 0.0), 0.0, 1.0))
		music.set_dilated(sim.has_power("warp") or sim.black_hole)
	if capture_time >= 0.0:
		capture_time -= dt
		if capture_time < 0.0:
			_capture.call_deferred()

func _update_hud() -> void:
	var visible_play = mode in ["play", "pause"]
	stats.visible = visible_play
	level_label.visible = visible_play
	status.visible = visible_play
	progress.visible = visible_play
	pause_button.visible = mode == "play"
	skip_button.visible = mode == "play" and sim.tutorial >= 0
	instruction.visible = mode == "play" and instruction_left > 0.0
	if not visible_play:
		return
	var level = Content.level_at(sim.level_index)
	stats.text = str(sim.score).pad_zeros(4)
	stats.add_theme_font_size_override("font_size", 29)
	level_label.text = "POWER LAB" if sim.lab else str(level.name)
	var pips = ""
	for i in sim.shields:
		pips += "◈ "
	var state_text = "Shields %s" % pips
	if sim.black_hole:
		state_text += "   ·   %s" % ("Escape %ds" % ceili(17.0 - sim.bh_time) if sim.bh_time >= 12.0 else "Charge %d%%" % roundi(sim.bh_charge * 100))
	elif sim.starfall_left > 0.0:
		state_text += "   ·   Starfall %ds" % ceili(sim.starfall_left)
	else:
		state_text += "   ·   Starfall %d/%d" % [sim.charge, Content.starfall_need(sim.upgrades)]
		for power in Content.powers():
			if sim.has_power(str(power.id)):
				state_text += "\n%s %ds" % [str(power.name).capitalize(), ceili(float(sim.powers[power.id]))]
				break
	status.text = state_text
	progress.value = clampf((sim.difficulty - float(level.dl_start)) / float(level.duration), 0.0, 1.0)

func _label(parent: Node, text_value: String, font_size: int, color: Color) -> Label:
	var label = Label.new()
	label.text = text_value
	label.add_theme_font_size_override("font_size", font_size)
	label.add_theme_color_override("font_color", color)
	label.mouse_filter = Control.MOUSE_FILTER_IGNORE
	parent.add_child(label)
	return label

func _button(parent: Node, title: String, callback: Callable, primary: bool = false) -> Button:
	var button = Button.new()
	button.text = title
	button.custom_minimum_size = Vector2(0, 54)
	button.focus_mode = Control.FOCUS_NONE
	if primary:
		var box = StyleBoxFlat.new()
		box.bg_color = Color("a7e7ed")
		box.set_corner_radius_all(12)
		button.add_theme_stylebox_override("normal", box)
		button.add_theme_color_override("font_color", INK)
		button.add_theme_font_size_override("font_size", 22)
	button.pressed.connect(callback)
	parent.add_child(button)
	return button

func _clear_page() -> void:
	for child in page.get_children():
		page.remove_child(child)
		child.queue_free()

func _column(y: float, width: float = 390.0) -> VBoxContainer:
	var column = VBoxContainer.new()
	var w = minf(width, ui_size.x - 60)
	column.position = Vector2((ui_size.x - w) * 0.5, y)
	column.size = Vector2(w, 0)
	column.add_theme_constant_override("separation", 12)
	page.add_child(column)
	return column

func _heading(title: String, subtitle: String = "") -> void:
	var heading = _label(page, title, 30, Color("f0ece3"))
	heading.position = Vector2(30, safe_top + 20)
	heading.size = Vector2(ui_size.x - 60, 44)
	heading.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	if not subtitle.is_empty():
		var sub = _label(page, subtitle, 17, Color("a5bdc9"))
		sub.position = Vector2(38, safe_top + 70)
		sub.size = Vector2(ui_size.x - 76, 50)
		sub.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		sub.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER

func _shade() -> void:
	var shade = ColorRect.new()
	shade.color = Color(0.005, 0.012, 0.025, 0.75)
	shade.size = ui_size
	shade.mouse_filter = Control.MOUSE_FILTER_IGNORE
	page.add_child(shade)

func _menu() -> void:
	gestures.cancel()
	if profile.lab_active:
		profile.end_lab()
		music.set_muted(bool(profile.data.muted))
	mode = "menu"
	sim.running = false
	sim.paused = false
	sim.black_hole = false
	sim.powers.clear()
	sim.starfall_left = 0.0
	sim.charge = 0
	for obj in sim.objects:
		obj.active = false
	music.stop_run()
	backdrop.set_world(0)
	backdrop.reset_effects()
	spatial.clear_trail()
	_rebuild_page()

func _rebuild_page() -> void:
	_clear_page()
	match mode:
		"menu":
			var logo = TextureRect.new()
			logo.texture = preload("res://assets/cosmo-wordmark.webp")
			logo.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
			logo.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
			logo.position = Vector2(45, safe_top + 12)
			logo.size = Vector2(ui_size.x - 90, 126)
			logo.mouse_filter = Control.MOUSE_FILTER_IGNORE
			page.add_child(logo)
			var sub = _label(page, "A  L I V I N G  U N I V E R S E", 14, Color("bed3dd"))
			sub.position = Vector2(0, safe_top + 142)
			sub.size.x = ui_size.x
			sub.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
			var col = _column(ui_size.y - safe_bottom - 282)
			_button(col, "LAUNCH", _launch, true)
			var row = HBoxContainer.new()
			row.add_theme_constant_override("separation", 10)
			col.add_child(row)
			_button(row, "Passages", _show_levels).size_flags_horizontal = Control.SIZE_EXPAND_FILL
			_button(row, "Power lab", _show_lab).size_flags_horizontal = Control.SIZE_EXPAND_FILL
			var row2 = HBoxContainer.new()
			row2.add_theme_constant_override("separation", 10)
			col.add_child(row2)
			_button(row2, "Learn to play", func(): _start(0, true)).size_flags_horizontal = Control.SIZE_EXPAND_FILL
			_button(row2, "Settings", _settings).size_flags_horizontal = Control.SIZE_EXPAND_FILL
			var record = _label(col, "BEST  %s" % str(profile.data.best).pad_zeros(4), 14, GOLD)
			record.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		"levels":
			_shade()
			_heading("THE PASSAGES", "Six places. One continuous journey.")
			var col = _column(safe_top + 145)
			for i in 6:
				var level = Content.level_at(i)
				_button(col, "%02d   %s" % [i + 1, level.name], _start.bind(i, false))
			_button(col, "Back", _menu)
		"settings":
			_shade()
			_heading("SETTINGS")
			var col = _column(safe_top + 160)
			_button(col, "Sound: %s" % ("off" if profile.data.muted else "on"), _toggle_sound)
			_button(col, "Reduced motion: %s" % ("on" if profile.data.reduced_motion else "off"), _toggle_motion)
			_button(col, "Swipe: %s" % ("up / down" if profile.data.swipe_mode == "screen" else "toward / away"), _toggle_swipe)
			_button(col, "Back", _menu)
		"labselect":
			_shade()
			_heading("POWER LAB", "Try each power. Practice never changes your records.")
			var scroll = ScrollContainer.new()
			scroll.position = Vector2(30, safe_top + 135)
			scroll.size = Vector2(ui_size.x - 60, ui_size.y - safe_top - safe_bottom - 205)
			page.add_child(scroll)
			var col = VBoxContainer.new()
			col.size_flags_horizontal = Control.SIZE_EXPAND_FILL
			col.add_theme_constant_override("separation", 8)
			scroll.add_child(col)
			for power in Content.powers():
				_button(col, str(power.name), _start_lab.bind(str(power.id)))
			_button(col, "STARFALL", _start_lab.bind("starfall"))
			var back = _button(page, "Back", _menu)
			back.position = Vector2(30, ui_size.y - safe_bottom - 55)
			back.size = Vector2(ui_size.x - 60, 54)
		"pause":
			_shade()
			_heading("FLIGHT PAUSED", "Your orbit is waiting.")
			var col = _column(ui_size.y * 0.56)
			_button(col, "RESUME", _resume, true)
			_button(col, "Sound: %s" % ("off" if profile.data.muted else "on"), _toggle_sound)
			if sim.lab:
				_button(col, "Choose another power", _show_lab)
			_button(col, "Return to title", _menu)
		"result":
			_shade()
			_heading("PASSAGE COMPLETE" if run_won else "COMET LOST", Content.level_at(sim.level_index).name)
			var col = _column(ui_size.y * 0.36)
			var points = _label(col, str(sim.score).pad_zeros(4), 58, GOLD)
			points.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
			var sub = _label(col, "%d orbits completed" % sim.orbits, 18, Color("bed1dc"))
			sub.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
			if run_won and sim.level_index < 5:
				_button(col, "CONTINUE", _show_draft, true)
			elif run_won:
				_label(col, "The passage opens into quiet space.", 18, CYAN)
				_button(col, "FLY AGAIN", _launch, true)
			else:
				var tip = "Tap to turn, or swipe to another ring."
				if sim.last_hit in ["gate", "driftgate"]:
					tip = "A wall fills every ring. Tap to turn away."
				elif sim.last_hit == "funnel":
					tip = "Swipe into the ring with an open gap."
				elif sim.last_hit == "black hole":
					tip = "At Escape, reach the outermost ring."
				var coach = _label(col, tip, 18, Color("bdcfd8"))
				coach.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
				_button(col, "RETRY", _start.bind(sim.level_index, false), true)
			_button(col, "Return to title", _menu)
		"draft":
			_shade()
			_heading("TAKE ONE WITH YOU", "An upgrade for the rest of this journey.")
			var col = _column(ui_size.y * 0.38)
			for upgrade in profile.draft(sim.level_index + 2, sim.rng):
				var b = _button(col, "%s\n%s" % [upgrade.name, upgrade.description], _pick_upgrade.bind(str(upgrade.id)))
				b.add_theme_font_size_override("font_size", 17)
				b.custom_minimum_size.y = 85
	_update_hud()

func _launch() -> void:
	_start(0, not bool(profile.data.tutorial_seen))

func _start(index: int, teach: bool = false, carry: bool = false) -> void:
	gestures.cancel()
	if profile.lab_active:
		profile.end_lab()
	if not carry:
		profile.begin_run()
	mode = "play"
	_clear_page()
	if teach and not bool(profile.data.tutorial_seen):
		profile.set_preference("swipe_mode", "screen")
	gestures.mode = str(profile.data.swipe_mode)
	sim.begin(index, false, teach, carry)
	if carry:
		for id in profile.run_upgrades:
			if str(id) not in sim.upgrades:
				sim.upgrades.append(str(id))
	sim.shields = 3 if "deepbank" in sim.upgrades else 2
	backdrop.set_world(int(Content.level_at(index).world))
	backdrop.reset_effects()
	spatial.clear_trail()
	music.stop_run()
	music.set_tonic(int(Content.level_at(index).tonic_midi))
	music.start_run()
	_update_hud()

func _start_lab(id: String) -> void:
	if not profile.lab_active:
		profile.begin_lab()
	mode = "play"
	_clear_page()
	sim.lab_power = "bh" if id == "blackhole" else id
	sim.begin(0, true)
	backdrop.reset_effects()
	spatial.clear_trail()
	music.start_run()
	_update_hud()

func _show_levels() -> void:
	mode = "levels"
	_rebuild_page()

func _show_lab() -> void:
	gestures.cancel()
	sim.running = false
	music.stop_run()
	mode = "labselect"
	_rebuild_page()

func _settings() -> void:
	mode = "settings"
	_rebuild_page()

func _pause() -> void:
	if mode != "play":
		return
	mode = "pause"
	sim.paused = true
	gestures.cancel()
	music.set_paused(true)
	_rebuild_page()

func _resume() -> void:
	mode = "play"
	sim.paused = false
	gestures.cancel()
	music.set_paused(false)
	_clear_page()
	_update_hud()

func _toggle_sound() -> void:
	var muted = not bool(profile.data.muted)
	if profile.lab_active:
		profile.data.muted = muted # Snapshot restored on lab exit; no persistent write.
	else:
		profile.set_preference("muted", muted)
	music.set_muted(muted)
	_rebuild_page()

func _toggle_motion() -> void:
	profile.set_preference("reduced_motion", not bool(profile.data.reduced_motion))
	spatial.set_reduced_motion(bool(profile.data.reduced_motion))
	_rebuild_page()

func _toggle_swipe() -> void:
	profile.set_preference("swipe_mode", "radial" if profile.data.swipe_mode == "screen" else "screen")
	gestures.mode = str(profile.data.swipe_mode)
	_rebuild_page()

func _show_draft() -> void:
	mode = "draft"
	_rebuild_page()

func _pick_upgrade(id: String) -> void:
	if profile.choose_upgrade(id, sim.level_index + 2):
		_start(sim.level_index + 1, false, true)

func _skip_tutorial() -> void:
	sim.finish_tutorial()
	profile.set_preference("tutorial_seen", true)

func _hop(delta: int) -> void:
	var previous = sim.target_lane
	sim.hop(delta)
	if sim.target_lane != previous:
		backdrop.react_hop(float(delta))

func _game_event(kind: StringName) -> void:
	if kind == &"turn":
		backdrop.react_turn(sim.direction)
	if kind == &"tutorial_done":
		profile.set_preference("tutorial_seen", true)
		return
	music.cue(kind)
	if kind in [&"hit", &"orbit", &"graze"] and sim.time - last_haptic >= 0.18 and OS.has_feature("mobile"):
		last_haptic = sim.time
		Input.vibrate_handheld(20 if kind == &"hit" else 10)

func _show_instruction(text_value: String, seconds: float) -> void:
	# Escape/tutorial own the single message line; ordinary pickup cues stay compact.
	if sim.tutorial >= 0 and seconds < 10.0:
		return
	instruction.text = text_value
	instruction_left = seconds

func _ended(won: bool) -> void:
	gestures.cancel()
	run_won = won
	mode = "result"
	music.stop_run()
	music.cue(&"finish" if won else &"hit")
	if not sim.lab and not automated:
		profile.record_run(sim.score, sim.level_index + 1, sim.start_level + 1, won)
	_rebuild_page()

func _notification(what: int) -> void:
	if what == NOTIFICATION_WM_CLOSE_REQUEST:
		_quit_cleanly(0)
	elif what in [NOTIFICATION_APPLICATION_FOCUS_OUT, NOTIFICATION_APPLICATION_PAUSED]:
		if is_instance_valid(music):
			_pause()
	elif what == NOTIFICATION_WM_GO_BACK_REQUEST:
		if mode == "play":
			_pause()
		elif mode != "menu":
			_menu()

func _input(event: InputEvent) -> void:
	if mode != "play" or gestures.finger == -1:
		return
	if event is InputEventScreenTouch and not event.pressed:
		gestures.end(event.index, event.position, event.canceled)
		get_viewport().set_input_as_handled()
	elif event is InputEventScreenDrag:
		gestures.motion(event.index, event.position)
		get_viewport().set_input_as_handled()
	elif event is InputEventMouseButton and event.button_index == MOUSE_BUTTON_LEFT and not event.pressed:
		gestures.end(0, event.position)
		get_viewport().set_input_as_handled()
	elif event is InputEventMouseMotion and gestures.finger == 0:
		gestures.motion(0, event.position)

func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventKey and event.pressed and not event.echo:
		if event.keycode in [KEY_ESCAPE, KEY_P]:
			if mode == "play": _pause()
			elif mode == "pause": _resume()
		elif mode == "play":
			if event.keycode in [KEY_SPACE, KEY_ENTER]: sim.turn()
			elif event.keycode in [KEY_UP, KEY_W]: _hop(-1)
			elif event.keycode in [KEY_DOWN, KEY_S]: _hop(1)
		elif mode == "menu" and event.keycode in [KEY_SPACE, KEY_ENTER]:
			_launch()
		return
	if mode != "play":
		return
	if event is InputEventScreenTouch and event.pressed:
		gestures.begin(event.index, event.position, sim.geometry.center)
	elif event is InputEventMouseButton and event.button_index == MOUSE_BUTTON_LEFT and event.pressed:
		gestures.begin(0, event.position, sim.geometry.center)

func _parse_test_arguments() -> void:
	for arg in OS.get_cmdline_user_args():
		if arg.begins_with("--capture="):
			capture_output = arg.trim_prefix("--capture=")
			capture_time = 2.0
		elif arg.begins_with("--play="):
			_start(clampi(int(arg.trim_prefix("--play=")) - 1, 0, 5), false)
		elif arg.begins_with("--lab="):
			_start_lab(arg.trim_prefix("--lab="))
		elif arg == "--autoplay":
			automated = true
		elif arg.begins_with("--seconds="):
			auto_duration = float(arg.trim_prefix("--seconds="))
			capture_time = auto_duration if not capture_output.is_empty() else -1.0

func _auto_play(dt: float) -> void:
	# Test driver uses the same controls, not a scoring or invulnerability bypass.
	for obj in sim.objects:
		if obj.active and obj.kind == "hazard" and obj.lethal() and int(obj.lane) == sim.target_lane:
			var ahead = fposmod((obj.angle - sim.angle) * sim.direction, TAU)
			if ahead < 0.6:
				if sim.rings > 1: _hop(1 if sim.target_lane == 0 else -1)
				else: sim.turn()
				break

func _capture() -> void:
	await RenderingServer.frame_post_draw
	var image = get_viewport().get_texture().get_image()
	var err = image.save_png(capture_output)
	print("CAPTURE ", capture_output, " error=", err, " state=", mode, " score=", sim.score)
	_quit_cleanly(0 if err == OK else 1)

func _quit_cleanly(code: int = 0) -> void:
	if shutting_down:
		return
	shutting_down = true
	set_process(false)
	set_physics_process(false)
	set_process_input(false)
	set_process_unhandled_input(false)
	gestures.cancel()
	if is_instance_valid(music):
		await music.shutdown()
	get_tree().quit(code)

func _exit_tree() -> void:
	gestures.cancel()
	if is_instance_valid(music):
		music.stop_run()
