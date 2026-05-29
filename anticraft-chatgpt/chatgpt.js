import OpenAI from "openai";
import dotenv from "dotenv";
import readlineSync from "readline-sync";

dotenv.config();

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

console.log("=================================");
console.log(" CHATGPT INSTALADO NO ANTICRAFT ");
console.log(" Digite 'sair' para encerrar");
console.log("=================================");

async function iniciarChat() {
  while (true) {
    const pergunta = readlineSync.question("Voce: ");

    if (pergunta.toLowerCase() === "sair") {
      console.log("Chat encerrado.");
      break;
    }

    try {
      const resposta = await client.chat.completions.create({
        model: "gpt-4.1-mini",
        messages: [
          {
            role: "system",
            content: "Você é o ChatGPT integrado ao terminal do Anticraft.",
          },
          {
            role: "user",
            content: pergunta,
          },
        ],
      });

      console.log("\nChatGPT:", resposta.choices[0].message.content, "\n");
    } catch (erro) {
      console.log("Erro:", erro.message);
    }
  }
}

iniciarChat();
