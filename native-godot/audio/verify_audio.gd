extends SceneTree
## Focused playback/lifecycle check. Invoke with --headless --path native-godot
## --script res://audio/verify_audio.gd. No game save data is read or written.

const AudioController = preload("res://scripts/reactive_audio.gd")
var _failures: Array[String] = []
var _eighths: Array[int] = []


func _initialize() -> void:
	call_deferred("_run")


func _expect(condition: bool, message: String) -> void:
	if not condition:
		_failures.append(message)
		push_error(message)


func _on_eighth(step: int) -> void:
	_eighths.append(step)


func _run() -> void:
	var buses_before: int = AudioServer.bus_count
	var audio: Node = AudioController.new()
	root.add_child(audio)
	audio.eighth_step.connect(_on_eighth)
	_expect(AudioServer.bus_count == buses_before + 1, "Audio owns one private bus")
	_expect(audio._music.playback_type == AudioServer.PLAYBACK_TYPE_STREAM, "Synchronized music forces the Web-compatible Godot mixer")
	_expect(audio._special.playback_type == AudioServer.PLAYBACK_TYPE_STREAM, "Release retains mixer bus effects on Web")
	for player: AudioStreamPlayer in audio._voices:
		_expect(player.playback_type == AudioServer.PLAYBACK_TYPE_STREAM, "Cue playback retains limiter on Web")
	var manifest: Dictionary = JSON.parse_string(FileAccess.get_file_as_string("res://audio/manifest.json"))
	_expect(int(manifest["beats_per_chord"]) == 4, "Source changes harmony once per 4-beat bar")
	var profile_index: int = 0
	for tonic: int in audio.TONICS:
		audio.set_tonic(tonic)
		_expect(audio._tonic == tonic, "Key selection %d" % tonic)
		var source: Dictionary = audio.CONTENT.level_at(profile_index)
		var generated: Dictionary = manifest["harmony_profiles"][profile_index]
		_expect(int(generated["tonic_midi"]) == tonic, "Generated profile selects the source key")
		for index: int in range(4):
			var degree: int = int(source["chord_degrees"][index])
			_expect(int(generated["chord_degrees"][index]) == degree, "Rendered harmony follows the source chord row")
			_expect(audio._chord_roots[index] == audio.NATURAL_MINOR[degree], "Action cues follow the same source chord root")
		for index: int in range(8):
			_expect(int(generated["arp"][index]) == int(source["arp"][index]), "Rendered answer follows the source arp contour")
		for index: int in range(4):
			var stream: AudioStreamWAV = audio._synchronized.get_sync_stream(index) as AudioStreamWAV
			_expect(stream != null, "All keyed stems load")
			if stream != null:
				_expect(stream.loop_end == 576000, "All loop endpoints remain exactly 32 beats")
				_expect(absf(stream.get_length() - audio.LOOP_SECONDS) < 0.001, "All stem durations agree")
		_expect(audio._cue_streams[&"starfall"] != null, "Keyed release loads")
		_expect(audio._cue_streams[&"finish"] != null, "Keyed ending loads")
		profile_index += 1
	audio.set_tonic(69)
	audio.start_run()
	audio.set_intensity(0.9)
	audio.set_lane(2)
	await create_timer(0.4).timeout
	_expect(audio.beat_position() > 0.0, "Transport advances")
	_expect(not _eighths.is_empty(), "Transport emits crossed eighth notes")
	var pause_beat: float = audio.beat_position()
	var paused_eighths: int = _eighths.size()
	audio.cue(&"starfall")
	audio.set_paused(true)
	_expect(audio._music.stream_paused, "Music pauses as one synchronized stream")
	_expect(audio._queued.is_empty(), "Pause drains unfinished cue queue")
	await create_timer(0.3).timeout
	_expect(audio.beat_position() == pause_beat, "Pause freezes musical clock")
	_expect(_eighths.size() == paused_eighths, "Pause freezes eighth-note events")
	audio.set_paused(false)
	await create_timer(0.35).timeout
	_expect(audio.beat_position() > pause_beat, "Resume continues musical clock")
	audio.set_dilated(true)
	await create_timer(0.25).timeout
	_expect(audio._music.pitch_scale == 1.0, "Dilation preserves BPM")
	_expect(audio._filter.cutoff_hz < 5000.0, "Dilation darkens filter")
	audio.set_muted(true)
	var muted_beat: float = audio.beat_position()
	audio.cue(&"starfall")
	_expect(audio._queued.is_empty(), "Muted reward never waits on audio")
	await create_timer(0.2).timeout
	_expect(audio.beat_position() > muted_beat, "Mute preserves transport")
	for index: int in range(_eighths.size()):
		_expect(_eighths[index] == index + 1, "Eighth-note boundaries remain consecutive across pause and mute")
	audio.set_muted(false)
	audio.set_tonic(67)
	var switch_deadline: int = Time.get_ticks_msec() + 2900
	while audio._tonic != 67 and Time.get_ticks_msec() < switch_deadline:
		# Repeated scene updates cannot keep postponing an already scheduled swap.
		audio.set_tonic(67)
		await process_frame
	_expect(audio._tonic == 67, "Running key change commits at the next bar")
	_expect(audio._music.pitch_scale == 1.0, "Key changes preserve 104 BPM")
	audio.set_overdrive(true)
	await create_timer(0.1).timeout
	_expect(audio._music.pitch_scale == 1.0, "Overdrive preserves 104 BPM")
	audio.set_overdrive(false)
	audio.cue(&"turn")
	audio.cue(&"hop")
	audio.cue(&"star")
	audio.cue(&"orbit")
	audio.cue(&"magnet")
	audio.cue(&"hit")
	audio.cue(&"starfall")
	await create_timer(0.7).timeout
	_expect(audio._special.playing, "Earned Starfall starts")
	var release_position: float = audio._special.get_playback_position()
	audio.set_paused(true)
	await create_timer(0.2).timeout
	_expect(absf(audio._special.get_playback_position() - release_position) < 0.03, "Active release freezes on pause")
	audio.set_paused(false)
	audio.stop_run()
	_expect(audio._queued.is_empty() and not audio._music.playing and not audio._special.playing, "Stop drains playback")
	_expect(audio.beat_position() == 0.0, "Retry clock resets")
	audio.cue(&"finish")
	_expect(audio._special.playing, "Ending can play after gameplay stops")
	await audio.shutdown()
	_expect(audio._shutdown_done and audio._music.stream == null, "Application shutdown retires mixer resources before quit")
	audio.queue_free()
	await process_frame
	_expect(AudioServer.bus_count == buses_before, "Teardown returns audio bus count")
	if _failures.is_empty():
		print("Native audio passed: six source harmony/arp profiles, equal loops, live key change, pause/resume, mute, eighth-note transport, dilation/overdrive, cues, release, ending, teardown.")
	quit(0 if _failures.is_empty() else 1)
