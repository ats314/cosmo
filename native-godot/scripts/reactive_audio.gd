extends Node
## Native, optional musical transport. Two music designs, merged.
##
## The stem transport (kept whole): four pre-rendered stems per key -- bed,
## pulse, drums, answer -- through one AudioStreamSynchronized on a
## latency-compensated clock, with quantized cues, an overdrive layer, dilation
## by low-pass and a careful shutdown. All tonal stems are rendered at 104 BPM in
## each world key; pitch_scale never changes the music clock. Motion cues
## transpose their root/fifth vocabulary.
##
## The original arrangement design, restored on top of it:
##  * A NAMED LAYER LADDER at 600 / 1400 / 2400 / 3600 points. Each rung opens
##    one stem or one band of the mix, announces itself by name through
##    layer_unlocked, plays a quantized fanfare, and is carried by a BOUNDED
##    two-bar peak that then releases back to the calmer ordinary state. Before
##    its rung a layer has not arrived; it is not merely turned down.
##  * PER-RING INSTRUMENT IDENTITY. The player's own notes are a sawtooth on the
##    outer ring, a square in the middle and a bright square inside, transposed
##    by ring, while the mix itself brightens as the comet flies inward.
##  * THE PLAYER'S MELODY AND THE ANSWER. Tap and swipe walk authored chord-tone
##    figures on the sixteenth grid, so movement is a phrase and not a click, and
##    the arrangement's answer stem steps back while the player is playing and
##    replies in the gaps. Tap always turns and swipe always changes ring: this
##    never asks for musical input, it only voices the input the game already has.
##
## The small performer/announcement waveforms are built ONCE at load from
## band-limited harmonic tables written in this file. Everything is original.
## The music itself is still never synthesised per sample at runtime, and every
## pitch remains an interval over the level tonic.

signal cue_started(kind: StringName)
signal eighth_step(step: int)
signal shutdown_complete
## Emitted when a score rung buys a new band layer. rung is 1-4, label is the
## player-facing line ("NEW MUSIC: RHYTHM"). Fires even while muted, so the
## announcement survives a silent game. Nothing in the scene has to listen.
signal layer_unlocked(rung: int, label: String)

const BPM: float = 104.0
const BEAT_SECONDS: float = 60.0 / BPM
const LOOP_SECONDS: float = 32.0 * BEAT_SECONDS
const TONICS: Array[int] = [69, 67, 65, 63, 61, 59]
const CONTENT = preload("res://scripts/cosmo_content.gd")
const NATURAL_MINOR: Array[int] = [0, 2, 3, 5, 7, 8, 10]
const STEM_NAMES: Array[String] = ["bed", "pulse", "drums", "answer"]
const VOICE_COUNT: int = 8

# The playtested score ladder. Lowering these gives a short run the whole
# arrangement and removes the reason to keep scoring; raising them means most
# runs never hear the last two rungs.
const LAYER_AT: Array[int] = [600, 1400, 2400, 3600]
const LAYER_NAME: Array[String] = [
	"NEW MUSIC: RHYTHM", "NEW MUSIC: MELODY", "NEW MUSIC: DEEP BASS", "NEW MUSIC: HIGH NOTES"]
# Which stem each rung buys, indexed by rung. -1 means the rung's new voice is
# not a stem at all, so nothing is spotlit and every stem steps back instead.
const SPOTLIGHT_STEM: Array[int] = [2, 3, 1, -1]

# The player's own figures, as chord-tone indices, walked by consecutive inputs.
# A pause of PHRASE_GAP restarts the phrase.
const TAP_FIGURE: Array[int] = [0, 2, 1, 3, 2, 0, 3, 1]
const HOP_IN_FIGURE: Array[int] = [2, 1, 0, 1]
const HOP_OUT_FIGURE: Array[int] = [1, 2, 3, 2]
const PHRASE_GAP: float = 2.4
const PENT_STEPS: Array[int] = [0, 3, 5, 7, 10]
# Ring depth brightens the whole mix, the way the pad cutoff used to lift.
const RING_LIFT: Array[float] = [0.0, 380.0, 820.0, 1180.0]
const BASE_CUTOFF: float = 7600.0
const OPEN_CUTOFF: float = 11400.0
const DILATED_CUTOFF: float = 950.0

# Performer voice bank. Indices are the order _build_perf_bank fills.
const WAVE_SAW: int = 0
const WAVE_SQUARE: int = 1
const WAVE_BRIGHT: int = 2
const WAVE_SINE: int = 3
const WAVE_SWELL: int = 4
const PERF_RATE: int = 16000
const PERF_REF_HZ: float = 220.0
const PERF_TABLE: int = 256
const PERF_VOICE_COUNT: int = 10
const PERF_FLOOR_HZ: float = 55.0
const PERF_CEILING_HZ: float = 2100.0
const TIGHT_WINDOW: float = 0.032

