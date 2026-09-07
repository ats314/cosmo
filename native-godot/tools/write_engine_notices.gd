extends SceneTree

func _initialize() -> void:
	var output = "res://builds/web/GODOT_NOTICES.txt"
	var args = OS.get_cmdline_user_args()
	if not args.is_empty():
		output = args[0]
	var file = FileAccess.open(output, FileAccess.WRITE)
	if file == null:
		push_error("Cannot write engine notices: " + output)
		quit(1)
		return
	file.store_string("Godot Engine and third-party notices\n")
	file.store_string("The following licenses apply to Godot and its dependencies, not to Cosmo's proprietary code and assets.\n\n")
	file.store_string(Engine.get_license_text() + "\n\n")
	file.store_string("Component copyright information\n================================\n")
	file.store_string(JSON.stringify(Engine.get_copyright_info(), "  ") + "\n\n")
	var licenses = Engine.get_license_info()
	for title in licenses:
		file.store_string(str(title) + "\n================================\n" + str(licenses[title]) + "\n\n")
	file.close()
	print("Wrote official runtime engine notices: ", output)
	quit()
