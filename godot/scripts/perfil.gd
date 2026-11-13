class_name Perfil
extends RefCounted
## Geometria da telha TP-40/980 (igual à dos modelos 3D): 5 ondas trapezoidais, passo 196 mm,
## altura 40 mm, largura total 1040 mm (útil 980). A chapa entra plana com 1200 mm e a onda
## nasce do centro para as bordas, estação por estação (como os discos dos rolos do modelo).

const ALTURA := 0.04
const TOPO := 0.016          # meia largura da crista
const BASE := 0.048          # meia largura da base da onda
const LARG_FORMADA := 1.04
const LARG_PLANA := 1.20
const CENTROS := [-0.392, -0.196, 0.0, 0.196, 0.392]
# a partir de que fração da linha cada onda começa a subir (centro primeiro)
const INICIO_ONDA := [0.50, 0.25, 0.0, 0.25, 0.50]
const INICIO_BORDA := 0.70

## seção transversal (z, y) com a formação de cada onda: amp[k] em 0..1, borda em 0..1
static func secao(amp: Array, borda: float, escala_z: float) -> PackedVector2Array:
	var p := PackedVector2Array()
	p.append(Vector2(-0.52, 0.0))
	for k in 5:
		var c: float = CENTROS[k]
		var h: float = ALTURA * amp[k]
		p.append(Vector2(c - BASE, 0.0))
		p.append(Vector2(c - TOPO, h))
		p.append(Vector2(c + TOPO, h))
		p.append(Vector2(c + BASE, 0.0))
	p.append(Vector2(0.488, 0.0))
	p.append(Vector2(0.52, ALTURA * borda))
	for i in p.size():
		p[i].x *= escala_z
	return p

## formação ao longo da linha: f = 0 na 1ª estação, 1 na última
static func amplitudes(f: float) -> Array:
	var a := []
	for k in 5:
		a.append(smoothstep(INICIO_ONDA[k], 1.0, f))
	return a

static func secao_em(f: float, assimetria := 0.0) -> PackedVector2Array:
	var a := amplitudes(f)
	# cassete gasto: a onda da ponta sai mais baixa (perfil assimétrico — defeito visível)
	if assimetria > 0.0:
		a[4] *= 1.0 - assimetria * 0.45
		a[3] *= 1.0 - assimetria * 0.15
	var borda := smoothstep(INICIO_BORDA, 1.0, f)
	var media: float = (a[0] + a[1] + a[2] + a[3] + a[4]) / 5.0
	var escala := lerpf(LARG_PLANA / LARG_FORMADA, 1.0, media)
	return secao(a, borda, escala)

## fita contínua da entrada (x0) até o corte (x1). xs_estacao: x da 1ª e da última estação.
static func malha_fita(x0: float, x1: float, x_e0: float, x_e1: float, passo := 0.08) -> ArrayMesh:
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var secoes: Array = []
	var xs: Array = []
	var x := x0
	while x < x1 + 0.0001:
		var f := clampf((x - x_e0) / (x_e1 - x_e0), 0.0, 1.0)
		secoes.append(secao_em(f))
		xs.append(x)
		x += passo
	for i in secoes.size():
		var s: PackedVector2Array = secoes[i]
		for q in s:
			st.set_uv(Vector2(xs[i], q.x))
			st.add_vertex(Vector3(xs[i], q.y, q.x))
	var n: int = secoes[0].size()
	for i in secoes.size() - 1:
		for j in n - 1:
			var a := i * n + j
			var b := a + 1
			var c := a + n
			var d := c + 1
			st.add_index(a); st.add_index(c); st.add_index(b)
			st.add_index(b); st.add_index(c); st.add_index(d)
	st.generate_normals()
	return st.commit()

