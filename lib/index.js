/**
 * Host loader entry for dsh-ui-outline: registers the `outline` settings
 * namespace (schemastery schema) so the Web client's Plugin configuration
 * tab serves this plugin's card — the same packaging deepdiving uses
 * (docs/cookbook/adding-a-settings-card.md; the Host serves every registered
 * namespace and the tab pairs card and namespace by key). The browser half
 * (lib/client.js) binds a settingsScope on this namespace; preferences
 * persist in the host's settings document.
 *
 * 0.0.1 registered nothing (no Config block) — there is no legacy preference
 * surface to migrate.
 */
import z from "@deepseek-ai/schemastery";

/**
 * Namespace fields — the three card controls. All `applies: 'live'` (the
 * default): the browser half re-projects on every scope change, no restart.
 *   side     right | left          — which edge of the conversation column
 *   material none | frost | liquid — preview-card surface (frosted default)
 *   layout   compact | loose       — mark distribution language
 */
const OUTLINE_SCHEMA = z.object({
	side: z.union(["right", "left"]).default("right"),
	material: z.union(["none", "frost", "liquid"]).default("frost"),
	layout: z.union(["compact", "loose"]).default("compact"),
});

/**
 * Register the namespace while a settings provider is composed.
 * @param ctx - host plugin context.
 */
export function apply(ctx) {
	ctx.inject(["settings"], (sctx) => {
		sctx.settings.register("outline", OUTLINE_SCHEMA);
	});
}
