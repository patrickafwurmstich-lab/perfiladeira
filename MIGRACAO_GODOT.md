# PARECIS TELHA — Plano de migração da Demo 1 (HTML) para o Godot

Status: proposta para revisão (Lucas + ChatGPT + Grok). Versão 1, 12/11/2026.

## 1. Decisões que já valem
- **Engine:** Godot 4.7 (estável desde junho/2026), renderizador **Compatibility** (o notebook do Lucas é Ryzen 5 3500U + Vega 8, 8 GB).
- **Linguagem:** GDScript (tipado). Nada de C#: deixa o projeto leve e exporta para Web se precisar.
- **A Demo 1 é a especificação.** Toda regra, número e caso de bug que a Demo testou vira requisito. Os mais de 100 testes automáticos da Demo viram a lista de testes do Godot.
- **Câmera:** 3ª pessoa atrás do ombro (SpringArm3D, não atravessa parede) + 1ª pessoa (tecla V). Sem câmera livre.
- **Arte:** os GLBs feitos nesta fase entram direto. Estilo low poly de cores chapadas, com os personagens da ithappy.

## 2. Estrutura do projeto
```
perfiladeira/godot/
  project.godot
  autoload/      EventBus.gd  Dados.gd  Tempo.gd  Economia.gd  Reputacao.gd  Pedidos.gd  Estoque.gd  Save.gd  Zoeira.gd
  dados/         dados.json        (cópia 1:1 do demo1/js/dados.js — balanceamento continua num lugar só)
  cenas/         Barracao.tscn  Jogador.tscn  CameraRig.tscn  Maquina.tscn  Ponte.tscn  Caminhao.tscn  Npc.tscn  Empilhadeira.tscn  Loja.tscn
  ui/            Hud.tscn  ParecisOS.tscn (o PC)  Clp.tscn  Ligacao.tscn  Minijogo.tscn  Celular.tscn
  modelos/       *.glb dos modelos do Claude + Grab3D/Kenney (CC0)
  privado/       personagens ithappy (fica FORA do GitHub, no .gitignore)
  testes/        GUT (Godot Unit Test), em modo headless
```

## 3. Mapa: arquivo da Demo → Godot
| Demo 1 (JS) | Godot 4 | Observação |
|---|---|---|
| eventos.js | autoload `EventBus` (signals) | os nomes de evento ficam iguais (`pedidoNovo`, `morreu`, `minuto`…) |
| dados.js | `dados/dados.json` + autoload `Dados` | um script converte o JS em JSON |
| tempo.js | autoload `Tempo` (passo fixo de 1 min de jogo; velocidade x1/x5/x20) | o tempo acelerado nunca passa por frame |
| economia.js, reputacao.js, pedidos.js | autoloads de lógica pura (sem nós 3D) | são os primeiros a migrar, com testes |
| estoque.js | autoload `Estoque` + cenas `Bobina`, `Pilha` | a pilha usa MultiMesh para as telhas |
| save.js | autoload `Save` (JSON, `save_version`) | mesmo formato da Demo; dá para importar o save da Demo |
| mundo.js | `Barracao.tscn` (estrutura GLB + piso + colisões) + `Jogador.tscn` (CharacterBody3D) + `CameraRig.tscn` | as colisões AABB viram StaticBody3D |
| maquinas.js | `Maquina.tscn` genérica + recurso `MaquinaDef` (perfiladeira/guilhotina/dobradeira = dados) | luz da torre do CLP, rolos girando (`rolo_inf_*`), lâmina (`lamina`), avental (`avental`) |
| ponte.js | `Ponte.tscn` (viga dupla, carro, gancho) | o cabo é um cilindro escalado; botoeira = modo de controle |
| construcao.js | nó `ModoConstrucao` (fantasma + grade de 0,5 m, raio a partir do centro da tela) | |
| entrega.js | `Caminhao.tscn` + Path3D/PathFollow3D | o corredor vira um caminho fixo |
| funcionarios.js, balcao.js | `Npc.tscn` + NavigationAgent3D (navmesh assada) | troca o "andar até" caseiro |
| empilhadeira.js, carregamento.js | `Empilhadeira.tscn` (cinemática) + mesa de carregamento (UI) | |
| zoeira.js | autoload `Zoeira` + ragdoll (PhysicalBone3D no esqueleto ithappy) | morte, boleto, "0 dias sem acidente" |
| ui.js, pc.js, pc_apps.js | cenas Control (HUD, ParecisOS, CLP, ligação, minijogo) | o PC continua sendo o "sistema operacional" do jogo |
| modelos.js, modelos3d.js, producao_modelos.js | não migram | no Godot o GLB entra direto; a lista vira documentação |