var _music: AudioStreamPlayer
var _special: AudioStreamPlayer
var _synchronized: AudioStreamSynchronized
var _filter: AudioEffectLowPassFilter
var _voices: Array[AudioStreamPlayer] = []
var _perf_voices: Array[AudioStreamPlayer] = []
var _perf_bank: Array[AudioStreamWAV] = []
var _cue_streams: Dictionary = {}
var _queued: Array[Dictionary] = []
var _perf_queue: Array[Dictionary] = []
var _cooldowns: Dictionary = {}
var _bus_name: StringName
var _running: bool = false
var _paused: bool = false
var _muted: bool = false
var _dilated: bool = false
var _overdrive: bool = false
var _reduced_motion: bool = false
var _break_until: float = -1.0
var _last_eighth: int = 0
var _tonic: int = 69
var _pending_tonic: int = 69
var _chord_roots: Array[int] = [0, 8, 3, 10]
var _chord_degrees: Array[int] = [0, 5, 2, 6]
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
var _tide_until: float = -1.0
var _special_start: float = -1.0
var _special_until: float = -1.0
var _next_voice: int = 0
var _next_perf: int = 0
var _shutting_down: bool = false
var _shutdown_done: bool = false
# Layer ladder
var _layer_index: int = 0
var _layer_seeded: bool = false
var _seed_until: float = -1.0
var _layer_glow_until: float = -1.0
var _spotlight_stem: int = -1
var _spotlight_until: float = -1.0
var _score_value: int = 0
var _score_proxy: int = 0
var _score_external: bool = false
var _drums_open: float = 0.0
var _melody_open: float = 0.0
var _bass_open: float = 0.0
# Performer / call and answer
var _perf_ready: bool = false
var _perf_index: int = 0
var _perf_slot: float = -1000.0
var _perf_last: float = -1000.0
var _play_heat: float = 0.0
var _answer_trade: float = 1.0
var _quiet_since: float = 0.0
# The chain. Internal by default; set_groove() hands authority to the scene.
var _groove: int = 0
var _groove_until: float = 0.0
var _groove_external: bool = false
var _timing_bias: float = 0.0
var _timing_samples: int = 0


func _ready() -> void:
	# The owner pauses explicitly; this node must also receive the resume call.
	process_mode = Node.PROCESS_MODE_ALWAYS
	_bus_name = StringName("CosmoNative_%s" % get_instance_id())
	AudioServer.add_bus()
	var bus_index: int = AudioServer.bus_count - 1
	AudioServer.set_bus_name(bus_index, _bus_name)
	_filter = AudioEffectLowPassFilter.new()
	_filter.cutoff_hz = BASE_CUTOFF
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
	# The player's own instrument keeps its own voices, so a burst of pickups can
	# never steal the note that answers the player's last tap.
	for index: int in range(PERF_VOICE_COUNT):
		_perf_voices.append(_make_player("Perf%d" % index))
	for cue_name: String in ["turn", "hop", "star", "orbit", "magnet", "hit"]:
		var stream: AudioStreamWAV = _load_wav(cue_name)
		if stream != null:
			_cue_streams[StringName(cue_name)] = stream
	_build_perf_bank()
	_apply_tonic(_pending_tonic)
	set_muted(_muted)


func _make_player(player_name: String) -> AudioStreamPlayer:
	var player: AudioStreamPlayer = AudioStreamPlayer.new()
	player.name = player_name
	player.bus = _bus_name
	# Web defaults to Sample playback, which bypasses Godot bus effects. Force
	# the native mixer for synchronized stems, low-pass dilation and the limiter.
	player.playback_type = AudioServer.PLAYBACK_TYPE_STREAM
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


# --- The performer voice bank -------------------------------------------------
# Five short original waveforms, rendered once at load from band-limited
# harmonic tables. A table with N partials at PERF_REF_HZ cannot alias in a
# PERF_RATE stream, so no anti-alias pass is needed and no octave costs quality.
# Total cost is about 34k samples and 7k sin() calls, paid once, off the frame.

func _harmonic_table(step: int, harmonics: int, rolloff: float) -> PackedFloat32Array:
	var table: PackedFloat32Array = PackedFloat32Array()
	table.resize(PERF_TABLE)
	var peak: float = 0.0
	var increment: int = maxi(1, step)
	for index: int in range(PERF_TABLE):
		var phase: float = TAU * float(index) / float(PERF_TABLE)
		var value: float = 0.0
		var partial: int = 1
		while partial <= harmonics:
			value += sin(phase * float(partial)) * exp(-rolloff * float(partial - 1)) / float(partial)
			partial += increment
		table[index] = value
		peak = maxf(peak, absf(value))
	if peak > 0.00001:
		for index: int in range(PERF_TABLE):
			table[index] = table[index] / peak
	return table


