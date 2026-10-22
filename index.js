/**
 * Host half of the Share-as-image bundle.
 *
 * The capability is entirely browser-side (it reads the bound Conversation
 * snapshot and renders a PNG with Canvas 2D), so the Host half registers
 * nothing. It exists so the bundle has a mountable row and shows up in the
 * plugin inventory.
 */
export function apply() {}
