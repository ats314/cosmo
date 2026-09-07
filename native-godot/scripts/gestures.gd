extends RefCounted
## Source pointer recognition: immediate silent turn, reversible until resolved.
signal started
signal reverted
signal turned
signal hopped(direction: int)
signal canceled
signal unresolved
var mode = "screen"
var threshold = 32.0
var finger = -1
var start = Vector2.ZERO
var radial = Vector2.UP
var elapsed = 0.0
var moved = 0.0
var committed = false
var swiped = false
var lean = 0.0
var outward = false

func begin(id: int, point: Vector2, center: Vector2, comet_point: Vector2 = Vector2.INF) -> void:
	if finger != -1:
		return
	finger = id
	start = point
	# The hand may start anywhere. Its radial reference is the comet's normal
	# on the actual ellipse at press, frozen for the whole gesture.
	radial = ((comet_point if comet_point.is_finite() else point) - center).normalized()
	if radial.length_squared() < 0.1:
		radial = Vector2.UP
	elapsed = 0.0
	moved = 0.0
	committed = false
	swiped = false
	lean = 0.0
	outward = false
	started.emit()

func _read_direction(delta: Vector2) -> void:
	var projection = -delta.y if mode == "screen" else delta.dot(radial)
	lean = absf(projection)
	outward = projection > 0.0

func motion(id: int, point: Vector2) -> void:
	if id != finger or committed:
		return
	var delta = point - start
	moved = delta.length()
	if moved < threshold:
		return
	if not swiped:
		swiped = true
		reverted.emit()
	_read_direction(delta)
	if lean >= moved * 0.34:
		committed = true
		hopped.emit(-1 if outward else 1)
		_clear()

func end(id: int, point: Vector2, was_canceled: bool = false) -> void:
	if id != finger:
		return
	if swiped:
		# Cancellation coordinates are untrustworthy: source keeps the last
		# observed direction. A normal lift is judged at its actual endpoint.
		if not was_canceled:
			var delta = point - start
			moved = delta.length()
			_read_direction(delta)
		if moved >= threshold * (18.0 / 32.0) and lean > moved * 0.12:
			hopped.emit(-1 if outward else 1)
		else:
			unresolved.emit()
	else:
		turned.emit()
	_clear()

func tick(dt: float) -> void:
	# A held press never emits speculative feedback, however late its swipe.
	elapsed += dt if finger != -1 else 0.0

func cancel() -> void:
	if finger != -1:
		canceled.emit()
	_clear()

func _clear() -> void:
	finger = -1
	committed = false
	swiped = false
	elapsed = 0.0
	moved = 0.0