func _render_note(table: PackedFloat32Array, seconds: float, attack: float, decay_power: float) -> AudioStreamWAV:
	var frames: int = int(round(maxf(0.02, seconds) * float(PERF_RATE)))
	if frames < 64 or table.size() < PERF_TABLE:
		return null
	var bytes: PackedByteArray = PackedByteArray()
	bytes.resize(frames * 2)
	if bytes.size() != frames * 2:
		return null
	var phase: float = 0.0
	var advance: float = PERF_REF_HZ * float(PERF_TABLE) / float(PERF_RATE)
	var attack_frames: float = maxf(1.0, attack * float(PERF_RATE))
	for index: int in range(frames):
		var travel: float = float(index) / float(frames)
		var envelope: float = pow(maxf(0.0, 1.0 - travel), decay_power) * minf(1.0, float(index) / attack_frames)
		var slot: int = clampi(int(phase), 0, PERF_TABLE - 1)
		var fraction: float = clampf(phase - float(slot), 0.0, 1.0)
		var here: float = table[slot]
		var next: float = table[(slot + 1) % PERF_TABLE]
		var sample: float = (here + (next - here) * fraction) * envelope
		bytes.encode_s16(index * 2, clampi(int(sample * 26000.0), -32000, 32000))
		phase += advance
		if phase >= float(PERF_TABLE):
			phase -= float(PERF_TABLE)
	var stream: AudioStreamWAV = AudioStreamWAV.new()
	stream.format = AudioStreamWAV.FORMAT_16_BITS
	stream.mix_rate = PERF_RATE
	stream.stereo = false
	stream.loop_mode = AudioStreamWAV.LOOP_DISABLED
	stream.data = bytes
	return stream


func _build_perf_bank() -> void:
	# Every failure here is silent and total: the game keeps exactly the sample
	# cues it has today and simply plays no performer notes.
	var saw: PackedFloat32Array = _harmonic_table(1, 12, 0.16)
	var square: PackedFloat32Array = _harmonic_table(2, 9, 0.13)
	var bright: PackedFloat32Array = _harmonic_table(2, 15, 0.05)
	var pure: PackedFloat32Array = _harmonic_table(1, 1, 0.0)
	var bank: Array[AudioStreamWAV] = [
		_render_note(saw, 0.30, 0.004, 2.2),    # ring 0, the outer sawtooth
		_render_note(square, 0.28, 0.004, 2.4), # ring 1, squarer
		_render_note(bright, 0.26, 0.003, 2.6), # rings 2-3, brightest and hardest
		_render_note(pure, 0.62, 0.006, 2.0),   # chain rungs, sparkle, high notes
		_render_note(saw, 0.66, 0.075, 1.4),    # the announcement swell
	]
	for stream: AudioStreamWAV in bank:
		if stream == null or stream.get_length() < 0.02:
			return
	_perf_bank = bank
	_perf_ready = true


func _apply_tonic(midi: int) -> void:
	_tonic = midi
	_pending_tonic = midi
	_chord_roots.clear()
	_chord_degrees.clear()
	var level: Dictionary = CONTENT.level_at(TONICS.find(midi))
	for degree: int in level["chord_degrees"]:
		_chord_roots.append(NATURAL_MINOR[degree])
		_chord_degrees.append(degree)
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


## carried_score seeds the layer ladder without announcing, so a level that
## carries its score cannot print a rung the player has been hearing since the
## middle of the previous level. -1 means "unknown", which seeds at zero.
func start_run(carried_score: int = -1) -> void:
	if _shutting_down:
		return
	stop_run()
	_apply_tonic(_pending_tonic)
	_running = true
	if carried_score >= 0:
		_score_value = carried_score
		_score_proxy = carried_score
	# The ladder only listens for climbs after the scene has had a chance to
	# report the score it carried in. Whatever arrives inside this window seeds
	# the ladder silently, so a level that starts at 2,000 points cannot print
	# rungs the player has been hearing since the middle of the last level.
	_seed_until = 0.35
	_refresh_layers()
	_snap_layer_opens()
	_music.volume_db = -80.0
	_music.play()
	_music.stream_paused = false


