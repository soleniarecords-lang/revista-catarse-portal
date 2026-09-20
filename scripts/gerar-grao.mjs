// Gera as texturas de granulado (ruído) usadas nos gradientes do site, como PNG pequeno e repetível.
// Motivo: o granulado feito com filtro SVG (feTurbulence) é muito caro de desenhar e travou o navegador;
// um PNG de 256x256 é decodificado uma vez e repetido quase de graça.
//   public/grao-claro.png   → pontos pretos translúcidos (tema claro)
//   public/grao-escuro.png  → pontos brancos translúcidos (tema escuro)
//   node scripts/gerar-grao.mjs
import sharp from 'sharp';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const T = 256;

// gerador pseudoaleatório fixo: o arquivo sai sempre igual (nada de diff à toa)
let s = 20260919;
const aleatorio = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);

for (const [nome, cor, alfaMax] of [['claro', 0, 0.11], ['escuro', 255, 0.15]]) {
	const dados = Buffer.alloc(T * T * 4);
	for (let i = 0; i < T * T; i++) {
		dados[i * 4] = cor;
		dados[i * 4 + 1] = cor;
		dados[i * 4 + 2] = cor;
		dados[i * 4 + 3] = Math.round(((aleatorio() + aleatorio()) / 2) * 255 * alfaMax); // média de dois sorteios: menos pontos extremos
	}
	const saida = path.join(RAIZ, `public/grao-${nome}.png`);
	await sharp(dados, { raw: { width: T, height: T, channels: 4 } }).png({ compressionLevel: 9 }).toFile(saida);
	console.log('→', path.relative(RAIZ, saida));
}
