#!/bin/bash
set -e

echo "======================================================"
echo "  AIOS - TESTE COMPLETO DE EXTENSAO"
echo "======================================================"
echo ""

# Get column names
echo "=== COLUNAS DA TABELA users ==="
docker exec -i aios_postgres psql -U aios -d aios_db <<'ENDSQL'
SELECT column_name FROM information_schema.columns WHERE table_name='users' ORDER BY ordinal_position;
ENDSQL

echo ""
echo "=== USUARIOS ATIVOS ==="
docker exec -i aios_postgres psql -U aios -d aios_db <<'ENDSQL'
SELECT email, api_key, is_active, role FROM users LIMIT 3;
ENDSQL

echo ""
echo "=== TENTATIVA COM CAMELCASE ==="
docker exec -i aios_postgres psql -U aios -d aios_db <<'ENDSQL'
SELECT email, "apiKey", "isActive", role FROM users LIMIT 3;
ENDSQL

echo ""
echo "=== DISPOSITIVOS DE EXTENSAO ==="
docker exec -i aios_postgres psql -U aios -d aios_db <<'ENDSQL'
SELECT * FROM extension_devices ORDER BY last_seen DESC LIMIT 5;
ENDSQL