func stop_run() -> void:
	_running = false
	_paused = false
	_queued.clear()
	_perf_queue.clear()
	_cooldowns.clear()
	if _music != null:
		_music.stop()
	if _special != null:
		_special.stop()
	for player: AudioStreamPlayer in _voices:
		player.stop()
	for player: AudioStreamPlayer in _perf_voices:
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
	_tide_until = -1.0
	_special_start = -1.0
	_special_until = -1.0
	_switch_at = -1.0
	_dilated = false
	_overdrive = false
	_break_until = -1.0
	_last_eighth = 0
	_layer_index = 0
	_layer_seeded = false
	_seed_until = -1.0
	_layer_glow_until = -1.0
	_spotlight_stem = -1
	_spotlight_until = -1.0
	_score_value = 0
	_score_proxy = 0
	_drums_open = 0.0
	_melody_open = 0.0
	_bass_open = 0.0
	_perf_index = 0
	_perf_slot = -1000.0
	_perf_last = -1000.0
	_play_heat = 0.0
	_answer_trade = 1.0
	_quiet_since = 0.0
	_groove = 0
	_groove_until = 0.0
	# The device latency estimate is a property of the phone, not of the run.


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
	for player: AudioStreamPlayer in _perf_voices:
		player.stop()
	_queued.clear()
	_perf_queue.clear()
	if not value:
		_latency = AudioServer.get_output_latency()
		_raw_still_time = 0.0
		_perf_slot = -1000.0


func set_muted(value: bool) -> void:
	_muted = value
	var bus_index: int = AudioServer.get_bus_index(_bus_name)
	if bus_index >= 0:
		AudioServer.set_bus_mute(bus_index, value)
	if value:
		_queued.clear()
		_perf_queue.clear()
		for player: AudioStreamPlayer in _voices:
			player.stop()
		for player: AudioStreamPlayer in _perf_voices:
			player.stop()


func set_intensity(value: float) -> void:
	_intensity = clampf(value, 0.0, 1.0)


func set_lane(value: int) -> void:
	_lane = clampi(value, 0, 3)


## The score that buys the band. Optional: without it the ladder runs on an
## internal estimate accumulated from the cues the scene already sends.
func set_score(points: int) -> void:
	_score_external = true
	_score_value = maxi(0, points)


## Optional. Hands the timing chain to the simulation, which is authoritative
## and judges on its own clock. Without it this node runs the same judgement
## against the audible beat, which is what the chain is about anyway.
func set_groove(value: int) -> void:
	_groove_external = true
	var chain: int = clampi(value, 0, 8)
	if chain > _groove:
		_play_rung(chain)
	_groove = chain


## Optional. Reduced motion shortens the bounded peak that carries a new layer
## in. It never removes the layer, the announcement or the fanfare.
func set_reduced_motion(value: bool) -> void:
	_reduced_motion = value


## How many named layers the run has bought, 0-4.
func layer_count() -> int:
	return _layer_index


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


func set_overdrive(value: bool, break_on_exit: bool = true) -> void:
	if _overdrive == value:
		return
	_overdrive = value
	if value:
		_break_until = -1.0
		cue(&"orbit")
	elif _running and break_on_exit:
		_break_until = _clock_seconds + BEAT_SECONDS * 4.0


func beat_position() -> float:
	return _clock_seconds / BEAT_SECONDS


## detail is optional context the scene may pass; for &"hop" it is the swipe
## delta, positive inward, exactly as the scene already computes it. Zero means
## "unknown", and the ring the comet actually reaches decides the figure instead.
func cue(kind: StringName, detail: int = 0) -> void:
	if _paused or _shutting_down:
		return
	if not _running and kind != &"finish":
		return
	# The player's movement is voiced before, and independently of, the sample
	# cue: the sample is the transient, the performer note is the tonal payload.
	if kind == &"turn":
		_performer_input(false, 0)
	elif kind == &"hop":
		_performer_input(true, detail)
	_add_proxy_score(kind)
	var sound: StringName = kind
	match kind:
		&"tide":
			sound = &"magnet"
			_tide_until = _clock_seconds + BEAT_SECONDS * 4.0
		&"tide_enter": sound = &"orbit"
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
	if sound == &"starfall":
		# The simulation announces its release on the quarter. Small frame/mixer
		# offsets should not postpone that already-quantized release another beat.
		var nearest: float = roundf(_clock_seconds / grid) * grid
		if absf(_clock_seconds - nearest) <= 0.1:
			at = nearest
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
	var root_interval: int = _chord_roots[_chord_bar()] if not _chord_roots.is_empty() else 0
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


# --- Harmony ------------------------------------------------------------------
# Every pitch below is an interval over the level tonic, resolved against the
# chord sounding right now. Indices 0-3 walk root, octave, third and fifth of
# the bar's diatonic triad; each block of four is one octave up.

func _chord_bar() -> int:
	var size: int = maxi(1, _chord_degrees.size())
	var bar: int = floori(beat_position() / 4.0)
	if _special_until > _clock_seconds and _special_start >= 0.0:
		bar = clampi(floori((_clock_seconds - _special_start) / (4.0 * BEAT_SECONDS)), 0, 3)
	return posmod(bar, size)


