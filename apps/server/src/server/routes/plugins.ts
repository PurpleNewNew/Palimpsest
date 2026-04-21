import { Hono } from "hono"
import { describeRoute, resolver } from "hono-openapi"

import { Product } from "@/plugin/product"
import { RegistryInfo, LensInfo, PluginInfo, PresetInfo } from "@opencode-ai/plugin/product"
import { lazy } from "@/util/lazy"

export const PluginRoutes = lazy(() =>
  new Hono()
    .get(
      "/registry",
      describeRoute({
        summary: "Get plugin registry",
        operationId: "plugins.registry",
        responses: {
          200: {
            description: "Plugin registry",
            content: {
              "application/json": {
                schema: resolver(RegistryInfo),
              },
            },
          },
        },
      }),
      async (c) => c.json(await Product.registry()),
    )
    .get(
      "/",
      describeRoute({
        summary: "List plugins",
        operationId: "plugins.list",
        responses: {
          200: {
            description: "Plugins",
            content: {
              "application/json": {
                schema: resolver(PluginInfo.array()),
              },
            },
          },
        },
      }),
      async (c) => c.json((await Product.registry()).plugins),
    )
    .get(
      "/presets",
      describeRoute({
        summary: "List presets",
        operationId: "plugins.presets",
        responses: {
          200: {
            description: "Presets",
            content: {
              "application/json": {
                schema: resolver(PresetInfo.array()),
              },
            },
          },
        },
      }),
      async (c) => c.json((await Product.registry()).presets),
    )
    .get(
      "/lenses",
      describeRoute({
        summary: "List lenses",
        operationId: "plugins.lenses",
        responses: {
          200: {
            description: "Lenses",
            content: {
              "application/json": {
                schema: resolver(LensInfo.array()),
              },
            },
          },
        },
      }),
      async (c) => c.json((await Product.registry()).lenses),
    ),
)