## telha formada de comprimento L (x de 0 a L). curva_m: flecha lateral (camber) por guia torta;
## assimetria: cassete gasto. Retorna malha de dupla face (o material desliga o culling).
static func malha_telha(L: float, curva_m := 0.0, assimetria := 0.0) -> ArrayMesh:
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var sec := secao_em(1.0, assimetria)
	var n_x := 2 if absf(curva_m) < 0.0005 else maxi(4, int(L / 0.4) + 1)
	for i in n_x:
		var u := float(i) / (n_x - 1)
		var x := u * L
		var dz := curva_m * 4.0 * u * (1.0 - u)
		for q in sec:
			st.set_uv(Vector2(x, q.x))
			st.add_vertex(Vector3(x, q.y, q.x + dz))
	var n := sec.size()
	for i in n_x - 1:
		for j in n - 1:
			var a := i * n + j
			st.add_index(a); st.add_index(a + n); st.add_index(a + 1)
			st.add_index(a + 1); st.add_index(a + n); st.add_index(a + n + 1)
	st.generate_normals()
	return st.commit()

## material de chapa galvalume (fita usa o shader com corte de cabeça/cauda)
static var _mat_cache: StandardMaterial3D

## galvalume: prata frio fosco, com variação leve de brilho (marca de laminação) — não pode parecer plástico
static func material_chapa() -> StandardMaterial3D:
	if _mat_cache:
		return _mat_cache
	var m := StandardMaterial3D.new()
	m.albedo_color = Color(0.60, 0.62, 0.64)
	m.metallic = 0.9
	m.roughness = 0.42
	var ruido := FastNoiseLite.new()
	ruido.frequency = 0.02
	ruido.fractal_octaves = 3
	var tx := NoiseTexture2D.new()
	tx.width = 256
	tx.height = 64
	tx.noise = ruido
	tx.seamless = true
	m.roughness_texture = tx
	m.roughness_texture_channel = BaseMaterial3D.TEXTURE_CHANNEL_RED
	m.uv1_scale = Vector3(0.5, 2.0, 1.0)
	m.cull_mode = BaseMaterial3D.CULL_DISABLED
	_mat_cache = m
	return m

const SHADER_FITA := """
shader_type spatial;
render_mode cull_disabled;
uniform float cabeca = 100.0;   // x da ponta da chapa (o que passa disso não existe ainda)
uniform float cauda = -100.0;   // x do fim da chapa (fim de bobina passando)
uniform float desvio = 0.0;     // deslocamento lateral na entrada (guia mal ajustada), some nos rolos
uniform float x_rolos = 0.0;
uniform vec3 cor : source_color = vec3(0.60, 0.62, 0.64);
varying float vx;
void vertex() {
	vx = VERTEX.x;
	float k = clamp((x_rolos - VERTEX.x) / 1.2, 0.0, 1.0);
	VERTEX.z += desvio * k;
}
void fragment() {
	if (vx > cabeca || vx < cauda) { discard; }
	ALBEDO = cor;
	METALLIC = 0.9;
	ROUGHNESS = 0.38 + 0.08 * sin(vx * 7.0) * sin(UV.y * 31.0);
}
"""

static func material_fita() -> ShaderMaterial:
	var sh := Shader.new()
	sh.code = SHADER_FITA
	var m := ShaderMaterial.new()
	m.shader = sh
	return m

## bobina: nas faces laterais aparecem as espiras (anéis concêntricos), no corpo a chapa enrolada
const SHADER_BOBINA := """
shader_type spatial;
varying vec3 lv;
void vertex() { lv = VERTEX; }
void fragment() {
	float r = length(lv.xz);
	float lado = step(0.595, abs(lv.y));          // face lateral do cilindro (altura 1,2)
	float anel = 0.5 + 0.5 * sin(r * 1400.0);     // espiras (~4,5 mm por anel, legível)
	float faixa = 0.5 + 0.5 * sin(r * 90.0);
	vec3 base = vec3(0.60, 0.62, 0.64);
	vec3 face = base * (0.82 + 0.10 * anel + 0.06 * faixa);
	ALBEDO = mix(base, face, lado);
	METALLIC = mix(0.9, 0.7, lado);
	ROUGHNESS = mix(0.36, 0.55, lado);
}
"""
static var _mat_bob: ShaderMaterial
static func material_bobina() -> ShaderMaterial:
	if _mat_bob:
		return _mat_bob
	var sh := Shader.new()
	sh.code = SHADER_BOBINA
	_mat_bob = ShaderMaterial.new()
	_mat_bob.shader = sh
	return _mat_bob