func _scale_semitone(step: int) -> int:
	var octave: int = floori(float(step) / 7.0)
	return NATURAL_MINOR[step - octave * 7] + 12 * octave


func _chord_semitone(index: int) -> float:
	if _chord_degrees.is_empty():
		return float(maxi(0, index))
	var degree: int = _chord_degrees[_chord_bar()]
	var root: int = _scale_semitone(degree)
	var voicing: Array[int] = [root, root + 12, _scale_semitone(degree + 2), _scale_semitone(degree + 4)]
	var slot: int = maxi(0, index)
	return float(voicing[slot % 4] + 12 * floori(float(slot) / 4.0))


func _pent_semitone(index: int) -> float:
	var slot: int = maxi(0, index)
	return float(PENT_STEPS[slot % 5] + 12 * floori(float(slot) / 5.0))


func _perf_ratio(semitone: float) -> float:
	var ratio: float = pow(2.0, (float(_tonic - 69) + clampf(semitone, -48.0, 48.0)) / 12.0)
	# The register turns around at both ends while the pitch class is kept. The
	# six keys descend a whole tone each, so by the last worlds a low voice falls
	# under what a phone reproduces at all; and the inner-ring sparkle sits four
	# octaves over its chord root, which on a VI or VII bar would be shrill.
	# Folding by octaves keeps every note a correct chord tone in a register the
	# player can actually hear.
	for _step: int in range(4):
		if PERF_REF_HZ * ratio >= PERF_FLOOR_HZ:
			break
		ratio *= 2.0
	for _step: int in range(4):
		if PERF_REF_HZ * ratio <= PERF_CEILING_HZ:
			break
		ratio *= 0.5
	return clampf(ratio, 0.05, 16.0)


func _ring_wave(ring: int) -> int:
	# The ring IS the instrument: the outer ring is a sawtooth, the middle ring
	# is squarer, and the inner rings are brighter and harder.
	if ring <= 0:
		return WAVE_SAW
	if ring == 1:
		return WAVE_SQUARE
	return WAVE_BRIGHT


func _perf_note(wave: int, semitone: float, gain: float) -> void:
	if not _perf_ready or _muted or _paused:
		return
	if _perf_bank.is_empty() or _perf_voices.is_empty():
		return
	var stream: AudioStreamWAV = _perf_bank[clampi(wave, 0, _perf_bank.size() - 1)]
	if stream == null:
		return
	var player: AudioStreamPlayer = _perf_voices[_next_perf]
	_next_perf = (_next_perf + 1) % _perf_voices.size()
	player.stop()
	player.stream = stream
	player.pitch_scale = _perf_ratio(semitone)
	player.volume_db = linear_to_db(clampf(gain, 0.0005, 1.0))
	player.stream_paused = false
	player.play()


func _play_sample_note(sound: StringName, gain: float, semitones: float) -> void:
	var stream: AudioStream = _cue_streams.get(sound) as AudioStream
	if stream == null or _muted or _paused:
		return
	var player: AudioStreamPlayer = _voices[_next_voice]
	_next_voice = (_next_voice + 1) % VOICE_COUNT
	player.stop()
	player.stream = stream
	player.pitch_scale = clampf(pow(2.0, (float(_tonic - 69) + clampf(semitones, -24.0, 24.0)) / 12.0), 0.05, 6.0)
	player.volume_db = linear_to_db(clampf(gain, 0.0005, 1.0))
	player.stream_paused = false
	player.play()


# --- The player as an instrument ----------------------------------------------

func _performer_input(is_hop: bool, direction: int) -> void:
	if not _running or _paused:
		return
	var grid: float = BEAT_SECONDS * 0.25
	# Nearest sixteenth, which may sit a little in the past. Snapping forward
	# only would cost a whole slot, past the point where a sound still feels
	# attached to the finger that caused it.
	var at: float = roundf((_clock_seconds + _latency * 0.5) / grid) * grid
	if absf(at - _perf_slot) < 0.0001:
		return
	_perf_slot = at
	if _clock_seconds - _perf_last > PHRASE_GAP:
		_perf_index = 0
	_perf_last = _clock_seconds
	_play_heat = minf(1.0, _play_heat + 0.26)
	_judge_input()
	if not _perf_ready or _muted or _perf_queue.size() >= 12:
		return
	_perf_queue.append({
		"kind": &"perf", "at": at, "hop": is_hop,
		"direction": direction, "from_lane": _lane})


