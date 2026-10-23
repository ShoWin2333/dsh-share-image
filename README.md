# Share Conversation as Image

A DeepSeek Harness plugin that turns selected conversation messages into a PNG
card you can download or copy.

- Pick exactly which messages go into the image.
- One click on any assistant reply starts from that reply plus the question
  before it.
- Rendered locally with Canvas: the card has the session title, the date,
  user/assistant labels, code blocks, lists, and quotes.
- Download as PNG or copy straight to the clipboard. Nothing leaves the
  browser.

## Install

Package name: `dsh-plugin-share-image`. There is no build step; the package
ships `client.js` as-is.

**Ask your DSH agent** to install the bundle from `dsh-plugin-share-image`
(npm) or `github:ShoWin2333/dsh-share-image`; the plugin manager adds the
dependency and the profile's bundle list for you.

**Or install it manually** into a profile (profile name substituted):

```bash
dsh plugin --profile <profile> add dsh-plugin-share-image          # npm
dsh plugin --profile <profile> add github:ShoWin2333/dsh-share-image  # from source
```

Then add the package to `dsh.profile.bundles` in that profile's `package.json`:

```json
{
  "dsh": {
    "profile": {
      "bundles": [
        "dsh-plugin-share-image"
      ]
    }
  }
}
```

Restart the profile. The plugin needs DSH `0.1.5` or newer and the web UI
(`@deepseek-ai/dsh-client-ui-chat`).

## Usage

Every finalized assistant reply has a picture action beside Copy and Branch.
Clicking it opens the message picker with that answer and the question before
it already checked.

In the picker, tick the messages to include — **Select all** picks the whole
conversation — then choose **Create image**. The preview offers **Download
PNG** and **Copy image**, plus **Back to selection** to change the set.

The card contains the conversation title, the date, and the selected messages.
Reasoning, tool calls, command rows, and system context are left out so the
image reads like a transcript rather than a log.

## Notes and limits

- Only content already loaded in the current view can be selected. If older
  turns have not been paged in yet, the picker says so.
- Consecutive assistant steps are shown as one row in the picker and merged
  into one answer in the image; unselected messages in between are skipped.
- A very long conversation is truncated to fit one image; the card then ends
  with a note saying the most recent messages were kept.
- The image is drawn at 2x resolution on a fixed light card, independent of the
  active UI theme, so it looks the same wherever it is shared.
- The PNG is generated locally in the browser. Nothing is uploaded.

## How it is put together

- `index.js` — Host half, intentionally empty; the bundle only mounts.
- `client.js` — the whole client plugin: Canvas renderer, picker, preview
  overlay, locale dictionaries, and slot registrations.
- `cordis.patch.yml` — the bundle patch that inserts the plugin row.
- `locale/en.json`, `locale/zh.json` — message catalogs for the plugin store.

The plugin registers two slots:

- `conversation.chat.assistant-actions` — the picture action on each finalized
  assistant message.
- `shell.overlay` — the message picker and image preview modal.

No options. The bundle is entirely browser-side; the Host half exists only to
mount the bundle in the profile.

## Development

Clone the repository and point a profile at the checkout:

```bash
dsh plugin --profile <profile> add link:/absolute/path/to/dsh-share-image
```

Add the bundle to `dsh.profile.bundles`, then edit `client.js`. DSH hot-reloads
client plugins, so slot changes appear without restarting the profile; a
`node --check client.js` catches syntax errors.

## License

MIT
