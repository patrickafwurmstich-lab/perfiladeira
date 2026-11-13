class_name Dedos
extends SkeletonModifier3D
## Fecha os dedos da mão (segurar a botoeira). Roda depois da animação e do IK; "influence" faz a transição.
var ossos: Array = []          # índices dos ossos dos dedos
var eixo := Vector3(1, 0, 0)   # eixo local de flexão
var angulo := deg_to_rad(65.0)
var polegar: Array = []
var eixo_polegar := Vector3(0, 0, 1)
var angulo_polegar := deg_to_rad(35.0)

func configurar(esq: Skeleton3D, lado: String) -> void:
	for dedo in ["Index", "Middle", "Ring", "Pinky"]:
		for n in [1, 2]:
			var i := esq.find_bone("%sHand%s%d" % [lado, dedo, n])
			if i >= 0: ossos.append(i)
	for n in [1, 2]:
		var i := esq.find_bone("%sHandThumb%d" % [lado, n])
		if i >= 0: polegar.append(i)

func _process_modification_with_delta(_delta: float) -> void:
	var esq := get_skeleton()
	if esq == null:
		return
	for i in ossos:
		esq.set_bone_pose_rotation(i, esq.get_bone_pose_rotation(i) * Quaternion(eixo, angulo))
	for i in polegar:
		esq.set_bone_pose_rotation(i, esq.get_bone_pose_rotation(i) * Quaternion(eixo_polegar, angulo_polegar))