func _queue_note(at: float, wave: int, chord: int, offset: float, gain: float) -> void:
	if _perf_queue.size() >= 12:
		return
	_perf_queue.append({"kind": &"note", "at": at, "wave": wave,
		"chord": chord, "offset": offset, "gain": gain})


func _queue_sample(at: float, sound: StringName, gain: float, offset: float) -> void:
	if _perf_queue.size() >= 12:
		return
	_perf_queue.append({"kind": &"sample", "at": at, "sound": sound,
		"gain": gain, "offset": offset})


func _fire_perf(item: Dictionary) -> void:
	var kind: StringName = item.get("kind", &"note")
	if kind == &"sample":
		var sound: StringName = item.get("sound", &"star")
		_play_sample_note(sound, float(item.get("gain", 0.5)), float(item.get("offset", 0.0)))
		return
	if kind == &"note":
		var chord: int = int(item.get("chord", -1))
		var pitch: float = float(item.get("offset", 0.0))
		if chord >= 0:
			pitch += _chord_semitone(chord)
		_perf_note(int(item.get("wave", WAVE_SINE)), pitch, float(item.get("gain", 0.3)))
		return
	# The player's own note. The ring is read at sounding time, so the figure is
	# the ring the comet actually reached, not the one it left.
	var ring: int = clampi(_lane, 0, 3)
	var transpose: int = mini(2, ring)
	var tone_index: int = 0
	if bool(item.get("hop", false)):
		# Positive swipe delta and a higher lane index both mean inward. When the
		# scene passes no direction, the lane the comet actually reached decides.
		var direction: int = int(item.get("direction", 0))
		var inward: bool = (direction > 0) if direction != 0 else (ring > int(item.get("from_lane", ring)))
		var figure: Array[int] = HOP_IN_FIGURE if inward else HOP_OUT_FIGURE
		tone_index = figure[_perf_index % figure.size()] + transpose
	else:
		tone_index = TAP_FIGURE[_perf_index % TAP_FIGURE.size()] + transpose
	_perf_index += 1
	var heat: float = clampf(_play_heat, 0.0, 1.0)
	var gain: float = clampf((0.30 + 0.22 * heat) * (1.0 + 0.07 * float(_groove)), 0.05, 0.78)
	var wave: int = _ring_wave(ring)
	# A third above the walked tone, the fifth underneath it, and inside the
	# rings an octave sparkle: one tap is a note, a flurry is a chord.
	_perf_note(wave, _chord_semitone(tone_index + 2), gain)
	_perf_note(wave, _chord_semitone(tone_index), gain * 0.34)
	if transpose >= 2:
		_perf_note(WAVE_SINE, _chord_semitone(tone_index + 4), gain * 0.14)


# --- The timing chain ---------------------------------------------------------
# Judged against the AUDIBLE beat, and against a running estimate of this
# device's input latency rather than against absolute time, so a slow phone
# cannot decide the player's result. Purely musical here: the chain opens the
# arrangement and walks the scale. Points remain the simulation's business.

func _judge_input() -> void:
	if _groove_external:
		return
	var half: float = BEAT_SECONDS * 0.5
	var sixteenth: float = BEAT_SECONDS * 0.25
	var off4: float = fposmod(_clock_seconds + half, BEAT_SECONDS) - half
	var off16: float = fposmod(_clock_seconds + sixteenth * 0.5, sixteenth) - sixteenth * 0.5
	var deviation4: float = absf(off4 - _timing_bias)
	var deviation16: float = absf(off16 - _timing_bias)
	if minf(deviation4, deviation16) < TIGHT_WINDOW * 2.5:
		var step: float = ((off4 if deviation4 <= deviation16 else off16) - _timing_bias) * 0.18
		if _timing_samples < 12 and deviation4 < TIGHT_WINDOW * 2.5:
			_timing_samples += 1
			_timing_bias += step
		else:
			# A latency is static, so the learner is too: three milliseconds a tap.
			_timing_bias += clampf(step, -0.003, 0.003)
		_timing_bias = clampf(_timing_bias, -0.12, 0.12)
	if deviation16 >= TIGHT_WINDOW:
		_groove = maxi(0, _groove - 1)
		return
	if deviation4 >= TIGHT_WINDOW:
		if _groove > 0:
			_groove_until = _clock_seconds + 2.8
		return
	var previous: int = _groove
	_groove = mini(8, _groove + 1)
	_groove_until = _clock_seconds + 2.8
	if _groove > previous:
		_play_rung(_groove)


func _play_rung(chain: int) -> void:
	# Each rung is heard: eight tight quarters walk up the scale.
	if not _running:
		return
	_perf_note(WAVE_SINE, _pent_semitone(mini(13, chain + 4)), 0.22)


# --- The layer ladder ---------------------------------------------------------

