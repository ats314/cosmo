extends Node
## Native, optional musical transport. No runtime per-sample synthesis.
## All tonal stems are rendered at 104 BPM in each world key; pitch_scale never
## changes the music clock. Motion cues transpose their root/fifth vocabulary.

signal cue_started(kind: StringName)
signal shutdown_complete

const BPM: float = 104.0
const BEAT_SECONDS: float = 60.0 / BPM
const LOOP_SECONDS: float = 32.0 * BEAT_SECONDS
const TONICS: Array[int] = [69, 67, 65, 63, 61, 59]
const CONTENT = preload("res://scripts/cosmo_content.gd")
const NATURAL_MINOR: Array[int] = [0, 2, 3, 5, 7, 8, 10]
const STEM_NAMES: Array[String] = ["bed", "pulse", "drums", "answer"]
const VOICE_COUNT: int = 8

var _music: AudioStreamPlayer
var _special: AudioStreamPlayer
var _synchronized: AudioStreamSynchronized
var _filter: AudioEffectLowPassFilter
var _voices: Array[AudioStreamPlayer] = []
var _cue_streams: Dictionary = {}
var _queued: Array[Dictionary] = []
var _cooldowns: Dictionary = {}
var _bus_name: StringName
var _running: bool = false
var _paused: bool = false
var _muted: bool = false
var _dilated: bool = false
var _tonic: int = 69
var _pending_tonic: int = 69
var _chord_roots: Array[int] = [0, 8, 3, 10]
var _switch_at: float = -1.0
var _lane: int = 0
var _intensity: float = 0.0
var _energy: float = 0.0
var _clock_seconds: float = 0.0
var _fallback_seconds: float = 0.0
var _raw_previous: float = 0.0
var _raw_still_time: float = 0.0
var _loop_count: int = 0
var _latency: float = 0.0
var _fade: float = 0.0
var _duck: float = 1.0
var _duck_until: float = -1.0
var _special_start: float = -1.0
var _special_until: float = -1.0
var _next_voice: int = 0
var _shutting_down: bool = false
var _shutdown_done: bool = false


func _ready() -> void:
	# The owner pauses explicitly; this node must also receive the resume call.
	process_mode = Node.PROCESS_MODE_ALWAYS
	_bus_name = StringName("CosmoNative_%s" % get_instance_id())
	AudioServer.add_bus()
	var bus_index: int = AudioServer.bus_count - 1
	AudioServer.set_bus_name(bus_index, _bus_name)
	_filter = AudioEffectLowPassFilter.new()
	_filter.cutoff_hz = 7600.0
	_filter.resonance = 0.15
	_filter.db = AudioEffectFilter.FILTER_12DB
	AudioServer.add_bus_effect(bus_index, _filter)
	var limiter: AudioEffectHardLimiter = AudioEffectHardLimiter.new()
	limiter.ceiling_db = -1.0
	limiter.release = 0.12
	AudioServer.add_bus_effect(bus_index, limiter)
	_latency = AudioServer.get_output_latency()
	_music = _make_player("Music")
	_special = _make_player("Release")
	_special.volume_db = linear_to_db(0.76)
	for index: int in range(VOICE_COUNT):
		_voices.append(_make_player("Cue%d" % index))
	for cue_name: String in ["turn", "hop", "star", "orbit", "magnet", "hit"]:
		var stream: AudioStreamWAV = _load_wav(cue_name)
		if stream != null:
			_cue_streams[StringName(cue_name)] = stream
	_apply_tonic(_pending_tonic)
	set_muted(_muted)


func _make_player(player_name: String) -> AudioStreamPlayer:
	var player: AudioStreamPlayer = AudioStreamPlayer.new()
	player.name = player_name
	player.bus = _bus_name
	player.process_mode = Node.PROCESS_MODE_ALWAYS
	add_child(player)
	return player


