// Troca travessões (— e –) por pontuação comum, seguindo a regra de escrita do Luciano (19/09/2026).
//   node scripts/remover-travessoes.mjs                  simulação: mostra as trocas e não grava
//   node scripts/remover-travessoes.mjs --aplicar        grava nos arquivos
// Arquivos: edicoes/*/textos/*.md e portal/src/paginas/*.md (textos escritos pela redação).
// NÃO mexe em posts importados do Substack (texto de terceiros).
//
// Regras:
//  - par de travessões na mesma frase (aposto): vírgulas; se o aposto já tem vírgula, parênteses;
//  - travessão único: vírgula quando o trecho seguinte começa por conjunção/preposição/advérbio;
//    dois-pontos quando começa uma explicação (artigo, verbo, substantivo);
//  - intervalo numérico (2021–2023): "2021 a 2023".
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const aplicar = process.argv.includes('--aplicar');

const VIRGULA = new Set(('e mas não só sem pra para com ou nem porque que quando onde como se então ainda também apenas mesmo inclusive ' +
	'principalmente sobretudo além abaixo acima ao à de do da dos das em no na nos nas por pelo pela num numa até depois antes enquanto ' +
	'já nunca sempre talvez quase tão mais menos muito pouco bem mal cada qual quais cujo cuja embora porém contudo portanto logo ' +
	'seja sendo tendo fazendo sem-ele afinal aliás assim então tampouco').split(' '));

const primeiraPalavra = (s) => (s.trim().match(/^[("“'‘]*([\p{L}-]+)/u)?.[1] ?? '').toLowerCase();

function converterFrase(frase) {
	const f = frase.replace(/(\d)\s*–\s*(\d)/g, '$1 a $2');
	// travessão com espaço antes e (espaço ou pontuação) depois
	const achados = [...f.matchAll(/\s[—–](?=[\s.,;:!?)])/g)];
	if (achados.length === 0) return f.replace(/\s*[—–]\s*/g, ', '); // colado, sem espaços
	if (achados.length >= 2) {
		const [a, b] = achados;
		const antes = f.slice(0, a.index);
		const aposto = f.slice(a.index + a[0].length, b.index).trim();
		let depois = f.slice(b.index + b[0].length);
		if (/[—–]/.test(depois)) depois = converterFrase(depois);
		if (aposto.includes(',')) return `${antes} (${aposto.replace(/[.,;:]+$/, '')})${depois}`;
		const junta = /^[.,;:!?)]/.test(depois) ? '' : ',';
		return `${antes}, ${aposto.replace(/[.,;:]+$/, '')}${junta}${depois}`;
	}
	const [u] = achados;
	const antes = f.slice(0, u.index).replace(/[,:;]+$/, '');
	const depois = f.slice(u.index + u[0].length).replace(/^\s+/, '');
	const w = primeiraPalavra(depois);
	return `${antes}${VIRGULA.has(w) ? ', ' : ': '}${depois}`;
}

function converterLinha(linha) {
	if (!/[—–]/.test(linha)) return linha;
	// diálogo ou verso começando por travessão: não adivinha, sinaliza
	if (/^\s*[—–]\s/.test(linha)) return linha;
	const partes = linha.split(/(?<=[.!?…])\s+(?=[A-ZÁÉÍÓÚÂÊÔÃÕÇ"“(*_])/u);
	return partes.map(converterFrase).join(' ');
}

const arquivos = [];
for (const ed of (await readdir(path.resolve(RAIZ, '../edicoes'))).filter((d) => /^edicao-\d+$/.test(d))) {
	try {
		for (const f of await readdir(path.resolve(RAIZ, '../edicoes', ed, 'textos'))) if (f.endsWith('.md')) arquivos.push(path.resolve(RAIZ, '../edicoes', ed, 'textos', f));
	} catch {}
}
for (const f of await readdir(path.join(RAIZ, 'src/paginas'))) if (f.endsWith('.md')) arquivos.push(path.join(RAIZ, 'src/paginas', f));

let total = 0;
const sinalizadas = [];
for (const arq of arquivos) {
	const original = (await readFile(arq, 'utf8')).replace(/\r\n/g, '\n');
	const linhas = original.split('\n');
	const novas = linhas.map((l, i) => {
		const n = converterLinha(l);
		if (n !== l) {
			total++;
			console.log(`${path.basename(arq).slice(0, 34)}:${i + 1}\n  - ${l.length > 230 ? '…' + l.slice(Math.max(0, l.search(/[—–]/) - 90), l.search(/[—–]/) + 90) + '…' : l}\n  + ${n.length > 230 ? '…' + n.slice(Math.max(0, l.search(/[—–]/) - 90), l.search(/[—–]/) + 90) + '…' : n}`);
		}
		if (/[—–]/.test(n)) sinalizadas.push(`${path.basename(arq)}:${i + 1}: ${n.slice(0, 120)}`);
		return n;
	});
	if (aplicar) await writeFile(arq, novas.join('\n'));
}
console.log(`\n${aplicar ? 'GRAVADO' : 'SIMULAÇÃO'}: ${total} linhas alteradas em ${arquivos.length} arquivos.`);
if (sinalizadas.length) console.log(`Ainda com travessão (revisão manual):\n${sinalizadas.join('\n')}`);
