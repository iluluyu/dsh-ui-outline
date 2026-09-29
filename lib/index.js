/**
 * Host loader entry for dsh-ui-outline: declares the row's Config schema
 * (schemastery, volatile fields) so the Host's settings domain projects it
 * as the `outline` entry's configuration form — the same packaging
 * deepdiving uses.
 *
 * dsh 0.2.0 replaced the 0.1.x settings-namespace registry
 * (sctx.settings.register + { base } composition layer) with entry-owned
 * Config: every volatile field of the row's Config becomes a
 * live-editable form keyed by the row id, the cordis.yml row config (and
 * any profile-patch override) is the composition base, values persist in
 * the profile patch instead of settings.yaml, and the browser half reads
 * them through ctx.configForms.get("outline") (same snapshot shape:
 * status/value/base/user/revision/writable).
 *
 * The custom card (lib/client.js) renders the bundle/row config pages, so
 * this entry opts out of the auto-generated standard form
 * (settings.configure({ auto: false })).
 */
import z from "@deepseek-ai/schemastery";

/**
 * Config fields — the card controls, all volatile (live): the browser
 * half re-projects on every change, no restart.
 *   side               right | left   — which edge of the conversation column
 *   material           none | frost | liquid — preview-card surface (frosted default)
 *   layout             compact | loose — mark distribution language
 *   frostTransparency  20–95 (%) — frost veil transparency (veil = 100 − t)
 *   frostBlur          0–24 (px) — frost backdrop blur radius
 *   liquidTransparency 20–95 (%) — liquid veil transparency
 *   liquidBlur         0–24 (px) — liquid backdrop blur radius
 *
 * Defaults track each material's STANDARD preset (airy=transparency axis,
 * misty=blur axis; see client.js preset tables).*/
const Config = z.object({
	side: z.union(["right", "left"]).default("right").volatile(),
	material: z.union(["none", "frost", "liquid"]).default("frost").volatile(),
	layout: z.union(["compact", "loose"]).default("compact").volatile(),
	frostTransparency: z.number().default(80).volatile(),
	frostBlur: z.number().default(6).volatile(),
	liquidTransparency: z.number().default(65).volatile(),
	liquidBlur: z.number().default(6).volatile(),
});

/**
 * Opt out of the auto-generated settings form: the browser half renders
 * the bundle's and the row's own configuration pages.
 * @param ctx - host plugin context.
 */
export function apply(ctx) {
	ctx.inject(["settings"], (child) => {
		child.effect(() => child.settings.configure({ auto: false }, ctx.fiber));
	});
}

export { Config };
