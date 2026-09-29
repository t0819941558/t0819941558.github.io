import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const attachment = z.object({
  name: z.string().min(1),
  file: z.string().startsWith('/'),
});

const posts = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/posts' }),
  schema: z.object({
    title: z.string().min(1),
    slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    description: z.string().min(1),
    publishedAt: z.coerce.date(),
    updatedAt: z.coerce.date().optional(),
    tags: z.array(z.string()).default([]),
    cover: z.string().startsWith('/').optional(),
    attachments: z.array(attachment).default([]),
    draft: z.boolean().default(false),
  }),
});

const archive = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/archive' }),
  schema: z.object({
    title: z.string(),
    publishedAt: z.coerce.date(),
    legacyPath: z.string(),
    archived: z.literal(true),
  }),
});

export const collections = { posts, archive };
