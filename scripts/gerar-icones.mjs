// npm run icones — gera os ícones do PWA a partir da logo ORIGINAL (midia/logo.png), sem alterar a logo:
// ela é só redimensionada e centralizada num quadrado branco (como a "placa branca" usada no site).
import sharp from "sharp";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { RAIZ } from "./firebase-cli.mjs";

const LOGO = join(RAIZ, "public", "midia", "logo.png");
const SAIDA = join(RAIZ, "public", "midia", "icones");
mkdirSync(SAIDA, { recursive: true });

// largura da logo em relação ao quadrado. "maskable" usa margem maior (área segura dos ícones adaptáveis do Android).
const ICONES = [
  { nome: "icone-192.png", lado: 192, largura: 0.84 },
  { nome: "icone-512.png", lado: 512, largura: 0.84 },
  { nome: "icone-maskable-512.png", lado: 512, largura: 0.70 },
  { nome: "apple-touch-icon.png", lado: 180, largura: 0.84 }
];

for (const i of ICONES) {
  const logo = await sharp(LOGO).resize({ width: Math.round(i.lado * i.largura) }).toBuffer();
  await sharp({ create: { width: i.lado, height: i.lado, channels: 4, background: "#FFFFFF" } })
    .composite([{ input: logo, gravity: "center" }])
    .png()
    .toFile(join(SAIDA, i.nome));
  console.log("ícone gerado:", join("midia", "icones", i.nome));
}
