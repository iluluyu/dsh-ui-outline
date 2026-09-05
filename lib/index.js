/**
 * Host loader entry for dsh-ui-outline: registers the `outline` settings
 * namespace (schemastery schema) so the Web client's Plugin configuration
 * tab serves this plugin's card — the same packaging deepdiving uses
 * (docs/cookbook/adding-a-settings-card.md; the Host serves every registered
 * namespace and the tab pairs card and namespace by key). The browser half
 * (lib/client.js) binds a settingsScope on this namespace; preferences
 * persist in the host's settings document.
 *
 * The cordis.yml row carries a config block (side / material / layout):
 * it is registered as the namespace's composition (base) layer, so profile
 * owners can pin fleet-wide defaults while the card's user layer still
 * overrides per user — the layered shape the settings cookbook prescribes
 * for consumers that already own a cordis.yml entry.
 */
import z from "@deepseek-ai/schemastery";

/**
 * Namespace fields — the card controls. All `applies: 'live'` (the
 * default): the browser half re-projects on every scope change, no restart.
 *   side         right | left          — which edge of the conversation column
 *   material     none | frost | liquid — preview-card surface (frosted default)
 *   layout       compact | loose       — mark distribution language
 *   frostLevel   airy | balanced | dense — frost veil preset (density)
 *   liquidLevel  airy | balanced | dense — liquid veil preset (density)
 */
const OUTLINE_SCHEMA = z.object({
	side: z.union(["right", "left"]).default("right"),
	material: z.union(["none", "frost", "liquid"]).default("frost"),
	layout: z.union(["compact", "loose"]).default("compact"),
	frostLevel: z.union(["airy", "balanced", "dense"]).default("balanced"),
	liquidLevel: z.union(["airy", "balanced", "dense"]).default("balanced"),
});

/**
 * Register the namespace while a settings provider is composed. The row's
 * config is resolved through the schema (defaults filled) and layered as
 * `base` under the user document.
 * @param ctx - host plugin context.
 * @param config - the cordis.yml row config, the composition layer.
 */
export function apply(ctx, config) {
	const base = OUTLINE_SCHEMA(config ?? {});
	ctx.inject(["settings"], (sctx) => {
		sctx.settings.register("outline", OUTLINE_SCHEMA, { base });
	});
}
