// Levanta CANDIDATAS de imagem com licença livre (Wikimedia Commons) para o Luciano aprovar.
// Não baixa nem aplica nada: gera imagens-candidatas.md com licença, autor e link de cada uma.
//   node scripts/buscar-imagens-commons.mjs
// Só entram licenças que exigem no máximo crédito: CC0, domínio público, CC BY, CC BY-SA.
// (Sem NC/ND: revista com marca própria pode ser considerada uso comercial.)
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// matéria → o que procurar (foto do artista/banda; nunca capa de disco, que tem copyright)
// 3º item: o nome precisa aparecer no título do arquivo (corta resultado que só "parece" com a busca)
const ALVOS = [
	['edicao-03 · Harry Styles (Mainstream)', 'Harry Styles', /harry styles/i],
	['edicao-03 · Ariana Grande (Mainstream)', 'Ariana Grande', /ariana/i],
	['edicao-03 · ENHYPEN (Mainstream)', 'Enhypen', /enhypen|엔하이픈/i],
	['edicao-04 · Phoebe Bridgers (Mainstream)', 'Phoebe Bridgers', /phoebe/i],
	['edicao-04 · Lucia & the Best Boys (Mainstream)', 'Lucia and the Best Boys', /lucia.*best boys/i],
	['Substack · Milton Nascimento (Mainstream)', 'Milton Nascimento', /milton/i],
	['Substack · Arctic Monkeys (Mainstream)', 'Arctic Monkeys', /arctic monkeys/i],
	['Substack · Bad Bunny (Mainstream)', 'Bad Bunny', /bad bunny/i],
	['Substack · alt-J / Breezeblocks (Mainstream)', 'alt-J band', /alt-?j/i],
	["Substack · Guns N' Roses / Chinese Democracy (Mainstream)", 'Guns N Roses Axl Rose', /guns|axl/i],
	['Substack · Os Paralamas do Sucesso (Mainstream)', 'Paralamas do Sucesso', /paralamas/i],
	['Substack · Oliver Tree (Lab Estético)', 'Oliver Tree', /oliver tree/i],
];

const LICENCAS_OK = /^(cc0|cc[- ]by(-sa)?[- ]\d|public domain|pd[- ]|no restrictions)/i;
const semHtml = (s = '') => s.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim();

async function buscar(termo, exigir) {
	const url = new URL('https://commons.wikimedia.org/w/api.php');
	url.search = new URLSearchParams({
		action: 'query',
		format: 'json',
		generator: 'search',
		gsrsearch: `${termo} filetype:bitmap`,
		gsrnamespace: '6',
		gsrlimit: '20',
		prop: 'imageinfo',
		iiprop: 'url|size|extmetadata',
		iiurlwidth: '640',
	}).toString();
	const r = await fetch(url, { headers: { 'user-agent': 'RevistaCatarsePortal/0.1 (soleniarecords@gmail.com)' } });
	const j = await r.json();
	const paginas = Object.values(j.query?.pages ?? {});
	return paginas
		.map((p) => {
			const i = p.imageinfo?.[0];
			const m = i?.extmetadata ?? {};
			return {
				pagina: `https://commons.wikimedia.org/wiki/${encodeURIComponent(p.title.replace(/ /g, '_'))}`,
				arquivo: p.title.replace(/^File:/, ''),
				miniatura: i?.thumburl,
				largura: i?.width,
				altura: i?.height,
				licenca: semHtml(m.LicenseShortName?.value),
				licencaUrl: m.LicenseUrl?.value,
				autor: semHtml(m.Artist?.value),
				descricao: semHtml(m.ImageDescription?.value).slice(0, 140),
				indice: p.index,
			};
		})
		.filter((c) => c.miniatura && c.largura >= 1000 && LICENCAS_OK.test(c.licenca))
		.filter((c) => exigir.test(c.arquivo))
		.filter((c) => c.autor && !/unknown|desconhecid/i.test(c.autor)) // sem autor não há crédito possível
		.sort((a, b) => a.indice - b.indice)
		.slice(0, 3);
}

let md = `# Imagens candidatas (licença livre) — para aprovação\n\n`;
md += `Gerado em ${new Date().toISOString().slice(0, 10)} por scripts/buscar-imagens-commons.mjs. **Nada foi baixado nem aplicado.**\n\n`;
md += `Para usar uma: baixe o arquivo para \`portal/public/imagens/<slug-da-materia>/\` e preencha no cabeçalho da matéria \`imagem\` e \`credito\`.\n`;
md += `Confira a foto (é mesmo a pessoa/banda certa? é boa?) e o crédito antes de aprovar. CC BY e CC BY-SA exigem citar autor, licença e link; CC BY-SA vale só para a imagem, não para o texto da matéria.\n\n`;

for (const [rotulo, termo, exigir] of ALVOS) {
	md += `## ${rotulo}\n\n`;
	let cands = [];
	try {
		cands = await buscar(termo, exigir);
	} catch (e) {
		md += `_Falha na busca: ${e.message}_\n\n`;
		continue;
	}
	if (!cands.length) {
		md += `_Nenhuma foto com licença livre e boa resolução encontrada para "${termo}". Alternativa: foto de divulgação oficial (assessoria/gravadora) com permissão, ou capa tipográfica._\n\n`;
		continue;
	}
	cands.forEach((c, n) => {
		md += `${n + 1}. **${c.arquivo}** — ${c.largura}×${c.altura}\n`;
		md += `   - Licença: ${c.licenca}${c.licencaUrl ? ` (${c.licencaUrl})` : ''}\n`;
		md += `   - Autor: ${c.autor || '(não informado — não usar sem confirmar)'}\n`;
		md += `   - Página: ${c.pagina}\n`;
		md += `   - Prévia: ${c.miniatura}\n`;
		if (c.descricao) md += `   - Descrição: ${c.descricao}\n`;
		md += `   - Crédito sugerido: \`Foto: ${c.autor || '?'} / Wikimedia Commons / ${c.licenca}\`\n`;
	});
	md += `\n`;
	await new Promise((r) => setTimeout(r, 400));
}

const saida = path.join(RAIZ, 'imagens-candidatas.md');
await writeFile(saida, md);
console.log(`Relatório: ${saida}`);
