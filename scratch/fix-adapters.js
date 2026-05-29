const fs = require('fs');
const path = require('path');

const adaptersDir = path.join(__dirname, '../apps/backend/src/modules/payments/adapters');

const interfaces = {
  'asaas.adapter.ts': 'AsaasResponse',
  'bb.adapter.ts': 'BancoDoBrasilResponse',
  'efi.adapter.ts': 'EfiResponse',
  'inter.adapter.ts': 'InterResponse',
  'mercadopago.adapter.ts': 'MercadoPagoResponse',
};

for (const [file, iface] of Object.entries(interfaces)) {
  const filePath = path.join(adaptersDir, file);
  if (!fs.existsSync(filePath)) {
    console.log(`Not found: ${filePath}`);
    continue;
  }
  
  let content = fs.readFileSync(filePath, 'utf8');
  
  if (!content.includes(iface)) {
    content = `import { ${iface} } from '../types/api-responses.type';\n` + content;
  }
  
  content = content.replace(/const data = await response\.json\(\);/g, `const data = (await response.json()) as ${iface};`);
  
  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`Updated ${file}`);
}
