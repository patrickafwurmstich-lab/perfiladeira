class_name Sentado
extends SkeletonModifier3D
## Pose de sentado (empilhadeira): coxa para frente e joelho dobrado, por cima da animação parada.
## O pacote de personagens não tem animação de sentar, então a pose é feita nos ossos.
## "influence" faz a transição (sentar/levantar).

var coxas: Array = []
var canelas: Array = []
var ang_coxa := deg_to_rad(-88.0)     # coxa gira para frente (o boneco olha para +Z)
var ang_joelho := deg_to_rad(82.0)    # canela volta para baixo
var abre := deg_to_rad(7.0)           # pernas um pouco abertas

func configurar(esq: Skeleton3D) -> void:
	for lado in ["Left", "Right"]:
		coxas.append(esq.find_bone(lado + "UpLeg"))
		canelas.append(esq.find_bone(lado + "Leg"))

func _process_modification_with_delta(_delta: float) -> void:
	var esq := get_skeleton()
	if esq == null:
		return
	for k in 2:
		var c: int = coxas[k]
		var j: int = canelas[k]
		if c < 0 or j < 0:
			continue
		var s := 1.0 if k == 0 else -1.0
		var gc := esq.get_bone_global_pose(c)
		var rot := Basis(Vector3.FORWARD, s * abre) * Basis(Vector3.RIGHT, ang_coxa)
		esq.set_bone_global_pose(c, Transform3D(rot * gc.basis, gc.origin))
		var gj := esq.get_bone_global_pose(j)
		esq.set_bone_global_pose(j, Transform3D(Basis(Vector3.RIGHT, ang_joelho) * gj.basis, gj.origin))
