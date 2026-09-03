import { siteConfig } from "./site";

export const publicApiRoutes = {
  catalog: "/.well-known/api-catalog",
  docs: "/api/",
  index: "/search-index.json",
  llms: "/llms.txt",
  openApi: "/openapi.json",
  post: "/webmcp/posts/{slug}.json",
} as const;

const absoluteUrl = (path: string) => new URL(path, `${siteConfig.url}/`).href;

export const apiCatalog = {
  linkset: [
    {
      anchor: absoluteUrl(publicApiRoutes.index),
      "service-desc": [
        {
          href: absoluteUrl(publicApiRoutes.openApi),
          type: "application/vnd.oai.openapi+json;version=3.1",
        },
      ],
      "service-doc": [
        {
          href: absoluteUrl(publicApiRoutes.docs),
          type: "text/html",
        },
      ],
    },
  ],
} as const;

const postSummarySchema = {
  type: "object",
  required: ["slug", "title", "date", "summary", "tags"],
  properties: {
    slug: { type: "string" },
    title: { type: "string" },
    date: { type: "string", format: "date" },
    summary: { type: "string" },
    tags: {
      type: "array",
      items: { type: "string" },
      uniqueItems: true,
    },
  },
} as const;

export const openApiDocument = {
  openapi: "3.1.0",
  info: {
    title: `${siteConfig.author} Blog Content API`,
    version: "1.0.0",
    description: "Read-only access to published blog post metadata and Markdown content.",
  },
  servers: [{ url: siteConfig.url }],
  externalDocs: { url: absoluteUrl(publicApiRoutes.docs) },
  paths: {
    [publicApiRoutes.index]: {
      get: {
        operationId: "listPublishedPosts",
        summary: "List published posts",
        responses: {
          "200": {
            description: "Published post metadata",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: { $ref: "#/components/schemas/PostSummary" },
                },
              },
            },
          },
        },
      },
    },
    [publicApiRoutes.post]: {
      get: {
        operationId: "getPublishedPost",
        summary: "Get a published post",
        parameters: [
          {
            name: "slug",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          "200": {
            description: "Post metadata and Markdown content",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Post" },
              },
            },
          },
          "404": { description: "Post not found" },
        },
      },
    },
  },
  components: {
    schemas: {
      PostSummary: postSummarySchema,
      Post: {
        ...postSummarySchema,
        required: [...postSummarySchema.required, "content"],
        properties: {
          ...postSummarySchema.properties,
          content: {
            type: "string",
            description: "Article body in Markdown.",
          },
        },
      },
    },
  },
} as const;