func _load_wav(asset_name: String, looping: bool = false) -> AudioStreamWAV:
	var asset_path: String = "res://audio/%s.wav" % asset_name
	if not ResourceLoader.exists(asset_path):
		return null
	var resource: AudioStreamWAV = load(asset_path) as AudioStreamWAV
	if resource == null:
		return null
	var stream: AudioStreamWAV = resource.duplicate() as AudioStreamWAV
	if looping:
		stream.loop_begin = 0
		stream.loop_end = roundi(stream.get_length() * float(stream.mix_rate))
		stream.loop_mode = AudioStreamWAV.LOOP_FORWARD
	else:
		stream.loop_mode = AudioStreamWAV.LOOP_DISABLED
	return stream


func _apply_tonic(midi: int) -> void:
	_tonic = midi
	_pending_tonic = midi
	_chord_roots.clear()
	var level: Dictionary = CONTENT.level_at(TONICS.find(midi))
	for degree: int in level["chord_degrees"]:
		_chord_roots.append(NATURAL_MINOR[degree])
	_switch_at = -1.0
	if _music == null:
		return
	var position: float = fposmod(_clock_seconds, LOOP_SECONDS)
	_music.stop()
	_synchronized = AudioStreamSynchronized.new()
	_synchronized.stream_count = STEM_NAMES.size()
	for index: int in range(STEM_NAMES.size()):
		var stream: AudioStreamWAV = _load_wav("%s_%d" % [STEM_NAMES[index], _tonic], true)
		if stream != null:
			_synchronized.set_sync_stream(index, stream)
		_synchronized.set_sync_stream_volume(index, -80.0)
	_music.stream = _synchronized
	_cue_streams[&"starfall"] = _load_wav("starfall_%d" % _tonic)
	_cue_streams[&"finish"] = _load_wav("finish_%d" % _tonic)
	_raw_previous = position
	_loop_count = floori(_clock_seconds / LOOP_SECONDS)
	_fade = 0.0
	if _running:
		_music.play(position)
		_music.stream_paused = _paused


func start_run() -> void:
	if _shutting_down:
		return
	stop_run()
	_apply_tonic(_pending_tonic)
	_running = true
	_music.volume_db = -80.0
	_music.play()
	_music.stream_paused = false


func stop_run() -> void:
	_running = false
	_paused = false
	_queued.clear()
	_cooldowns.clear()
	if _music != null:
		_music.stop()
	if _special != null:
		_special.stop()
	for player: AudioStreamPlayer in _voices:
		player.stop()
	_clock_seconds = 0.0
	_fallback_seconds = 0.0
	_raw_previous = 0.0
	_raw_still_time = 0.0
	_loop_count = 0
	_fade = 0.0
	_energy = 0.0
	_intensity = 0.0
	_lane = 0
	_duck = 1.0
	_duck_until = -1.0
	_special_start = -1.0
	_special_until = -1.0
	_switch_at = -1.0
	_dilated = false


func set_paused(value: bool) -> void:
	if _paused == value:
		return
	_paused = value
	if _music != null:
		_music.stream_paused = value
	if _special != null:
		_special.stream_paused = value
	# No abandoned pickup tails or delayed action cues escape after resume.
	for player: AudioStreamPlayer in _voices:
		player.stop()
	_queued.clear()
	if not value:
		_latency = AudioServer.get_output_latency()
		_raw_still_time = 0.0


func set_muted(value: bool) -> void:
	_muted = value
	var bus_index: int = AudioServer.get_bus_index(_bus_name)
	if bus_index >= 0:
		AudioServer.set_bus_mute(bus_index, value)
	if value:
		_queued.clear()
		for player: AudioStreamPlayer in _voices:
			player.stop()


func set_intensity(value: float) -> void:
	_intensity = clampf(value, 0.0, 1.0)


func set_lane(value: int) -> void:
	_lane = clampi(value, 0, 3)


func set_tonic(midi: int) -> void:
	var chosen: int = TONICS[0]
	for candidate: int in TONICS:
		if absi(candidate - midi) < absi(chosen - midi):
			chosen = candidate
	if chosen == _pending_tonic and _switch_at >= 0.0:
		return
	_pending_tonic = chosen
	if chosen == _tonic:
		_switch_at = -1.0
		return
	if not _running or _paused:
		_apply_tonic(chosen)
	else:
		# A short fade at a bar boundary preserves both tempo and phrase position.
		var after: float = maxf(_clock_seconds, _special_until)
		_switch_at = (floorf(after / (4.0 * BEAT_SECONDS)) + 1.0) * 4.0 * BEAT_SECONDS


