# PARECIS TELHA — Mecânicas v2: simulação de verdade

Versão 1, madrugada de 13/11/2026. Mediador: Claude. Revisores: ChatGPT, Grok e Gemini, todos com pedido de rigor.

Ponto de partida: o Lucas avaliou a Demo como "3% de um simulador", e as três IAs concordaram com o diagnóstico.

## Regras do Lucas para esta fase
1. **Tudo sincronizado.** O que a tela mostra é o que o jogo calcula. Nada de "a conta anda num lugar e a animação noutro". Um metro de chapa visto saindo é um metro a menos na bobina, um metro de desgaste nos rolos, um pouco de energia no medidor e um metro no estoque.
2. **Mais realismo agora, simplificar depois.** É melhor tirar algo por ser realista demais do que faltar.
3. **Ser chato e detalhista.** Sempre perguntar o que falta e o que ainda não conversa com o resto.

## 1. Fontes juntadas
- **Simulador antigo** (`Perfiladeira_Simulador.html`, 10/11), que já tinha:
  - fita saindo tangente da bobina e chapa ganhando o perfil estação a estação;
  - telha crescendo na saída, guilhotina descendo com som, telha deslizando e empilhando encaixada;
  - troca de bobina em sequência (núcleo vazio vai ao berço, ponte busca bobina nova, operador puxa a ponta e passa pelas estações);
  - armário de comando com tela viva, operador apertando o botão, ajudante retirando a pilha.
- **Idle antigo "Parecis Telha 3D"** (`jogo/index.html`): caminhões entrando, empilhadeira, ponte, pilhas, barracão travado para expansão.
- **Demo 1 atual:** economia, pedidos, loja, PC, ponte com sobrecarga, empilhadeira, paleteira, funcionários, balcão e zoeira.
- **"Sala de decisão"** (GDD dos 8 temas): Godot 4 Compatibility, ponte simplificada com cabo que estoura, zoeira e quadro elétrico com kW.
- **Sistema do amigo:** não achei um arquivo separado no PC nem no GitHub. **Pergunta para o Lucas:** onde está? Se for o simulador antigo, já está incluído.

## 2. Relógio: a decisão central
- O relógio do jogo é 1 h = 72 s reais (turno 7h–17h = 12 min reais). Seguindo esse relógio, a perfiladeira real (12 m/min) faria 10 m/s na tela, um borrão. É por isso que hoje a telha "aparece do nada".
- **Decisão:** a máquina anda numa velocidade que dá para enxergar, **3 vezes a real** (0,6 m/s; telha de 6 m em 10 s). A conta usa exatamente a mesma velocidade: 0,72 m por minuto de jogo, cerca de 430 m por turno de 10 h no máximo teórico e uns 200–300 m na prática, com setup, troca de bobina e falhas. O x1/x5/x20 acelera tudo junto.
- Fica em `dados.js` (`producao.fatorVisual = 3`), para ajustar depois.
- **Rebalanceamento** (proposta do Gemini, conferida):
  - pedreiro: 10–30 telhas, prazo de 2–3 dias;
  - construtora: 100–300 m², prazo de 7–10 dias;
  - revenda e agro: lotes maiores, que pedem a 2ª máquina ou funcionário;
  - mesa de saída: até 60 telhas.
- **Correção do mediador:** o Grok calculou 36 m por minuto de jogo, o que está errado. São 0,72 m.

## 3. Princípio de interação: cada ação tem lugar físico
| Ação | Onde se faz (o E só aparece ali) |
|---|---|
| Ligar, desligar, emergência, reset, automático/manual, avanço lento, comprimento, quantidade, correção e peça teste | **Caixa de comando (CLP)** da máquina: a câmera aproxima e os botões são 3D, clicados com o mouse |
| Puxar o cabo do quadro | Na entrada elétrica da máquina (prensa-cabo do CLP) |
| Cortar a cinta da bobina e puxar a ponta | Na bobina montada |
| Ajustar as guias | Nas manivelas da mesa de entrada: a câmera aproxima, a régua aparece e o mouse gira a manivela |
| Medir a peça | Na saída: trena sobre a telha |
| Graxa | Nos bicos de graxa (graxeiras amarelas) nos castelos |
| Cortar o enrosco | No ponto exato onde a chapa amassou |
| Retirar a pilha | Pilha sobre pontaletes no chão, ao fim da saída (paleteira, empilhadeira ou ajudante) |

## 4. Perfiladeira TP-40: o ciclo completo
**Preparação:**
1. **Energia:** cabo puxado do quadro, com kW somados no quadro (já existe).
2. **Chave geral** no CLP (girar 0→1): o painel acende, a IHM liga e a torre fica âmbar ("pronta, sem material").
3. **Emergência:** se estiver apertada, nada liga. Para soltar, clica de novo ("girar") e depois **RESET** (o botão azul pisca quando precisa).
4. **Bobina:** levada com a ponte até o mandril do desbobinador. O mandril expande, com som de trava.
5. **Cortar a cinta** na bobina (progresso de 1,5 s; som de "tlec" e a cinta some).
6. **Puxar a ponta:** o jogador segura a ponta e anda até a mesa de entrada; a fita acompanha a mão dele. Chegando lá, "encaixar nas guias".
7. **Avanço lento (JOG)** segurado no CLP: a fita avança devagar pelas 13 estações, formando, até o sensor da guilhotina. Para sozinha no sensor.

**Ajuste e produção:**

