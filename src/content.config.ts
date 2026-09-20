import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import path from 'node:path';
import { edicoesLoader } from './loaders/edicoes';
import { noticiasLoader } from './loaders/noticias';

// Fonte da verdade: ../edicoes (as skills catarse-* escrevem lá; o portal só lê).
const EDICOES_DIR = process.env.EDICOES_DIR ?? path.resolve(process.cwd(), '../edicoes');

const materias = defineCollection({
	loader: edicoesLoader(EDICOES_DIR),
	schema: z.object({
		quadro: z.string(),
		titulo: z.string(),
		subtitulo: z.string(),
		edicao: z.number(),
		ordem: z.number(),
		slug: z.string(),
		data: z.coerce.date(),
		imagem: z.string().optional(), // caminho em /public, ex.: /imagens/slug/capa.jpg
		credito: z.string().optional(), // obrigatório quando há imagem
		creditoUrl: z.string().url().optional(), // página da imagem (fonte)
		licencaUrl: z.string().url().optional(), // licença (CC BY, CC BY-SA…)
		autor: z.string().default('Redação Revista Catarse'),
		aprovado: z.boolean().default(false),
		pendencias: z.number().default(0), // marcadores [CONFIRMAR] ainda no texto
	}),
});

// Notícias diárias (módulo /catarse-noticias): ../noticias/AAAA-MM-DD/NN-slug.md
const NOTICIAS_DIR = process.env.NOTICIAS_DIR ?? path.resolve(process.cwd(), '../noticias');

const noticias = defineCollection({
	loader: noticiasLoader(NOTICIAS_DIR),
	schema: z.object({
		quadro: z.string(),
		titulo: z.string(),
		subtitulo: z.string(),
		dia: z.string(),
		ordem: z.number(),
		slug: z.string(),
		data: z.coerce.date(),
		fontes: z.array(z.object({ nome: z.string(), url: z.string().url() })),
		imagem: z.string().optional(),
		credito: z.string().optional(),
		creditoUrl: z.string().url().optional(),
		licencaUrl: z.string().url().optional(),
		autor: z.string().default('Redação Revista Catarse'),
		aprovado: z.boolean().default(false),
		pendencias: z.number().default(0),
	}),
});

// Páginas institucionais (Quem somos, Política editorial, Contato): src/paginas/*.md
const paginas = defineCollection({
	loader: glob({ base: './src/paginas', pattern: '*.md' }),
	schema: z.object({
		titulo: z.string(),
		descricao: z.string(),
		aprovado: z.boolean().default(false),
	}),
});

export const collections = { materias, noticias, paginas };