func set_dilated(value: bool) -> void:
	_dilated = value


func beat_position() -> float:
	return _clock_seconds / BEAT_SECONDS


func cue(kind: StringName) -> void:
	if _paused or _shutting_down:
		return
	if not _running and kind != &"finish":
		return
	var sound: StringName = kind
	match kind:
		&"nova", &"shield": sound = &"orbit"
		&"hypernova": sound = &"starfall"
		&"slowmo", &"dilation": sound = &"magnet"
		&"scorch", &"slipstream": sound = &"hop"
		&"mirror", &"graze": sound = &"star"
	if not _cue_streams.has(sound):
		return
	if _muted or _cue_streams[sound] == null:
		cue_started.emit(kind)
		return
	var cooldown: float = 0.045 if sound == &"star" else 0.075
	if sound == &"hit":
		cooldown = 0.24
	if _clock_seconds < float(_cooldowns.get(sound, -100.0)) + cooldown:
		return
	_cooldowns[sound] = _clock_seconds
	if sound == &"starfall":
		if _special_until > _clock_seconds:
			return
		for item: Dictionary in _queued:
			if item["sound"] == &"starfall":
				return
		# Reward gameplay is owned by the scene. Its immediate pickup acknowledgement
		# is audible now; the complete four-bar answer lands on the next quarter.
		_play_cue(&"orbit", 0.52)
		_queue(kind, sound, BEAT_SECONDS)
	elif sound == &"orbit":
		_play_cue(&"star", 0.35)
		_queue(kind, sound, BEAT_SECONDS * 0.25)
	else:
		_play_cue(sound)
		cue_started.emit(kind)


func _queue(kind: StringName, sound: StringName, grid: float) -> void:
	var at: float = (floorf((_clock_seconds + _latency) / grid) + 1.0) * grid
	if _queued.size() < 8:
		_queued.append({"kind": kind, "sound": sound, "at": at, "played": false})


func _play_cue(sound: StringName, gain: float = 0.7) -> void:
	var stream: AudioStream = _cue_streams.get(sound) as AudioStream
	if stream == null or _muted or _paused:
		return
	if sound == &"starfall" or sound == &"finish":
		_special.stop()
		_special.stream = stream
		_special.pitch_scale = 1.0
		_special.stream_paused = false
		_special.play()
		return
	var player: AudioStreamPlayer = _voices[_next_voice]
	_next_voice = (_next_voice + 1) % VOICE_COUNT
	player.stop()
	player.stream = stream
	var chord: int = floori(beat_position() / 4.0) % _chord_roots.size()
	var root_interval: int = _chord_roots[chord]
	if _special_until > _clock_seconds and _special_start >= 0.0:
		chord = clampi(floori((_clock_seconds - _special_start) / (4.0 * BEAT_SECONDS)), 0, 3)
		root_interval = _chord_roots[chord]
	# Keep the same chord tone in a close register, rather than brightening cues
	# by nearly an octave when the progression reaches its VI or VII chord.
	if root_interval > 5:
		root_interval -= 12
	var semitones: int = _tonic - 69 + root_interval
	if sound == &"hit":
		semitones = _tonic - 69
		_duck_until = _clock_seconds + 0.25
	if (sound == &"turn" or sound == &"hop") and _lane >= 2:
		semitones += 12
	player.pitch_scale = pow(2.0, float(semitones) / 12.0)
	player.volume_db = linear_to_db(gain)
	player.stream_paused = false
	player.play()