8. **Guias:** a ponta entra com um desvio aleatório de ±25 mm. Na manivela, a régua mostra o desvio. Dentro de ±2 mm é perfeito; acima de 8 mm sai telha ondulada (visível) e o risco de enrosco sobe.
9. **IHM:** produto, comprimento, quantidade, velocidade (60–100%) e **correção de comprimento** (±mm).
10. **Peça teste** no modo manual: sai 1 telha e para.
11. **Trena:** mede a telha na saída. O erro vem da calibração do encoder (desvio inicial aleatório de ±15 mm, que cresce com o desgaste) e da guia torta. O jogador corrige na IHM.
    - Erro < 2 mm com guia boa = **"PRIMEIRA TELHA PERFEITA!"** (conquista e confiança).
    - Fora da tolerância (±5 mm), a peça vira 2ª linha (desconto) ou sucata.
12. **Automático + LIGA:** a sirene de partida toca 2 s antes de qualquer movimento. Depois roda o ciclo contínuo:
    - bobina gira e encolhe (raio de 0,32 para 0,254 m, cálculo real pelo peso);
    - fita tangente;
    - rolos girando na velocidade certa;
    - chapa formando estação a estação, a onda nascendo do centro para as bordas;
    - telha crescendo depois da guilhotina;
    - no comprimento programado: **para 0,4 s**, a lâmina desce (THOC), a telha desliza e **cai na pilha encaixada**, uma por uma.

**Paradas automáticas:**
- **lote concluído:** buzina curta, torre azul;
- **mesa cheia:** sensor de presença;
- **fim de bobina:** aviso aos 10% (âmbar e bip); no fim, a ponta passa pelas estações e a última peça incompleta vira retalho;
- **enrosco:** pancada, torre vermelha, chapa amassada parada nos rolos;
- **emergência:** qualquer um pode apertar.

**Som:**
- zumbido do motor, conforme o estado;
- atrito dos rolos com a chapa;
- THOC da guilhotina e telha caindo na pilha;
- **chiado que aumenta com o desgaste e a falta de graxa**: é o aviso de enrosco, para dar tempo de correr até a emergência;
- tudo com volume pela distância.

**Desgaste e graxa:** 6 graxeiras físicas. Graxa reduz o desgaste e o chiado. O desgaste aumenta o erro de comprimento e a chance de enrosco.

## 5. Guilhotina (linha de corte de chapa plana) e dobradeira
- **Guilhotina:** mesma caixa de comando e mesma bobina, cinta, ponta e JOG.
  - O endireitador (7 rolos) gira, a roda do encoder gira encostada na chapa e o batente fica na mesa.
  - Chapa plana corta no comprimento, desliza e empilha.
  - Ajuste do endireitador: chapa com "memória de bobina" (empenada) se estiver mal ajustado.
- **Dobradeira** (manual, rufos):
  - chapas na entrada, uma chapa por vez na mesa;
  - encostar no batente traseiro (régua);
  - **fechar a viga de fixação** (alavanca);
  - **puxar o avental com o mouse** até o ângulo (90°/135°, escala visível);
  - abrir, virar a peça para a próxima dobra conforme o desenho do rufo e retirar a peça.
  - Errar o ângulo além de ±3° vira 2ª linha.

## 6. Ponte rolante (já é a mais "física")
- **Acrescentar:**
  - tambor girando com o cabo;
  - engate só com o gancho alinhado ao furo da bobina (indicador);
  - balanço que acumula ao parar de repente;
  - indicador de carga na botoeira, mostrando a % da capacidade;
  - o cabo vibra e range acima de 90%.
- **Já existe:** estouro, queda, cicatriz e morte.

## 7. Sincronização: quem conversa com quem
| Acontecimento | Quem fica sabendo |
|---|---|
| 1 m de chapa formado | bobina (−1 m), desgaste (+), graxa (−), energia (kW×tempo), som, contador da IHM |
| Telha cortada | pilha (+1, encaixada), IHM (produzidas), pedido vinculado (progresso), sucata se fora da tolerância |
| Pilha na mesa | sensor da mesa (cheia → para), ajudante (tarefa de retirar), paleteira e empilhadeira |
| Fim de bobina | torre âmbar, IHM, funcionário mecânico/operador (tarefa de troca), estoque (núcleo vazio), compras (aviso de bobina acabando no estoque) |
| Enrosco | torre vermelha, som, tarefa do mecânico, reputação (atraso), sucata, placa de acidentes se alguém estiver perto e se machucar |
| Emergência apertada | todas as máquinas na mesma caixa, funcionário para e reclama, zoeira |
| Disjuntor desarmado | todas as máquinas do quadro, IHM apagada, celular |
| Peça fora de medida | qualidade (reputação), cliente reclama na entrega se a 2ª linha for junto |
| Noite | máquina ligada gasta energia; peça pela metade continua na máquina (Demo já faz) |

## 8. O que NÃO simular (por enquanto)
Física real de deformação da chapa, torque por estação, temperatura, viscosidade do óleo hidráulico e colisão individual de telhas. A pilha é um objeto só, que ganha camadas.

## 9. Ordem de implementação (esta noite)
1. Relógio com 3× e conta igual à animação; rebalancear pedidos.
2. Linha contínua da perfiladeira (fita, formação, telha, corte, deslize, pilha encaixada), bobina girando e encolhendo do jeito certo, rolos e lâmina.
3. Caixa de comando 3D (câmera aproxima, botões clicáveis, IHM viva, sirene, torre).
4. Preparação física (cinta, ponta puxada a pé, JOG, manivelas das guias, trena, correção, peça teste, "primeira telha perfeita").
5. Falhas visíveis (ondulada, enrosco amassado, chiado, graxeiras).
6. Guilhotina e dobradeira no mesmo nível.
7. Funcionários executando as mesmas etapas, com o tempo de cada uma.
8. Testes, prints e revisão das IAs em cada etapa.