func _add_proxy_score(kind: StringName) -> void:
	if _score_external:
		return
	# Only used until the scene reports a real score. Approximate on purpose:
	# it exists so the ladder is alive with no integration at all.
	match kind:
		&"star": _score_proxy += 4
		&"orbit": _score_proxy += 45
		&"graze": _score_proxy += 3
		&"power", &"magnet": _score_proxy += 50


func _snap_layer_opens() -> void:
	_drums_open = 1.0 if _layer_index >= 1 else 0.0
	_melody_open = 1.0 if _layer_index >= 2 else 0.0
	_bass_open = 1.0 if _layer_index >= 3 else 0.0


func _refresh_layers() -> void:
	var points: int = _score_value if _score_external else _score_proxy
	var reached: int = 0
	for index: int in range(LAYER_AT.size()):
		if points >= LAYER_AT[index]:
			reached = index + 1
	if not _layer_seeded or _clock_seconds < _seed_until:
		_layer_seeded = true
		_layer_index = maxi(_layer_index, reached)
		_snap_layer_opens()
		return
	if reached <= _layer_index:
		return
	while _layer_index < reached:
		layer_unlocked.emit(_layer_index + 1, LAYER_NAME[clampi(_layer_index, 0, LAYER_NAME.size() - 1)])
		_layer_index += 1
	# One bounded peak carries however many rungs landed together, then the
	# arrangement returns to its ordinary state. Muted runs still announce.
	_layer_glow_until = _clock_seconds + BEAT_SECONDS * (4.0 if _reduced_motion else 8.0)
	# For the first bar the rest of the band steps back so the layer the player
	# just bought is the thing they hear. RHYTHM is the drums, MELODY the answer,
	# DEEP BASS the pulse; HIGH NOTES has no stem of its own, so every stem
	# steps back and the new voice sits above them.
	_spotlight_stem = SPOTLIGHT_STEM[clampi(_layer_index - 1, 0, SPOTLIGHT_STEM.size() - 1)]
	_spotlight_until = _clock_seconds + BEAT_SECONDS * (3.0 if _reduced_motion else 5.0)
	_queue_fanfare()


func _stem_scale(index: int) -> float:
	if _clock_seconds >= _spotlight_until or index == _spotlight_stem:
		return 1.0
	return 0.66


func _queue_fanfare() -> void:
	if _muted:
		return
	var quarter: float = BEAT_SECONDS
	var at: float = (floorf((_clock_seconds + _latency) / quarter) + 1.0) * quarter
	var sixteenth: float = BEAT_SECONDS * 0.25
	if _perf_ready:
		# A low root and its fifth underneath the three rising chord tones: the
		# same shape the original unlock earcon used, in this world's key.
		_queue_note(at, WAVE_SWELL, 0, -12.0, 0.32)
		_queue_note(at, WAVE_SWELL, 0, -5.0, 0.20)
		_queue_note(at, WAVE_BRIGHT, 0, 0.0, 0.34)
		_queue_note(at + sixteenth, WAVE_BRIGHT, 2, 0.0, 0.34)
		_queue_note(at + sixteenth * 2.0, WAVE_BRIGHT, 4, 0.0, 0.38)
	else:
		_queue_sample(at, &"orbit", 0.62, 0.0)
		_queue_sample(at + sixteenth * 2.0, &"star", 0.52, 12.0)