func _process(delta: float) -> void:
	if _paused:
		return
	if _filter != null:
		_filter.cutoff_hz = lerpf(_filter.cutoff_hz, 950.0 if _dilated else 7600.0, 1.0 - exp(-delta * 5.0))
	if not _running:
		return
	_update_clock(delta)
	var mix_lead: float = _latency + AudioServer.get_time_to_next_mix()
	for index: int in range(_queued.size() - 1, -1, -1):
		var item: Dictionary = _queued[index]
		var at: float = float(item["at"])
		if not bool(item["played"]) and _clock_seconds + mix_lead >= at:
			_play_cue(item["sound"])
			item["played"] = true
			if item["sound"] == &"starfall":
				_special_start = at
				_special_until = at + 16.0 * BEAT_SECONDS
		if _clock_seconds >= at:
			cue_started.emit(item["kind"])
			_queued.remove_at(index)
	var switch_gain: float = 1.0
	if _switch_at >= 0.0:
		switch_gain = clampf((_switch_at - _clock_seconds) / 0.16, 0.0, 1.0)
		if _clock_seconds >= _switch_at:
			_apply_tonic(_pending_tonic)
	var target: float = clampf(_intensity + float(_lane) * 0.1, 0.0, 1.0)
	_energy = lerpf(_energy, target, 1.0 - exp(-delta * (2.2 if target > _energy else 0.7)))
	var duck_target: float = 0.06 if _clock_seconds < _special_until else 1.0
	if _clock_seconds < _duck_until:
		duck_target = minf(duck_target, 0.4)
	_duck = lerpf(_duck, duck_target, 1.0 - exp(-delta * (18.0 if duck_target < _duck else 2.4)))
	_fade = minf(1.0, _fade + delta * 2.0)
	_music.volume_db = linear_to_db(maxf(0.0001, _fade * _duck * switch_gain))
	_synchronized.set_sync_stream_volume(0, linear_to_db(lerpf(0.63, 0.82, _energy)))
	_synchronized.set_sync_stream_volume(1, linear_to_db(lerpf(0.1, 0.82, _energy)))
	_synchronized.set_sync_stream_volume(2, linear_to_db(maxf(0.0001, smoothstep(0.12, 0.78, _energy) * 0.8)))
	_synchronized.set_sync_stream_volume(3, linear_to_db(maxf(0.0001, smoothstep(0.38, 0.9, _energy) * 0.7)))


func _update_clock(delta: float) -> void:
	_fallback_seconds += delta
	if _music == null or not _music.playing:
		_clock_seconds = _fallback_seconds
		return
	var raw: float = fposmod(_music.get_playback_position(), LOOP_SECONDS)
	if raw < _raw_previous - LOOP_SECONDS * 0.5:
		_loop_count += 1
	if absf(raw - _raw_previous) < 0.00001:
		_raw_still_time += delta
	else:
		_raw_still_time = 0.0
	_raw_previous = raw
	var audible: float = float(_loop_count) * LOOP_SECONDS + raw + AudioServer.get_time_since_last_mix() - _latency
	if _raw_still_time > 0.2:
		# Missing/dummy audio devices never stall visual or gameplay timing.
		_clock_seconds = maxf(_clock_seconds, _fallback_seconds)
	else:
		_clock_seconds = maxf(_clock_seconds, audible)
		_fallback_seconds = _clock_seconds


func shutdown() -> void:
	# Call before SceneTree.quit(), while the native mixer can still tick. Waiting
	# inside _exit_tree is too late: the application has already begun teardown.
	if _shutdown_done:
		return
	if _shutting_down:
		await shutdown_complete
		return
	_shutting_down = true
	stop_run()
	set_process(false)
	if _music != null:
		_music.stream = null
	if _special != null:
		_special.stream = null
	for player: AudioStreamPlayer in _voices:
		player.stream = null
	_cue_streams.clear()
	_synchronized = null
	await get_tree().create_timer(0.2, true).timeout
	_remove_bus()
	_shutdown_done = true
	shutdown_complete.emit()


func _remove_bus() -> void:
	var bus_index: int = AudioServer.get_bus_index(_bus_name)
	if bus_index > 0:
		AudioServer.remove_bus(bus_index)


func _exit_tree() -> void:
	stop_run()
	_remove_bus()
