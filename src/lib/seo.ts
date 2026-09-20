import type { Materia } from './materias';
import { hrefMateria } from './materias';
import { hrefAutor, autorPorNome } from '../data/autores';
import { LEMA, NOME_SITE, SUBSTACK_URL } from '../data/site';

const abs = (caminho: string, site: URL) => new URL(caminho, site).href;

/** Google recomenda headline de até 110 caracteres. */
const headline = (t: string) => (t.length <= 110 ? t : `${t.slice(0, 107).trimEnd()}…`);

export function organizacao(site: URL) {
	return {
		'@type': 'Organization',
		'@id': abs('/#organizacao', site),
		name: NOME_SITE,
		alternateName: `${NOME_SITE}: ${LEMA}`,
		url: abs('/', site),
		logo: { '@type': 'ImageObject', url: abs('/logo-catarse.png', site), width: 346, height: 346 },
		sameAs: [SUBSTACK_URL],
		parentOrganization: { '@type': 'Organization', name: 'Solenia Records' },
	};
}

export function jsonLdHome(site: URL) {
	return [
		organizacao(site),
		{
			'@type': 'WebSite',
			'@id': abs('/#site', site),
			url: abs('/', site),
			name: NOME_SITE,
			description: LEMA,
			inLanguage: 'pt-BR',
			publisher: { '@id': abs('/#organizacao', site) },
		},
	];
}

/** Dados estruturados NewsArticle de uma matéria. */
export function jsonLdMateria(m: Materia, site: URL, palavras?: number) {
	const url = abs(hrefMateria(m), site);
	const autor = autorPorNome(m.autor);
	const dados: Record<string, unknown> = {
		'@type': 'NewsArticle',
		'@id': `${url}#materia`,
		mainEntityOfPage: { '@type': 'WebPage', '@id': url },
		headline: headline(m.titulo),
		description: m.subtitulo || undefined,
		datePublished: m.data.toISOString(),
		dateModified: m.data.toISOString(),
		inLanguage: 'pt-BR',
		isAccessibleForFree: true,
		articleSection: m.quadro.nome,
		author: { '@type': 'Organization', name: autor.nome, url: abs(hrefAutor(autor), site) },
		publisher: organizacao(site),
		wordCount: palavras,
		// só há imagem quando ela foi liberada e tem crédito (o build recusa imagem sem crédito)
		image: m.imagem ? [abs(m.imagem, site)] : undefined,
	};
	if (m.fontes?.length) {
		// notícia reescrita a partir de reportagem de terceiros: declara de onde veio
		dados.citation = m.fontes.map((f) => ({ '@type': 'CreativeWork', name: f.nome, url: f.url }));
		dados.isBasedOn = m.fontes.map((f) => f.url);
	}
	if (m.audio) {
		dados.associatedMedia = {
			'@type': 'AudioObject',
			contentUrl: m.audio,
			encodingFormat: 'audio/mpeg',
			name: m.titulo,
		};
	}
	return dados;
}

export function jsonLdAutor(nome: string, descricao: string, url: string, site: URL) {
	return {
		'@type': 'ProfilePage',
		mainEntity: {
			'@type': 'Organization',
			name: nome,
			description: descricao,
			url,
			worksFor: { '@id': abs('/#organizacao', site) },
		},
	};
}