func _process(delta: float) -> void:
	if _paused:
		return
	if _filter != null:
		# HIGH NOTES opens the whole mix; flying inward brightens it further, the
		# way the pad cutoff used to lift with ring depth.
		var ceiling_hz: float = OPEN_CUTOFF if _layer_index >= 4 else BASE_CUTOFF
		var bright: float = ceiling_hz + RING_LIFT[clampi(_lane, 0, 3)]
		var target_cutoff: float = DILATED_CUTOFF if _dilated else bright
		_filter.cutoff_hz = lerpf(_filter.cutoff_hz, target_cutoff, 1.0 - exp(-delta * 5.0))
	if not _running:
		return
	_update_clock(delta)
	_refresh_layers()
	_play_heat = maxf(0.0, _play_heat - delta * 0.34)
	if not _groove_external and _groove > 0 and _clock_seconds > _groove_until:
		_groove -= 1
		_groove_until = _clock_seconds + 0.7
	var current_eighth: int = floori(beat_position() * 2.0)
	# Report every crossed boundary, including slow render frames. The silent
	# fallback clock above keeps optional audio from becoming a gameplay gate.
	var shimmer_due: bool = false
	while _last_eighth < current_eighth:
		_last_eighth += 1
		if _last_eighth % 16 == 15:
			shimmer_due = true
		eighth_step.emit(_last_eighth)
	if shimmer_due and _layer_index >= 4 and _clock_seconds >= _special_until and _clock_seconds >= _break_until:
		# HIGH NOTES: one sparse sine above the arrangement, every other bar.
		_perf_note(WAVE_SINE, _pent_semitone(11), 0.10 + 0.09 * _energy)
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
	for index: int in range(_perf_queue.size() - 1, -1, -1):
		var entry: Dictionary = _perf_queue[index]
		var due: float = float(entry["at"])
		if due < _clock_seconds - 1.0:
			_perf_queue.remove_at(index)
		elif _clock_seconds + mix_lead >= due:
			_fire_perf(entry)
			_perf_queue.remove_at(index)
	var switch_gain: float = 1.0
	if _switch_at >= 0.0:
		switch_gain = clampf((_switch_at - _clock_seconds) / 0.16, 0.0, 1.0)
		if _clock_seconds >= _switch_at:
			_apply_tonic(_pending_tonic)
	var target: float = clampf(_intensity + float(_lane) * 0.1, 0.0, 1.0)
	# A held timing chain opens the arrangement the way sustained flight does.
	target = maxf(target, clampf(float(_groove) * 0.07, 0.0, 0.56))
	if _clock_seconds < _tide_until:
		target = minf(1.0, target + 0.12)
	if _overdrive or _clock_seconds < _layer_glow_until:
		target = 1.0
	_energy = lerpf(_energy, target, 1.0 - exp(-delta * (2.2 if target > _energy else 0.7)))
	# Call and answer: the arrangement's authored answer steps back while the
	# player is playing and leans in when the player leaves a gap.
	if _play_heat < 0.12:
		_quiet_since += delta
	else:
		_quiet_since = 0.0
	var trade: float = lerpf(1.0, 0.55, clampf(_play_heat, 0.0, 1.0))
	if _quiet_since > BEAT_SECONDS * 2.0 and _energy > 0.32:
		trade = 1.18
	_answer_trade = clampf(lerpf(_answer_trade, trade, 1.0 - exp(-delta * 3.0)), 0.0, 1.25)
	var duck_target: float = 0.06 if _clock_seconds < _special_until else 1.0
	if _clock_seconds < _duck_until:
		duck_target = minf(duck_target, 0.4)
	_duck = lerpf(_duck, duck_target, 1.0 - exp(-delta * (18.0 if duck_target < _duck else 2.4)))
	_fade = minf(1.0, _fade + delta * 2.0)
	_music.volume_db = linear_to_db(maxf(0.0001, _fade * _duck * switch_gain))
	if _synchronized == null:
		return
	# Each rung swells its stem in over about a bar rather than switching it on.
	_drums_open = lerpf(_drums_open, 1.0 if _layer_index >= 1 else 0.0, 1.0 - exp(-delta * 0.9))
	_melody_open = lerpf(_melody_open, 1.0 if _layer_index >= 2 else 0.0, 1.0 - exp(-delta * 0.8))
	_bass_open = lerpf(_bass_open, 1.0 if _layer_index >= 3 else 0.0, 1.0 - exp(-delta * 0.7))
	var break_gain: float = 0.12 if _clock_seconds < _break_until else 1.0
	# bed: the home. Always present, in every state, at every score.
	var bed: float = lerpf(0.63, 0.82, _energy) * _stem_scale(0)
	_synchronized.set_sync_stream_volume(0, linear_to_db(maxf(0.0001, bed)))
	# pulse: DEEP BASS turns a supporting sub into the floor of the record.
	var pulse_low: float = lerpf(0.10, 0.28, _bass_open)
	var pulse_high: float = lerpf(0.62, 0.95, _bass_open)
	var pulse: float = lerpf(pulse_low, pulse_high, _energy) * _stem_scale(1)
	_synchronized.set_sync_stream_volume(1, linear_to_db(maxf(0.0001, pulse)))
	# drums: RHYTHM. A distant shadow before its rung, the kit after it.
	var drums: float = smoothstep(0.12, 0.78, _energy) * 0.8 * break_gain
	drums *= lerpf(0.10, 1.0, _drums_open) * _stem_scale(2)
	_synchronized.set_sync_stream_volume(2, linear_to_db(maxf(0.0001, drums)))
	# answer: MELODY, and the half of the conversation the player does not play.
	var answer: float = smoothstep(0.38, 0.9, _energy) * 0.7 * break_gain
	answer *= _melody_open * _answer_trade * _stem_scale(3)
	_synchronized.set_sync_stream_volume(3, linear_to_db(maxf(0.0001, answer)))


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
	for player: AudioStreamPlayer in _perf_voices:
		player.stream = null
	_cue_streams.clear()
	_perf_bank.clear()
	_perf_ready = false
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
