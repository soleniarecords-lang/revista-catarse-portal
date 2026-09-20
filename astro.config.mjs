// @ts-check
import sitemap from '@astrojs/sitemap';
import { defineConfig, fontProviders } from 'astro/config';

// Site 100% estático (sem adaptador de servidor): o build gera a pasta dist/ e a Cloudflare só entrega os arquivos.
// Mesmas fontes da Substack da revista: Playfair Display (títulos) e Libre Baskerville (corpo).
export default defineConfig({
	site: process.env.SITE_URL ?? 'https://revistacatarse.example',
	integrations: [sitemap()],
	fonts: [
		{
			provider: fontProviders.google(),
			name: 'Playfair Display',
			cssVariable: '--font-titulo',
			weights: [700, 800],
			styles: ['normal', 'italic'],
			fallbacks: ['Georgia', 'serif'],
		},
		{
			provider: fontProviders.google(),
			name: 'Libre Baskerville',
			cssVariable: '--font-corpo',
			weights: [400, 700],
			styles: ['normal', 'italic'],
			fallbacks: ['Georgia', 'serif'],
		},
		// Inter para rótulos, menus e metadados (mesma fonte de apoio das edições impressas)
		{
			provider: fontProviders.google(),
			name: 'Inter',
			cssVariable: '--font-ui',
			weights: [400, 500, 600, 700],
			styles: ['normal'],
			fallbacks: ['system-ui', 'sans-serif'],
		},
	],
});
