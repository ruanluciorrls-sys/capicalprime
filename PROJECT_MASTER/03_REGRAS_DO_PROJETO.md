# 03 - REGRAS DO PROJETO

**Objetivo:** Listar restrições inegociáveis e regras de negócio essenciais.

## Regras Fixas
1. **Extensão sem login:** A extensão não deve ter tela de login tradicional (usuário/senha).
2. **Vinculação Automática:** A extensão é vinculada ao usuário via API Key gerada no dashboard.
3. **Download Facilitado:** O usuário deve baixar a extensão diretamente pelo Dashboard.
4. **Captura Ilimitada:** Não há limite para a quantidade de capturas de QR Codes.
5. **Valores Repetidos:** O mesmo valor monetário pode repetir infinitamente.
6. **QR Code Único:** O mesmo Payload de QR Code (Hash SHA-256 completo) NÃO PODE repetir sob nenhuma hipótese.
7. **Aprovação Obrigatória:** Nenhum pagamento pode ser executado sem ação explícita (aprovação manual) do usuário no Dashboard.
8. **Tempo Real Obrigatório:** A comunicação entre extensão, backend e dashboard deve ser em *realtime* (via WebSocket).
9. **API de Pagamento:** Utilizar Asaas inicialmente. A arquitetura deve prever Padrão Adapter para outros bancos no futuro.
10. **Estratégia de Deploy:** Funcionar inicialmente local (Local-first, SQLite), com estrutura preparada para Web (Deploy, PostgreSQL).

## Espaço para Futuras Atualizações
*(Adicionar novas regras de negócio conforme a plataforma amadurece)*
