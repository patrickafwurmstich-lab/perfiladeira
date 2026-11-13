# PARECIS TELHA — Mecânicas × Animações

Versão 1, 13/11/2026. Para revisão do Lucas e das IAs. Vale para a Demo 1 e para o Godot.

**Legenda:**
- ✅ já existe e está no jogo
- 📦 existe no pack ithappy, mas ficou fora do arquivo: reexportar
- 🛠️ falta, o Claude faz no Blender (pose-chave simples no esqueleto ithappy)
- 🎛️ animação de objeto feita no código (rolos, lâmina, garfo...)
- 🧲 resolvido por IK/encaixe no Godot (mão na alça, pé no pedal)

## 1. Animações que o pack ithappy tem (30 no total)
- **No arquivo hoje (15):** Idle_Relaxed, Idle_Look_Around, Idle_Breathing, Walk_Forward, Run_Forward, Death_Backward, Death_Forward, Fall, Hit_Reaction_Light, Hit_Reaction_Heavy, Jump_Start, Jump_Loop, Jump_End, Crouch_Walk_Forward, Climb_Ladder.
- **Ficaram de fora e precisam voltar (📦):** Walk_Backward, Strafe_Left, Strafe_Right, Run_Backward, Run_Left, Run_Right, Crouch_Walk_Backward, Crouch_Walk_Left, Crouch_Walk_Right. Com a câmera nova, A/D anda de lado e S anda de costas.
- **Não servem para este jogo:** ataques, bloqueio, esquiva e A-pose.

## 2. Jogador (dono): mecânica → animação
| Mecânica (como é na Demo) | Animação do personagem | Situação | Animação do objeto |
|---|---|---|---|
| Andar / correr (WASD, Shift) | Walk/Run em 8 direções (blend 2D) | ✅ frente · 📦 lados/trás | — |
| Parado | Idle_Relaxed; depois de 8 s sem mexer, Idle_Look_Around | ✅ | — |
| Usar o computador (escritório) | Sentar na cadeira + digitar (loop) | 🛠️ Sentar_Digitar | tela acende |
| Abrir painel CLP / ajustar | Em pé, braço apertando botões (loop curto) | 🛠️ Painel_Apertar | luz da torre ✅ |
| Alinhar chapa (minijogo) | Duas mãos empurrando a chapa de lado | 🛠️ Empurrar_Chapa | chapa desliza 🎛️ |
| Peça teste / produzir | Idle olhando a máquina (Idle_Look_Around) | ✅ | rolos girando 🎛️, lâmina descendo 🎛️, telha saindo 🎛️ |
| Passar graxa nos rolos | Agachado, mão indo e voltando | 🛠️ Agachado_Mexer | — |
| Cortar enrosco com esmerilhadeira | Agachado segurando a ferramenta (vibra) | 🛠️ Agachado_Mexer + esmerilhadeira na mão 🧲 | faíscas 🎛️ |
| Inspecionar lote | Inclinar e olhar (agachar rápido) | 🛠️ Inspecionar | — |
| Puxar cabo do quadro | Andar segurando o cabo (braço para trás) | 🛠️ Andar_Puxando (camada só de braço) | cabo se estende ✅ |
| Trocar quadro / remendar piso / instalar máquina | Agachado trabalhando (genérico) + barra de progresso | 🛠️ Agachado_Mexer | — |
| Pegar a botoeira da ponte | Braço levantado segurando o controle (camada de braço) + andar normal | 🛠️ Botoeira_Segurar | ponte, carro, gancho e cabo ✅ |
| Engatar / baixar carga | Apertar botão da botoeira | 🛠️ (mesma, com "aperto") | gancho sobe/desce ✅ |
| Carregar caixa pequena na mão | Andar com os dois braços na frente (camada de braço) | 🛠️ Carregar_Caixa | caixa presa às mãos 🧲 |
| Paleteira (pegar, empurrar, largar) | Andar empurrando, mãos na alça | 🛠️ Empurrar (camada de braço) + 🧲 | garfo sobe/desce 🎛️ |
| Empilhadeira (subir, dirigir, sair) | Subir/descer (curta) + sentado dirigindo | 🛠️ Sentar_Dirigir (+ Subir) | garfo/mastro 🎛️, rodas 🎛️ |
| Atender o balcão | Em pé atrás do balcão, gesto de conversa | 🛠️ Conversar (gesto de braço) | — |
| Atender telefone / celular | Mão na orelha (camada de braço) | 🛠️ Telefone | celular na mão 🧲 |
| Montar a carga (mesa de carregamento) | Agachar e levantar pegando peças | 🛠️ Agachado_Mexer | pilha cresce 🎛️ |
| Morrer (cabo estourou, bobina caiu) | Hit_Reaction_Heavy → Death_Backward (Demo) · ragdoll (Godot) | ✅ Demo · Godot com ragdoll | carga cai 🎛️, cicatriz no piso ✅ |
| Respawn na porta do escritório | Levantar do chão (ou entrar "zonzo") | 🛠️ Levantar | placa "0 dias" ✅ |
| Escada | Climb_Ladder | ✅ (sem escada no jogo ainda) | — |

