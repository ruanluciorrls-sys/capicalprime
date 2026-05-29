const fs = require('fs');
const path = require('path');
const archiver = require('archiver');
const { Client } = require('ssh2');
const crypto = require('crypto');

// Configuration
const CONFIG = {
  host: '177.153.202.47',
  username: 'root',
  password: '69608206Ru@n',
  localDir: 'C:\\Users\\RUAN CPA\\Documents\\AI PROJECT OPERATING SYSTEM',
  zipPath: path.join(__dirname, 'project.zip'),
  remoteDir: '/opt/aios'
};

// Generate secure keys
const securePass = crypto.randomBytes(16).toString('hex') + '!';
const jwtSecret = crypto.randomBytes(64).toString('hex');
const encryptionKey = crypto.randomBytes(32).toString('hex');
const webhookSecret = crypto.randomBytes(32).toString('hex');

console.log('🚀 Iniciando script de deploy automatizado para KingHost VPS...');

async function run() {
  try {
    // Step 1: Create ZIP of local workspace
    await createZip();

    // Step 2: Establish SSH connection
    const conn = await connectSSH();
    console.log('⚡ Conexão SSH estabelecida com sucesso!');

    // Step 3: Run pre-installation commands (system packages)
    console.log('📦 Instalando dependências do sistema na VPS...');
    await executeSSH(conn, 'apt-get update && apt-get install -y ufw nginx unzip git');

    // Step 4: Upload ZIP to remote server
    console.log('📤 Enviando arquivos do projeto para o servidor (isso pode levar de 30s a 2min)...');
    await executeSSH(conn, `mkdir -p ${CONFIG.remoteDir}`);
    await uploadFile(conn, CONFIG.zipPath, `${CONFIG.remoteDir}/project.zip`);
    console.log('✅ Upload concluído!');

    // Step 5: Unzip files on the server
    console.log('📂 Extraindo arquivos na VPS...');
    await executeSSH(conn, `unzip -o ${CONFIG.remoteDir}/project.zip -d ${CONFIG.remoteDir} && rm ${CONFIG.remoteDir}/project.zip`);

    // Step 6: Create production .env file on the server
    console.log('📝 Criando o arquivo .env de produção...');
    const envContent = `NODE_ENV=production
PORT=3001

# ── Banco de Dados ────────────────────────────────────────────
DB_USER=aios
DB_PASS=${securePass}
DB_NAME=aios_db

# ── JWT ───────────────────────────────────────────────────────
JWT_SECRET=${jwtSecret}

# ── URLs públicas do servidor ─────────────────────────────────
PUBLIC_URL=http://${CONFIG.host}
PUBLIC_WS_URL=ws://${CONFIG.host}

# ── CORS ──────────────────────────────────────────────────────
CORS_ORIGINS=http://${CONFIG.host},http://${CONFIG.host}:3000,chrome-extension://

# ── Segurança ─────────────────────────────────────────────────
WEBHOOK_SECRET=${webhookSecret}
ENCRYPTION_KEY=${encryptionKey}

# ── Asaas ─────────────────────────────────────────────────────
ASAAS_BASE_URL=https://api.asaas.com/v3
`;

    const tempEnvPath = path.join(__dirname, '.env.production');
    fs.writeFileSync(tempEnvPath, envContent);
    await uploadFile(conn, tempEnvPath, `${CONFIG.remoteDir}/.env`);
    fs.unlinkSync(tempEnvPath);
    console.log('✅ Arquivo .env gerado com chaves criptográficas seguras!');

    // Step 7: Build and run Docker containers
    console.log('🐳 Iniciando compilação e execução dos containers Docker (isso vai demorar alguns minutos)...');
    await executeSSH(conn, `cd ${CONFIG.remoteDir} && docker compose -f docker-compose.production.yml --env-file .env up --build -d`);
    console.log('✅ Containers Docker iniciados com sucesso!');

    // Step 8: Configure Nginx reverse proxy
    console.log('🌐 Configurando o servidor web Nginx...');
    const nginxConfig = `server {
    listen 80;
    server_name ${CONFIG.host};

    client_max_body_size 10M;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    location /api/ {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_read_timeout 86400;
    }

    location /socket.io/ {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 86400;
        proxy_send_timeout 86400;
    }
}
`;

    const tempNginxPath = path.join(__dirname, 'nginx-aios');
    fs.writeFileSync(tempNginxPath, nginxConfig);
    await uploadFile(conn, tempNginxPath, '/etc/nginx/sites-available/aios');
    fs.unlinkSync(tempNginxPath);

    const nginxSetupCmds = [
      'ln -sf /etc/nginx/sites-available/aios /etc/nginx/sites-enabled/aios',
      'rm -f /etc/nginx/sites-enabled/default',
      'nginx -t',
      'systemctl restart nginx'
    ].join(' && ');

    await executeSSH(conn, nginxSetupCmds);
    console.log('✅ Nginx configurado e reiniciado com sucesso!');

    // Step 9: Configure and enable Firewall
    console.log('🛡️ Habilitando regras de Firewall de segurança...');
    const firewallCmds = [
      'ufw allow 22/tcp',
      'ufw allow 80/tcp',
      'ufw allow 443/tcp',
      'echo "y" | ufw enable'
    ].join(' && ');
    await executeSSH(conn, firewallCmds);
    console.log('✅ Firewall configurado!');

    // Clean up local ZIP file
    if (fs.existsSync(CONFIG.zipPath)) {
      fs.unlinkSync(CONFIG.zipPath);
    }

    console.log('\n🎉🎉 DEPLOY CONCLUÍDO COM SUCESSO! 🎉🎉');
    console.log(`🔗 O dashboard já está acessível em: http://${CONFIG.host}`);
    console.log(`🔗 O backend de saúde da API está em: http://${CONFIG.host}/api/v1/health`);
    console.log('\nVocê já pode abrir esses links no seu navegador! 🚀');

    conn.end();
  } catch (err) {
    console.error('❌ ERRO DURANTE O DEPLOY:', err);
    // Cleanup ZIP
    if (fs.existsSync(CONFIG.zipPath)) {
      try { fs.unlinkSync(CONFIG.zipPath); } catch(_) {}
    }
    process.exit(1);
  }
}