## 4. Modelos 3D
- **Do Claude (42 GLB):** `modelos3d/claude/glb/` são importados como estão. Nós já nomeados para animar: `rolos/rolo_inf_N`, `lamina`, `avental`, `luz_verde/ambar/vermelha`, `teto` (some com o jogador dentro), `face` da placa de acidentes.
- **Grátis (CC0):** Grab3D (versões leves de até 5k triângulos em `modelos3d_gratis/leves`) e Kenney.
- **Personagens ithappy:** importar o `personagens_ithappy.glb` (corpo + 23 peças + 15 animações) ou o `.blend` direto (o Godot importa .blend com o Blender instalado). AnimationTree com BlendSpace1D (parado → andando → correndo) e estados de morte/queda. **Não vai para o GitHub público** (licença Fab): pasta `privado/` ou repositório privado.
- **LOD:** o Godot gera LOD automático na importação. Mesmo assim, a estrutura do barracão já vem fundida por cor (40k triângulos, poucas chamadas de desenho).

## 5. Ordem de trabalho (marcos)
1. **M1 — Lógica sem gráfico:** projeto, EventBus, Dados, Tempo, Economia, Reputação, Pedidos e Save. Os testes da Demo são portados para o GUT. *Pronto quando os testes de economia, pedidos e save passarem headless.*
2. **M2 — Andar no barracão:** cena do barracão com os GLBs, jogador ithappy animado, câmera 3ª/1ª pessoa, colisões, escritório/loja com teto que some.
3. **M3 — Produzir:** máquina genérica, bobina no mandril, cabo do quadro, CLP, alinhamento (minijogo), produção, mesa de saída e pilhas.
4. **M4 — Ponte e zoeira:** botoeira, carga pendurada, sobrecarga, cabo estourando, ragdoll e respawn.
5. **M5 — Vender:** PC (loja, banco, e-mail, pedidos), ligações, caminhão de entrega e coleta, loja de balcão.
6. **M5.5 — Loop completo com NPCs parados (Grok):** comprar → receber → produzir → vender → entregar → morrer funcionando do começo ao fim, com funcionários e clientes ainda sem navegação, para testar o fluxo antes da IA dos NPCs.
7. **M6 — Equipe:** funcionários e clientes com navmesh, empilhadeira, mesa de carregamento.
8. **M7 — Desempenho no notebook e exportação:** exportar para Windows e medir no notebook do Lucas.

## 6. Metas de desempenho (Ryzen 5 3500U / Vega 8)
- **Meta obrigatória: 30 fps estáveis a 1080p** no notebook do Lucas. 60 fps é desejável e só com qualidade baixa (sombras curtas, LOD agressivo). Correção do Grok: 60 fps em qualidade média era otimista para a Vega 8.
- Medir desde o M2, sem deixar para o M7, com uma cena-teste fixa (barracão + 3 máquinas + 7 personagens + ponte carregando).
- Até cerca de 300 chamadas de desenho e até 300 mil triângulos visíveis.
- 1 luz direcional com sombra (2 cascatas) e luz ambiente de céu. Sem SDFGI nem volumetria (o Compatibility nem tem).
- No máximo 7 personagens com esqueleto na tela (dono + 6 funcionários); clientes da loja só quando o jogador está perto.
- Física: Jolt (embutido no Godot desde a 4.4). Ragdoll só no dono.

## 7. Riscos
- **Compatibility renderer:** menos efeitos de luz. O estilo de cores chapadas não depende deles.
- **Licença ithappy:** controlar o que vai para o repositório público.
- **Tempo acelerado (x20):** já resolvido na Demo com passo fixo; replicar igual (sub-passos anti-túnel do caminhão e da ponte).
- **Save:** manter `save_version` e migrador desde o primeiro dia. Importar o save da Demo só em estado "parado": a Demo já bloqueia salvar com carga na ponte, caminhão no pátio ou cliente no balcão. Uma peça pela metade na máquina é guardada (`progressoM`), como já é na Demo.
- **Navegação (Grok):** o jogador instala máquinas onde quiser, então a navmesh precisa acompanhar. Cada máquina e pilha recebe um NavigationObstacle3D (desvio na hora). A navmesh é reassada em segundo plano depois de cada instalação ou mudança.
- **Ragdoll + quedas:** quando o cabo estoura, cai a carga e o dono vira ragdoll ao mesmo tempo. Limitar a uns 20 corpos rígidos ativos e "dormir" os objetos parados.

## 8. O que o Lucas precisa fazer
- Instalar o Godot 4.7 (versão padrão, não a .NET) no notebook.
- Dizer se o repositório do Godot fica no mesmo GitHub (pasta `godot/`) ou num repositório privado, por causa dos personagens.
