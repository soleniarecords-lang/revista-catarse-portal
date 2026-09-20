// Gera os wordmarks "REVISTA CATARSE" com fundo TRANSPARENTE a partir do logo horizontal da Substack
// (public/logo-catarse-wide.png, letras brancas sobre preto). A luminosidade vira transparência, então as
// letras ficam com borda suave em qualquer fundo:
//   public/logo-catarse-texto-preto.png   → tema claro
//   public/logo-catarse-texto-branco.png  → tema escuro
//   node scripts/gerar-logos.mjs
import sharp from 'sharp';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const origem = path.join(RAIZ, 'public/logo-catarse-wide.png');
// recorte do wordmark dentro do arquivo 2000x500 (sem o mascote à direita)
const recorte = { left: 370, top: 110, width: 605, height: 225 };

const { data, info } = await sharp(origem).extract(recorte).greyscale().raw().toBuffer({ resolveWithObject: true });

for (const [nome, cor] of [['preto', 0], ['branco', 255]]) {
	const rgba = Buffer.alloc(info.width * info.height * 4);
	for (let i = 0; i < data.length; i++) {
		rgba[i * 4] = cor;
		rgba[i * 4 + 1] = cor;
		rgba[i * 4 + 2] = cor;
		rgba[i * 4 + 3] = data[i]; // luminosidade → alfa
	}
	const saida = path.join(RAIZ, `public/logo-catarse-texto-${nome}.png`);
	await sharp(rgba, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toFile(saida);
	console.log('→', path.relative(RAIZ, saida));
}