## 3. Funcionários (6 agentes) — mesmas animações do dono, com capacete do cargo
| Tarefa (funcionarios.js) | Animação |
|---|---|
| deslocar | Walk/Run ✅ |
| operar (perfiladeira/guilhotina/dobradeira) | Painel_Apertar em loop + Idle_Look_Around 🛠️ |
| graxa / manutenção (mecânico) | Agachado_Mexer 🛠️ |
| tirar enrosco | Agachado_Mexer + esmerilhadeira 🛠️ |
| expedição (ajudante, empilhar e carregar) | Carregar_Caixa / Empurrar paleteira 🛠️ |
| parado / aviso | Idle_Relaxed / Idle_Look_Around ✅ (teimoso e preguiçoso: Idle_Breathing mais lento) |
| "tartaruga" (personalidade lenta) | Walk com velocidade 0,7 ✅ |
| enroscada (máquina parou com ele) | Hit_Reaction_Light → coçar a cabeça 🛠️ Coçar_Cabeça |

## 4. Clientes, motorista e NPCs
| Quem | Animação |
|---|---|
| Cliente chegando a pé / indo embora | Walk ✅ |
| Cliente na fila do balcão | Idle_Relaxed / Idle_Look_Around ✅; "cansei de esperar" = braços cruzados 🛠️ Impaciente |
| Motorista do caminhão | Sentado na cabine (Sentar_Dirigir) 🛠️; buzina = animação do objeto |
| Galinha do Seu Lauro | Pack ithappy Animals FREE (já tem andar e ciscar) |

## 5. Animações de objeto (feitas no código, sem esqueleto)
| Objeto | Animação | Nós prontos no GLB |
|---|---|---|
| Perfiladeira | Rolos girando na velocidade da produção; telha saindo; guilhotina descendo e voltando a cada corte | `rolos/rolo_inf_N`, `rolo_sup_N`, `lamina` |
| Guilhotina (linha de corte) | Endireitador girando, roda do encoder, lâmina | `rolo`, `roda_medicao`, `lamina` |
| Dobradeira | Avental girando até o ângulo (90°/135°), viga de fixação descendo | `avental`, `viga_fixacao` |
| Ponte rolante | Carro, viga e gancho ✅; tambor girando conforme o gancho sobe/desce | `tambor` |
| Caminhão | Rodas girando, pisca/ré, buzina | `roda_*` |
| Empilhadeira e paleteira | Garfo/mastro subindo, rodas | modelo Grab3D (separar o garfo no Blender) |
| CLP | Torre de luz por estado ✅ | `luz_verde/ambar/vermelha` |
| Placa de acidentes | Número trocando ✅ | `face` |

## 6. Como fazer as 🛠️ (proposta)
- **Lista curta: 12 animações novas.** Sentar_Digitar, Painel_Apertar, Empurrar_Chapa, Agachado_Mexer, Inspecionar, Botoeira_Segurar, Carregar_Caixa, Empurrar, Sentar_Dirigir (com Subir), Conversar, Telefone, Levantar. Mais Coçar_Cabeça e Impaciente, se sobrar tempo.
- **De corpo inteiro:** sentar, agachar, levantar e inspecionar.
- **Só de braço** (o corpo continua andando com Walk/Run): carregar, empurrar, botoeira e telefone. No Godot isso vira uma camada do AnimationTree com filtro de ossos; na Demo, a mistura é feita com máscara de ossos.
- **Fonte:**
  - Primeiro, o Claude faz poses-chave no Blender por script, no esqueleto ithappy (0,5 a 1,5 s cada, em loop). É o estilo do pack: movimento simples e "de boneco".
  - Se faltar qualidade, Mixamo (grátis, mas pede login do Lucas) com reaproveitamento de esqueleto (retarget) para o ithappy.
- **Mão e objeto (🧲):** na Demo, o objeto é preso ao osso da mão. No Godot: BoneAttachment3D + SkeletonIK/LookAt para a mão alcançar a alça.

## 7. Decisões para o Lucas
1. **Morte:** na Demo continua animação (Hit → Death). No Godot, ragdoll (mais engraçado, mais caro). Ok?
2. **1ª pessoa:** mostrar mãos/ferramenta só durante operação (botoeira, esmerilhadeira, CLP) ou nunca?
3. **Fonte das 12 animações:** começar pelas feitas no Blender (sem login) e trocar pelas do Mixamo só as que ficarem ruins?
4. **Prioridade:**
   - (a) reexportar andar de lado/de costas;
   - (b) rolos, lâmina e avental das máquinas;
   - (c) Painel, Agachado e Carregar;
   - (d) o resto.
