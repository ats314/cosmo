extends RefCounted
## One committed gesture. A swipe never produces a reversal, sound or spent orbit.
signal turned
signal hopped(direction: int)
var mode = "screen"
var threshold = 32.0
var finger = -1
var start = Vector2.ZERO
var radial = Vector2.UP
var elapsed = 0.0
var moved = 0.0
var committed = false

func begin(id: int, point: Vector2, center: Vector2) -> void:
	if finger != -1:
		return
	finger = id
	start = point
	radial = (point - center).normalized()
	if radial.length_squared() < 0.1:
		radial = Vector2.UP
	elapsed = 0.0
	moved = 0.0
	committed = false

func motion(id: int, point: Vector2) -> void:
	if id != finger or committed:
		return
	var delta = point - start
	moved = maxf(moved, delta.length())
	if moved < threshold:
		return
	var lean = delta.y if mode == "screen" else -delta.dot(radial)
	if absf(lean) / maxf(delta.length(), 1.0) < 0.34:
		return
	committed = true
	hopped.emit(1 if lean > 0.0 else -1)

func end(id: int, point: Vector2, canceled: bool = false) -> void:
	if id != finger:
		return
	motion(id, point)
	if not canceled and not committed and moved < threshold:
		turned.emit()
	cancel()

func tick(dt: float) -> void:
	# A held press keeps flying. Commit a tap on release; no irreversible speculative turn.
	# A timer cannot prove a held contact will not become a swipe. Recognition on
	# release avoids a false reversal and makes even a late swipe unambiguous.
	elapsed += dt if finger != -1 else 0.0

func cancel() -> void:
	finger = -1
	committed = false
	elapsed = 0.0
	moved = 0.0
