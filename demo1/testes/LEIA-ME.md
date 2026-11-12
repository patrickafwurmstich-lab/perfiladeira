# Testes automáticos da Demo 1 (79 verificações + ciclo completo)

| Arquivo | O que testa |
|---|---|
| teste_ciclo_completo.js | Caminho feliz: caminhão → ponte → instalar → cabo → bobina → produzir → paleteira → pedido → coleta → cabo estoura → morte → save/load |
| teste_quebrar_o_jogo.js (32) | Coleta parcial e entrega parcial, modo devolver, save com caminhão, valores negativos, dia 30, FINAME, bobina retirada no meio, mover máquina, morrer com paleteira, multa, save inválido, mesa cheia, retalho, cabo no cancelar, carga da ponte batendo, área de operação, AABB girada, soltar em lugar livre |
| teste_mesa_carregamento.js (6) | Pacotes, desbalanceada, sobreposição, arrumação automática, cintas, carga amassada |
| teste_empilhadeira.js (16) | Entrega, pegar/soltar, garfo alto, tombar sem/com cinto, desvirar, bobina sem mandril, mandril, save/load |
| teste_funcionarios.js (16) | Armários = vagas, contratar, operador roda lotes, ajudante leva pilha, tortas escondidas, inspecionar, orientar, prioridade, folha, operação tartaruga, curso, save/load |
| teste_morte_e_interface.js (9) | Morrer no meio do progresso/minijogo, tecla repetida, perder foco, chamada perdida, caminhão travado, fornecedor esquecido, carga visual, debug escondido |

Como rodar: servir a pasta do repositório (`python3 -m http.server 8765`), colocar o `three.min.js` (r128) nesta pasta e rodar `node <arquivo>` (precisa do Playwright).