// Helper to ZIP the workspace, excluding node_modules, .git, etc.
function createZip() {
  return new Promise((resolve, reject) => {
    console.log('📦 Comprimindo arquivos locais do projeto (excluindo node_modules, .git, .turbo, etc.)...');
    const output = fs.createWriteStream(CONFIG.zipPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', () => {
      console.log(`✅ Arquivo ZIP criado! Tamanho: ${(archive.pointer() / (1024 * 1024)).toFixed(2)} MB`);
      resolve();
    });

    archive.on('error', (err) => reject(err));

    archive.pipe(output);

    // Glob options for workspace files, ignoring directories
    archive.glob('**/*', {
      cwd: CONFIG.localDir,
      ignore: [
        'node_modules/**',
        '**/node_modules/**',
        '.git/**',
        '.turbo/**',
        '.vscode/**',
        '.next/**',
        'dist/**',
        'scratch/**',
        'project.zip',
        '**/*.zip',
        '.env'
      ],
      dot: true // Include hidden files like .babelrc, etc.
    });

    archive.finalize();
  });
}

// SSH Connection Helper
function connectSSH() {
  return new Promise((resolve, reject) => {
    const conn = new Client();
    conn.on('ready', () => resolve(conn))
        .on('error', (err) => reject(err))
        .connect({
          host: CONFIG.host,
          port: 22,
          username: CONFIG.username,
          password: CONFIG.password,
          readyTimeout: 30000
        });
  });
}

// SSH Command Execution Helper
function executeSSH(conn, cmd) {
  return new Promise((resolve, reject) => {
    conn.exec(cmd, (err, stream) => {
      if (err) return reject(err);
      
      let stdout = '';
      let stderr = '';

      stream.on('close', (code) => {
        if (code !== 0) {
          return reject(new Error(`Comando falhou com código ${code}. Comando: "${cmd}". Erro: ${stderr}`));
        }
        resolve(stdout);
      });

      stream.on('data', (data) => {
        const text = data.toString();
        stdout += text;
        process.stdout.write(text);
      });

      stream.stderr.on('data', (data) => {
        const text = data.toString();
        stderr += text;
        process.stderr.write(text);
      });
    });
  });
}

// SFTP Upload Helper
function uploadFile(conn, local, remote) {
  return new Promise((resolve, reject) => {
    conn.sftp((err, sftp) => {
      if (err) return reject(err);
      sftp.fastPut(local, remote, {
        concurrency: 64,
        chunkSize: 32768
      }, (err) => {
        if (err) return reject(err);
        resolve();
      });
    });
  });
}

run();
