# 02 - MAPA MENTAL

**Objetivo:** Oferecer uma visão de alto nível de como as peças do sistema se conectam.

## Visão Geral da Arquitetura

```text
[ NAVEGADOR DO USUÁRIO ]
      │
      ├── (Captura via DOM/Canvas)
      │
[ EXTENSÃO CHROME ]
      │
      ├── (WebSocket / REST API) -> Auth: Device JWT Token
      │
[ BACKEND NESTJS ]
      ├── Módulos: Extension, Users, QR, Payments, Events
      ├── Database: SQLite (Dev) -> PostgreSQL (Prod)
      │
      ├── (WebSocket) -> Auth: API Key
      │
[ DASHBOARD NEXT.JS ]
      ├── Filas em Tempo Real
      ├── Aprovação / Rejeição
      └── Configurações (API Key)
```

## Fluxo Lógico Principal
1. **Vinculação:** Dashboard gera API Key -> Extensão usa API Key para gerar Token Único.
2. **Descoberta:** Extensão detecta imagem Pix (jsQR).
3. **Deduplicação L1:** Cache local verifica Hash SHA-256.
4. **Ingestão:** Backend valida Hash (Deduplicação L2) e salva como `PENDING`.
5. **Realtime:** Backend notifica Dashboard via WebSocket.
6. **Decisão:** Usuário aprova no Dashboard.
7. **Pagamento:** Evento aciona o Adaptador de Pagamento (Asaas) -> Retorna Status.
8. **Feedback:** Dashboard é atualizado com Sucesso ou Falha.

## Espaço para Futuras Atualizações
*(Adicionar mapeamento de novos serviços e integrações)*
