/**
 * Share-as-image browser half.
 *
 * Adds a compact action to the composer toolbar, builds a PNG card of the
 * bound Conversation with Canvas 2D, and previews it in the frame-wide
 * overlay with Download and Copy actions.
 */
window.__ModuleLoader__.load({
  id: '@local/conversation-share-image',
  factory(require) {
    const React = require('react');
    const h = React.createElement;

    const NS = 'plugin.share-image';

    /** Localized copy; replaced by the locale-bound translator in apply(). */
    let translate = (key) => key;

    const EMPTY_NODES = [];
    const noopUseChat = (selector) => selector({ legacy: { nodes: EMPTY_NODES, partial: null } });
    const noopUseSessions = (selector) => selector({ byId: {} });
    const noopUseSession = (selector) => selector({});

    const SANS =
      '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Helvetica Neue", Arial, sans-serif';
    const MONO =
      'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace';

    const CARD = {
      width: 760,
      pad: 44,
      maxHeight: 6200,
      brand: '#4d6bfe',
    };

    const COLORS = {
      title: '#111827',
      body: '#1f2328',
      meta: '#8a919c',
      muted: '#9aa1ac',
      divider: '#eceef2',
      codeBg: '#f6f7f9',
      codeBorder: '#e8eaef',
      codeText: '#374151',
      quoteText: '#4b5563',
      warn: '#b45309',
      userChipBg: '#eef3ff',
      userChipText: '#3b5bdb',
      assistantChipBg: '#f2f3f5',
      assistantChipText: '#4b5563',
    };

    let measureCanvas = null;
    function measureContext() {
      if (measureCanvas === null) {
        measureCanvas = document.createElement('canvas');
      }
      return measureCanvas.getContext('2d');
    }

    /* ------------------------------------------------------------------ *
     * Conversation snapshot -> plain messages
     * ------------------------------------------------------------------ */

    function textOfContent(content, labels) {
      if (typeof content === 'string') return content;
      if (!Array.isArray(content)) return '';
      const parts = [];
      for (const block of content) {
        if (block === null || typeof block !== 'object') continue;
        if (block.type === 'text' && typeof block.text === 'string') {
          parts.push(block.text);
        } else if (block.type === 'image') {
          parts.push('[' + labels.image + ']');
        } else if (block.type === 'file') {
          parts.push('[' + labels.file + ']');
        }
      }
      return parts.join('\n');
    }

    function textOfBlocks(blocks) {
      if (!Array.isArray(blocks)) return '';
      let out = '';
      for (const block of blocks) {
        if (block === null || typeof block !== 'object') continue;
        if (block.kind === 'text' && typeof block.text === 'string') {
          out += (out === '' ? '' : '\n\n') + block.text;
        }
      }
      return out;
    }

    /**
     * Flatten the Chat target's finalized node list into selectable messages.
     * Tool calls, reasoning, system context, and command rows are intentionally
     * omitted. Each entry keeps its own identity so the picker can select an
     * arbitrary subset; merging happens only when the image is rendered.
     */
    function collectMessages(nodes, labels) {
      const entries = [];
      for (const node of Array.isArray(nodes) ? nodes : []) {
        if (node === null || typeof node !== 'object') continue;
        if (node.kind === 'user' || node.kind === 'steering') {
          const text = textOfContent(node.content, labels).trim();
          if (text !== '') {
            entries.push({
              id: 'u:' + String(node.seq),
              role: 'user',
              text,
              messageIds: [],
            });
          }
        } else if (node.kind === 'assistant') {
          const text = textOfBlocks(node.blocks).trim();
          if (text === '') continue;
          const messageId = typeof node.messageId === 'string' ? node.messageId : undefined;
          const last = entries[entries.length - 1];
          if (last !== undefined && last.role === 'assistant') {
            last.text = last.text + '\n\n' + text;
            if (messageId !== undefined) last.messageIds.push(messageId);
            continue;
          }
          entries.push({
            id: 'a:' + String(messageId === undefined ? node.seq : messageId),
            role: 'assistant',
            text,
            messageIds: messageId === undefined ? [] : [messageId],
          });
        }
      }
      return entries;
    }

    /** Selected entries in conversation order, with adjacent Assistant steps joined. */
    function mergeSelection(entries, selectedIds) {
      const selected = new Set(selectedIds);
      const messages = [];
      for (const entry of entries) {
        if (!selected.has(entry.id)) continue;
        const last = messages[messages.length - 1];
        if (entry.role === 'assistant' && last !== undefined && last.role === 'assistant') {
          last.text = last.text + '\n\n' + entry.text;
          continue;
        }
        messages.push({ role: entry.role, text: entry.text });
      }
      return messages;
    }

    /** One-line preview for a picker row. */
    function previewText(text) {
      const flat = String(text).replace(/\s+/g, ' ').trim();
      return flat.length > 140 ? flat.slice(0, 139) + '\u2026' : flat;
    }

    function cardTitle(sessionTitle, t) {
      const trimmed = typeof sessionTitle === 'string' ? sessionTitle.trim() : '';
      return trimmed !== '' ? trimmed : t('card.defaultTitle');
    }

    /* ------------------------------------------------------------------ *
     * Text preparation
     * ------------------------------------------------------------------ */

    function inlineText(text) {
      return String(text)
        .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
        .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
        .replace(/`([^`]+)`/g, '$1')
        .replace(/\*\*([^*]+)\*\*/g, '$1')
        .replace(/__([^_]+)__/g, '$1')
        .replace(/~~([^~]+)~~/g, '$1')
        .replace(/<[^>]+>/g, '')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");
    }

    function isMarkerLine(line) {
      return (
        /^```/.test(line) ||
        /^#{1,6}\s+/.test(line) ||
        /^>\s?/.test(line) ||
        /^(\s*)([-*+]|\d{1,3}[.)])\s+/.test(line)
      );
    }

    /** Split message text into renderable blocks (code, headings, lists, quotes). */
    function parseBlocks(text) {
      const lines = String(text).replace(/\r\n/g, '\n').split('\n');
      const blocks = [];
      let i = 0;
      while (i < lines.length) {
        const line = lines[i];
        const fence = /^```(.*)$/.exec(line);
        if (fence !== null) {
          i += 1;
          const body = [];
          while (i < lines.length && !/^```/.test(lines[i])) {
            body.push(lines[i]);
            i += 1;
          }
          i += 1;
          blocks.push({ kind: 'code', lang: fence[1].trim(), lines: body });
          continue;
        }
        if (line.trim() === '') {
          i += 1;
          continue;
        }
        const heading = /^(#{1,6})\s+(.*)$/.exec(line);
        if (heading !== null) {
          blocks.push({ kind: 'heading', level: heading[1].length, text: inlineText(heading[2]) });
          i += 1;
          continue;
        }
        if (/^>\s?/.test(line)) {
          const body = [];
          while (i < lines.length && /^>\s?/.test(lines[i])) {
            body.push(lines[i].replace(/^>\s?/, ''));
            i += 1;
          }
          blocks.push({ kind: 'quote', text: inlineText(body.join('\n')) });
          continue;
        }
        const item = /^(\s*)([-*+]|\d{1,3}[.)])\s+(.*)$/.exec(line);
        if (item !== null) {
          const marker = /^\d/.test(item[2]) ? item[2] : '\u2022';
          const body = [item[3]];
          i += 1;
          while (i < lines.length && lines[i].trim() !== '' && !isMarkerLine(lines[i])) {
            body.push(lines[i].trim());
            i += 1;
          }
          blocks.push({ kind: 'item', marker, text: inlineText(body.join(' ')) });
          continue;
        }
        const body = [line];
        i += 1;
        while (i < lines.length && lines[i].trim() !== '' && !isMarkerLine(lines[i])) {
          body.push(lines[i]);
          i += 1;
        }
        blocks.push({ kind: 'p', text: inlineText(body.join('\n')) });
      }
      return blocks;
    }

    /** Character-level wrapping that also breaks on spaces for Latin text. */
    function wrapText(measure, text, maxWidth, font) {
      measure.font = font;
      const out = [];
      for (const raw of String(text).split('\n')) {
        if (raw === '') {
          out.push('');
          continue;
        }
        let line = '';
        let lastSpace = -1;
        for (const ch of raw) {
          const candidate = line + ch;
          if (line !== '' && measure.measureText(candidate).width > maxWidth) {
            if (ch === ' ' || line.endsWith(' ')) {
              out.push(line.replace(/\s+$/, ''));
              line = ch === ' ' ? '' : ch;
            } else if (lastSpace > 0) {
              out.push(line.slice(0, lastSpace).replace(/\s+$/, ''));
              line = line.slice(lastSpace + 1) + ch;
            } else {
              out.push(line);
              line = ch;
            }
            lastSpace = line.lastIndexOf(' ');
          } else {
            line = candidate;
            if (ch === ' ') lastSpace = line.length - 1;
          }
        }
        out.push(line.replace(/\s+$/, ''));
      }
      return out;
    }

    /* ------------------------------------------------------------------ *
     * Card layout: produce drawing operations, then paint them
     * ------------------------------------------------------------------ */

    function emitLines(ops, lines, x, y, font, color, lineHeight, baselineOffset) {
      let cursor = y;
      for (const line of lines) {
        if (line !== '') {
          ops.push({ t: 'text', s: line, x, y: cursor + baselineOffset, f: font, c: color });
        }
        cursor += lineHeight;
      }
      return cursor;
    }

    function blockGap(block) {
      if (block.kind === 'item') return 6;
      if (block.kind === 'heading') return 10;
      return 12;
    }

    function layoutMessageBlocks(ops, blocks, startY, x, width, measure) {
      let y = startY;
      blocks.forEach((block, index) => {
        if (block.kind === 'heading') {
          const size = block.level <= 1 ? 20 : block.level === 2 ? 18 : 16;
          const font = '600 ' + size + 'px ' + SANS;
          if (index > 0) y += 6;
          const lines = wrapText(measure, block.text, width, font);
          y = emitLines(ops, lines, x, y, font, COLORS.title, size + 10, size * 0.82 + 3);
          y += 8;
          return;
        }
        if (block.kind === 'code') {
          const font = '12.5px ' + MONO;
          const pad = 14;
          const lineHeight = 19;
          const lines = [];
          for (const raw of block.lines) {
            lines.push(...wrapText(measure, raw === '' ? ' ' : raw, width - pad * 2, font));
          }
          if (lines.length === 0) lines.push(' ');
          const height = pad * 2 + lines.length * lineHeight;
          ops.push({ t: 'rect', x, y, w: width, h: height, r: 9, c: COLORS.codeBg });
          ops.push({ t: 'stroke', x, y, w: width, h: height, r: 9, c: COLORS.codeBorder });
          let cursor = y + pad;
          for (const line of lines) {
            ops.push({
              t: 'text',
              s: line === '' ? ' ' : line,
              x: x + pad,
              y: cursor + 13.5,
              f: font,
              c: COLORS.codeText,
            });
            cursor += lineHeight;
          }
          y += height + blockGap(block);
          return;
        }
        if (block.kind === 'quote') {
          const font = '15px ' + SANS;
          const lineHeight = 24;
          const lines = wrapText(measure, block.text, width - 18, font);
          ops.push({
            t: 'rect',
            x,
            y: y + 3,
            w: 3,
            h: Math.max(lines.length * lineHeight - 6, 6),
            r: 1.5,
            c: '#c7d2fe',
          });
          y = emitLines(ops, lines, x + 18, y, font, COLORS.quoteText, lineHeight, 17.5);
          y += blockGap(block);
          return;
        }
        if (block.kind === 'item') {
          const font = '15px ' + SANS;
          const lineHeight = 24;
          const lines = wrapText(measure, block.text, width - 24, font);
          ops.push({ t: 'text', s: block.marker, x, y: y + 17.5, f: font, c: '#6b7280' });
          y = emitLines(ops, lines, x + 24, y, font, COLORS.body, lineHeight, 17.5);
          y += blockGap(block);
          return;
        }
        const font = '15px ' + SANS;
        const lineHeight = 25;
        const lines = wrapText(measure, block.text, width, font);
        y = emitLines(ops, lines, x, y, font, COLORS.body, lineHeight, 18.2);
        y += blockGap(block);
      });
      return y;
    }

    function roundRectPath(ctx, x, y, w, h, r) {
      const radius = Math.min(r, w / 2, h / 2);
      ctx.beginPath();
      ctx.moveTo(x + radius, y);
      ctx.lineTo(x + w - radius, y);
      ctx.arcTo(x + w, y, x + w, y + radius, radius);
      ctx.lineTo(x + w, y + h - radius);
      ctx.arcTo(x + w, y + h, x + w - radius, y + h, radius);
      ctx.lineTo(x + radius, y + h);
      ctx.arcTo(x, y + h, x, y + h - radius, radius);
      ctx.lineTo(x, y + radius);
      ctx.arcTo(x, y, x + radius, y, radius);
      ctx.closePath();
    }

    function drawOps(ctx, ops) {
      for (const op of ops) {
        if (op.t === 'rect') {
          ctx.fillStyle = op.c;
          roundRectPath(ctx, op.x, op.y, op.w, op.h, op.r);
          ctx.fill();
        } else if (op.t === 'stroke') {
          ctx.strokeStyle = op.c;
          ctx.lineWidth = 1;
          roundRectPath(ctx, op.x, op.y, op.w, op.h, op.r);
          ctx.stroke();
        } else if (op.t === 'line') {
          ctx.strokeStyle = op.c;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(op.x1, op.y1 + 0.5);
          ctx.lineTo(op.x2, op.y2 + 0.5);
          ctx.stroke();
        } else if (op.t === 'text') {
          ctx.font = op.f;
          ctx.fillStyle = op.c;
          ctx.fillText(op.s, op.x, op.y);
        }
      }
    }

    function buildLayout(options) {
      const measure = measureContext();
      const ops = [];
      const width = CARD.width;
      const pad = CARD.pad;
      const left = pad;
      const contentWidth = width - pad * 2;
      let y = pad;

      // Brand row: rounded mark with three dots, wordmark, date.
      ops.push({ t: 'rect', x: left, y, w: 34, h: 34, r: 10, c: CARD.brand });
      for (let index = 0; index < 3; index += 1) {
        ops.push({
          t: 'rect',
          x: left + 9 + index * 7,
          y: y + 14.5,
          w: 3.6,
          h: 3.6,
          r: 1.8,
          c: '#ffffff',
        });
      }
      ops.push({
        t: 'text',
        s: 'DEEPSEEK HARNESS',
        x: left + 46,
        y: y + 21.5,
        f: '600 12px ' + SANS,
        c: '#6b7280',
      });
      const dateFont = '12px ' + SANS;
      measure.font = dateFont;
      const dateWidth = measure.measureText(options.dateText).width;
      ops.push({
        t: 'text',
        s: options.dateText,
        x: width - pad - dateWidth,
        y: y + 21.5,
        f: dateFont,
        c: COLORS.muted,
      });

      y += 34 + 28;

      const titleFont = '600 26px ' + SANS;
      const titleLines = wrapText(measure, options.title, contentWidth, titleFont);
      const shownTitle = titleLines.slice(0, 3);
      for (const line of shownTitle) {
        ops.push({ t: 'text', s: line, x: left, y: y + 26, f: titleFont, c: COLORS.title });
        y += 34;
      }
      y += 4;
      ops.push({
        t: 'text',
        s: options.metaText,
        x: left,
        y: y + 16,
        f: '13px ' + SANS,
        c: COLORS.meta,
      });
      y += 16 + 22;
      ops.push({ t: 'line', x1: left, y1: y, x2: width - pad, y2: y, c: COLORS.divider });
      y += 26;

      let truncated = false;
      for (const message of options.messages) {
        if (y > CARD.maxHeight - 300) {
          truncated = true;
          break;
        }
        const isUser = message.role === 'user';
        const roleLabel = isUser ? options.labels.user : options.labels.assistant;
        const chipFont = '600 11px ' + SANS;
        measure.font = chipFont;
        const chipWidth = measure.measureText(roleLabel).width + 16;
        ops.push({
          t: 'rect',
          x: left,
          y,
          w: chipWidth,
          h: 20,
          r: 6,
          c: isUser ? COLORS.userChipBg : COLORS.assistantChipBg,
        });
        ops.push({
          t: 'text',
          s: roleLabel,
          x: left + 8,
          y: y + 14,
          f: chipFont,
          c: isUser ? COLORS.userChipText : COLORS.assistantChipText,
        });
        y += 20 + 13;
        y = layoutMessageBlocks(ops, parseBlocks(message.text), y, left, contentWidth, measure) + 22;
      }

      if (truncated) {
        const font = '12.5px ' + SANS;
        const lines = wrapText(measure, options.truncatedNote, contentWidth, font);
        y = emitLines(ops, lines, left, y + 2, font, COLORS.warn, 19, 13.5) + 6;
      }

      y += 6;
      ops.push({ t: 'line', x1: left, y1: y, x2: width - pad, y2: y, c: COLORS.divider });
      y += 22;
      ops.push({
        t: 'text',
        s: options.footerText,
        x: left,
        y: y + 11,
        f: '11.5px ' + SANS,
        c: COLORS.muted,
      });

      return { ops, height: Math.ceil(y + pad), width, truncated };
    }

    function dataUrlToBlob(dataUrl) {
      const comma = dataUrl.indexOf(',');
      const head = dataUrl.slice(0, comma);
      const body = dataUrl.slice(comma + 1);
      const mime = /data:([^;]+)/.exec(head);
      const binary = atob(body);
      const bytes = new Uint8Array(binary.length);
      for (let index = 0; index < binary.length; index += 1) {
        bytes[index] = binary.charCodeAt(index);
      }
      return new Blob([bytes], { type: mime === null ? 'image/png' : mime[1] });
    }

    function timestampSuffix(date) {
      const pad2 = (value) => String(value).padStart(2, '0');
      return (
        date.getFullYear() +
        pad2(date.getMonth() + 1) +
        pad2(date.getDate()) +
        '-' +
        pad2(date.getHours()) +
        pad2(date.getMinutes())
      );
    }

    function renderShareImage(options) {
      const layout = buildLayout(options);
      const scale = layout.height * 2 <= 16000 ? 2 : 1;
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(layout.width * scale);
      canvas.height = Math.round(layout.height * scale);
      const ctx = canvas.getContext('2d');
      ctx.scale(scale, scale);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, layout.width, layout.height);
      ctx.textBaseline = 'alphabetic';
      drawOps(ctx, layout.ops);
      const dataUrl = canvas.toDataURL('image/png');
      const now = new Date();
      return {
        dataUrl,
        blob: dataUrlToBlob(dataUrl),
        width: Math.round(layout.width * scale),
        height: Math.round(layout.height * scale),
        fileName: 'conversation-' + timestampSuffix(now) + '.png',
        truncated: layout.truncated,
      };
    }

    /* ------------------------------------------------------------------ *
     * Shared preview state (button opens, overlay renders)
     * ------------------------------------------------------------------ */

    const shareState = {
      open: false,
      stage: 'select',
      entries: [],
      selected: [],
      title: '',
      hasMore: false,
      view: null,
      error: null,
      notice: null,
    };
    const shareListeners = new Set();
    let noticeTimer = null;

    function setShareState(patch) {
      Object.assign(shareState, patch);
      for (const listener of [...shareListeners]) {
        try {
          listener();
        } catch (error) {
          console.error('[share-image] listener failed', error);
        }
      }
    }

    function useShareState() {
      const [, setRevision] = React.useState(0);
      React.useEffect(() => {
        const listener = () => setRevision((value) => value + 1);
        shareListeners.add(listener);
        return () => {
          shareListeners.delete(listener);
        };
      }, []);
      return shareState;
    }

    function openPicker(entries, selectedIds, hasMore, title) {
      setShareState({
        open: true,
        stage: 'select',
        entries,
        selected: selectedIds,
        title,
        hasMore,
        view: null,
        error: null,
        notice: hasMore ? translate('dialog.partial') : null,
      });
    }

    function closePreview() {
      if (noticeTimer !== null) {
        clearTimeout(noticeTimer);
        noticeTimer = null;
      }
      setShareState({
        open: false,
        stage: 'select',
        entries: [],
        selected: [],
        title: '',
        hasMore: false,
        view: null,
        error: null,
        notice: null,
      });
    }

    function toggleSelection(id) {
      const selected = shareState.selected.includes(id)
        ? shareState.selected.filter((value) => value !== id)
        : shareState.selected.concat([id]);
      setShareState({ selected, error: null });
    }

    function selectEveryEntry() {
      setShareState({ selected: shareState.entries.map((entry) => entry.id), error: null });
    }

    function selectNoEntry() {
      setShareState({ selected: [], error: null });
    }

    function backToSelection() {
      setShareState({
        stage: 'select',
        view: null,
        error: null,
        notice: shareState.hasMore ? translate('dialog.partial') : null,
      });
    }

    function generatePreview() {
      const messages = mergeSelection(shareState.entries, shareState.selected);
      if (messages.length === 0) {
        setShareState({ error: translate('select.empty') });
        return;
      }
      try {
        const view = renderShareImage({
          title: shareState.title,
          dateText: new Intl.DateTimeFormat(localeReader(), {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
          }).format(new Date()),
          metaText: translate('card.messages', { count: messages.length }),
          labels: { user: translate('card.you'), assistant: translate('card.assistant') },
          footerText: translate('card.footer'),
          truncatedNote: translate('card.truncated'),
          messages,
        });
        setShareState({ stage: 'preview', view, error: null, notice: null });
      } catch (error) {
        console.error('[share-image] rendering failed', error);
        setShareState({ error: String(error) });
      }
    }

    function flashNotice(text) {
      if (noticeTimer !== null) clearTimeout(noticeTimer);
      setShareState({ notice: text });
      noticeTimer = setTimeout(() => {
        noticeTimer = null;
        setShareState({ notice: null });
      }, 2400);
    }

    /* ------------------------------------------------------------------ *
     * Styles
     * ------------------------------------------------------------------ */

    const CSS =
      '.dsh-shareimg-btn{width:28px;height:28px;border-radius:999px;border:0;padding:0;background:transparent;color:var(--dsw-alias-label-secondary);display:grid;place-items:center;cursor:pointer;flex:none}' +
      '.dsh-shareimg-btn:hover:not(:disabled){background:var(--dsw-alias-bg-layer-2)}' +
      '.dsh-shareimg-btn:disabled{opacity:.4;cursor:default}' +
      '.dsh-shareimg-btn:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:-2px}' +
      '.dsh-shareimg-msgbtn{width:28px;height:28px;border-radius:6px;border:0;background:transparent;color:var(--dsw-alias-label-secondary);display:inline-flex;align-items:center;justify-content:center;padding:6px;cursor:pointer;flex:none}' +
      '.dsh-shareimg-msgbtn:hover{background:var(--dsw-alias-bg-layer-2)}' +
      '.dsh-shareimg-msgbtn:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:-2px}' +
      '.dsh-shareimg-msgbtn svg{width:17px;height:17px}' +
      '.dsh-shareimg-backdrop{position:fixed;inset:0;z-index:1200;display:flex;align-items:center;justify-content:center;padding:24px;background:rgba(10,12,16,.55);pointer-events:auto;overscroll-behavior:contain}' +
      '.dsh-shareimg-panel{width:min(960px,100%);max-height:calc(100vh - 48px);display:flex;flex-direction:column;overflow:hidden;border-radius:16px;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-overlay);box-shadow:0 24px 64px rgba(0,0,0,.35);color:var(--dsw-alias-label-primary)}' +
      '.dsh-shareimg-head{display:flex;align-items:center;gap:12px;padding:14px 16px;border-bottom:1px solid var(--dsw-alias-border-l1);flex:none}' +
      '.dsh-shareimg-title{font-size:14px;font-weight:600;line-height:20px;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
      '.dsh-shareimg-close{width:28px;height:28px;border-radius:8px;border:0;background:transparent;color:var(--dsw-alias-label-secondary);display:grid;place-items:center;cursor:pointer;flex:none}' +
      '.dsh-shareimg-close:hover{background:var(--dsw-alias-bg-layer-2)}' +
      '.dsh-shareimg-close:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:-2px}' +
      '.dsh-shareimg-select{display:flex;flex-direction:column;flex:1;min-height:0}' +
      '.dsh-shareimg-toolbar{display:flex;align-items:center;gap:6px;padding:10px 16px;border-bottom:1px solid var(--dsw-alias-border-l1);flex:none}' +
      '.dsh-shareimg-count{flex:1;min-width:0;font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
      '.dsh-shareimg-link{border:0;background:transparent;color:var(--dsw-alias-brand-primary);font-size:12px;font-weight:500;line-height:18px;cursor:pointer;padding:3px 6px;border-radius:6px;white-space:nowrap}' +
      '.dsh-shareimg-link:hover{background:var(--dsw-alias-bg-layer-2)}' +
      '.dsh-shareimg-link:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:-2px}' +
      '.dsh-shareimg-list{overflow:auto;padding:8px;display:flex;flex-direction:column;gap:2px;flex:1;min-height:0}' +
      '.dsh-shareimg-row{display:flex;align-items:flex-start;gap:10px;padding:9px 10px;border-radius:8px;cursor:pointer}' +
      '.dsh-shareimg-row:hover{background:var(--dsw-alias-bg-layer-2)}' +
      '.dsh-shareimg-check{width:15px;height:15px;margin:2px 0 0;accent-color:var(--dsw-alias-brand-primary);flex:none;cursor:pointer}' +
      '.dsh-shareimg-rowrole{font-size:11px;font-weight:600;line-height:19px;color:var(--dsw-alias-label-secondary);flex:none;min-width:52px}' +
      '.dsh-shareimg-rowtext{font-size:13px;line-height:19px;color:var(--dsw-alias-label-primary);min-width:0;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;word-break:break-word}' +
      '.dsh-shareimg-body{overflow:auto;padding:16px;background:var(--dsw-alias-bg-layer-2);flex:1;min-height:0;display:flex;justify-content:center;align-items:flex-start}' +
      '.dsh-shareimg-image{display:block;max-width:100%;height:auto;border-radius:10px;box-shadow:0 6px 24px rgba(0,0,0,.18)}' +
      '.dsh-shareimg-foot{display:flex;align-items:center;gap:8px;padding:12px 16px;border-top:1px solid var(--dsw-alias-border-l1);flex:none;flex-wrap:wrap}' +
      '.dsh-shareimg-status{flex:1;min-width:120px;font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary)}' +
      '.dsh-shareimg-status[data-tone=error]{color:var(--dsw-alias-state-error-primary)}' +
      '.dsh-shareimg-action{height:32px;padding:0 14px;border-radius:8px;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font-size:13px;font-weight:500;cursor:pointer;white-space:nowrap}' +
      '.dsh-shareimg-action:hover:not(:disabled){background:var(--dsw-alias-bg-layer-2)}' +
      '.dsh-shareimg-action:disabled{opacity:.45;cursor:default}' +
      '.dsh-shareimg-action:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}' +
      '.dsh-shareimg-action[data-variant=primary]{background:var(--dsw-alias-brand-primary);border-color:transparent;color:#ffffff}' +
      '.dsh-shareimg-action[data-variant=primary]:hover:not(:disabled){filter:brightness(1.06)}';

    /* ------------------------------------------------------------------ *
     * Header action
     * ------------------------------------------------------------------ */

    function ShareGlyph() {
      return h(
        'svg',
        { viewBox: '0 0 16 16', width: 16, height: 16, fill: 'none', 'aria-hidden': true, focusable: false },
        h('rect', {
          x: 1.8,
          y: 2.8,
          width: 12.4,
          height: 9.4,
          rx: 2.2,
          stroke: 'currentColor',
          strokeWidth: 1.3,
        }),
        h('circle', { cx: 5.3, cy: 6.1, r: 1.05, fill: 'currentColor' }),
        h('path', {
          d: 'M2.9 11.1l3-3 2.4 2.4 1.9-1.9 2.7 2.7',
          stroke: 'currentColor',
          strokeWidth: 1.3,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
        }),
      );
    }

    /** Per-message entry: preselects this answer and the question that led to it. */
    function ShareMessageAction(props) {
      const t = typeof props.t === 'function' ? props.t : translate;
      const useChat = typeof props.useChat === 'function' ? props.useChat : noopUseChat;
      const useSessions = typeof props.useSessions === 'function' ? props.useSessions : noopUseSessions;
      const useSession = typeof props.useSession === 'function' ? props.useSession : noopUseSession;
      const sessionId = props.sessionId;
      const messageId = typeof props.messageId === 'string' ? props.messageId : null;

      const nodes = useChat((snapshot) =>
        snapshot !== null && snapshot !== undefined && snapshot.legacy !== undefined
          ? snapshot.legacy.nodes
          : EMPTY_NODES,
      );
      const sessionTitle = useSessions((snapshot) => {
        const entry =
          snapshot !== null && snapshot !== undefined && snapshot.byId !== undefined
            ? snapshot.byId[sessionId]
            : undefined;
        const title = entry !== null && entry !== undefined ? entry.title : undefined;
        return typeof title === 'string' ? title : '';
      });
      const hasMoreHistory = useSession((snapshot) =>
        snapshot !== null && snapshot !== undefined && snapshot.hasMore === true,
      );

      const entries = collectMessages(nodes, {
        image: t('card.image'),
        file: t('card.file'),
      });
      let index = -1;
      if (messageId !== null) {
        index = entries.findIndex(
          (entry) => entry.role === 'assistant' && entry.messageIds.includes(messageId),
        );
      }
      if (index === -1) return null;

      const preselect = [entries[index].id];
      for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
        if (entries[cursor].role === 'user') {
          preselect.push(entries[cursor].id);
          break;
        }
      }

      const onShare = () => {
        openPicker(entries, preselect, hasMoreHistory, cardTitle(sessionTitle, t));
      };

      return h(
        React.Fragment,
        null,
        h(
          'button',
          {
            type: 'button',
            className: 'dsh-shareimg-msgbtn',
            title: t('action.shareMessage'),
            'aria-label': t('action.shareMessage'),
            onClick: onShare,
          },
          h(ShareGlyph),
        ),
      );
    }

    /* ------------------------------------------------------------------ *
     * Preview overlay
     * ------------------------------------------------------------------ */

    function downloadView(view) {
      const anchor = document.createElement('a');
      anchor.href = view.dataUrl;
      anchor.download = view.fileName;
      anchor.rel = 'noopener';
      anchor.click();
    }

    async function copyView(view, t) {
      try {
        if (
          typeof navigator === 'undefined' ||
          navigator.clipboard === undefined ||
          typeof ClipboardItem === 'undefined'
        ) {
          throw new Error('clipboard image write is unavailable');
        }
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': view.blob })]);
        flashNotice(t('dialog.copied'));
        setShareState({ error: null });
      } catch (error) {
        console.error('[share-image] copy failed', error);
        setShareState({ error: t('dialog.copyFailed') });
      }
    }

    function ShareOverlay(props) {
      const t = typeof props.t === 'function' ? props.t : translate;
      const state = useShareState();
      const rootRef = React.useRef(null);
      const closeRef = React.useRef(null);
      const open = state.open;
      const stage = state.stage;

      React.useEffect(() => {
        if (!open) return undefined;
        const onKeyDown = (event) => {
          if (event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            closePreview();
            return;
          }
          if (event.key !== 'Tab') return;
          const root = rootRef.current;
          if (root === null) return;
          const focusable = root.querySelectorAll('button, input');
          if (focusable.length === 0) return;
          const first = focusable[0];
          const last = focusable[focusable.length - 1];
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
          }
        };
        document.addEventListener('keydown', onKeyDown, true);
        const timer = setTimeout(() => {
          if (closeRef.current !== null) closeRef.current.focus();
        }, 30);
        return () => {
          document.removeEventListener('keydown', onKeyDown, true);
          clearTimeout(timer);
        };
      }, [open, stage]);

      if (!open) return null;

      const view = state.view;
      const selectStage = stage !== 'preview' || view === null;
      const selected = new Set(state.selected);
      const statusNode = h(
        'div',
        {
          className: 'dsh-shareimg-status',
          'data-tone': state.error !== null ? 'error' : undefined,
          role: 'status',
          'aria-live': 'polite',
        },
        state.error !== null ? state.error : state.notice !== null ? state.notice : '',
      );

      const body = selectStage
        ? h(
            'div',
            { className: 'dsh-shareimg-select' },
            h(
              'div',
              { className: 'dsh-shareimg-toolbar' },
              h(
                'span',
                { className: 'dsh-shareimg-count' },
                t('select.count', {
                  selected: state.selected.length,
                  total: state.entries.length,
                }),
              ),
              h(
                'button',
                {
                  type: 'button',
                  className: 'dsh-shareimg-link',
                  onClick: selectEveryEntry,
                },
                t('select.all'),
              ),
              h(
                'button',
                {
                  type: 'button',
                  className: 'dsh-shareimg-link',
                  onClick: selectNoEntry,
                },
                t('select.none'),
              ),
            ),
            h(
              'div',
              { className: 'dsh-shareimg-list' },
              state.entries.map((entry) =>
                h(
                  'label',
                  {
                    key: entry.id,
                    className: 'dsh-shareimg-row',
                    'data-role': entry.role,
                  },
                  h('input', {
                    type: 'checkbox',
                    className: 'dsh-shareimg-check',
                    checked: selected.has(entry.id),
                    onChange: () => toggleSelection(entry.id),
                  }),
                  h(
                    'span',
                    { className: 'dsh-shareimg-rowrole' },
                    entry.role === 'user' ? t('card.you') : t('card.assistant'),
                  ),
                  h('span', { className: 'dsh-shareimg-rowtext' }, previewText(entry.text)),
                ),
              ),
            ),
          )
        : h(
            'div',
            { className: 'dsh-shareimg-body' },
            h('img', {
              className: 'dsh-shareimg-image',
              src: view.dataUrl,
              alt: t('dialog.preview'),
              width: view.width,
              height: view.height,
            }),
          );

      const footer = selectStage
        ? h(
            'div',
            { className: 'dsh-shareimg-foot' },
            statusNode,
            h(
              'button',
              { type: 'button', className: 'dsh-shareimg-action', onClick: closePreview },
              t('select.cancel'),
            ),
            h(
              'button',
              {
                type: 'button',
                className: 'dsh-shareimg-action',
                'data-variant': 'primary',
                disabled: state.selected.length === 0,
                onClick: generatePreview,
              },
              t('select.generate'),
            ),
          )
        : h(
            'div',
            { className: 'dsh-shareimg-foot' },
            statusNode,
            h(
              'button',
              { type: 'button', className: 'dsh-shareimg-action', onClick: backToSelection },
              t('preview.back'),
            ),
            h(
              'button',
              {
                type: 'button',
                className: 'dsh-shareimg-action',
                onClick: () => {
                  void copyView(view, t);
                },
              },
              t('dialog.copy'),
            ),
            h(
              'button',
              {
                type: 'button',
                className: 'dsh-shareimg-action',
                'data-variant': 'primary',
                onClick: () => downloadView(view),
              },
              t('dialog.download'),
            ),
          );

      return h(
        React.Fragment,
        null,
        h(
          'div',
          {
            className: 'dsh-shareimg-backdrop',
            onMouseDown: (event) => {
              if (event.target === event.currentTarget) closePreview();
            },
          },
          h(
            'div',
            {
              className: 'dsh-shareimg-panel',
              role: 'dialog',
              'aria-modal': 'true',
              'aria-label': selectStage ? t('select.title') : t('dialog.preview'),
              ref: rootRef,
            },
            h(
              'div',
              { className: 'dsh-shareimg-head' },
              h(
                'div',
                { className: 'dsh-shareimg-title' },
                selectStage ? t('select.title') : t('dialog.title'),
              ),
              h(
                'button',
                {
                  type: 'button',
                  className: 'dsh-shareimg-close',
                  'aria-label': t('dialog.close'),
                  title: t('dialog.close'),
                  ref: closeRef,
                  onClick: closePreview,
                },
                h(
                  'svg',
                  { viewBox: '0 0 16 16', width: 14, height: 14, fill: 'none', 'aria-hidden': true },
                  h('path', {
                    d: 'M4 4l8 8M12 4l-8 8',
                    stroke: 'currentColor',
                    strokeWidth: 1.5,
                    strokeLinecap: 'round',
                  }),
                ),
              ),
            ),
            body,
            footer,
          ),
        ),
      );
    }

    /* ------------------------------------------------------------------ *
     * Plugin entry
     * ------------------------------------------------------------------ */

    let localeReader = () => 'en';

    function apply(ctx) {
      ctx.effect(() => {
        const tag = document.createElement('style');
        tag.setAttribute('data-share-image', '');
        tag.textContent = CSS;
        document.head.appendChild(tag);
        return () => tag.remove();
      }, 'conversation-share-image: styles');

      const bound = ctx.locale.bind(NS);
      translate = (key, params) => {
        try {
          return bound(key, params);
        } catch (error) {
          return key;
        }
      };
      localeReader = () => {
        try {
          const snapshot = ctx.locale.getLocale();
          return (snapshot !== null && snapshot !== undefined && snapshot.active) || 'en';
        } catch (error) {
          return 'en';
        }
      };

      ctx.effect(
        () =>
          ctx.locale.register(NS, {
            en: {
              'action.shareMessage': 'Share this reply as image',
              'select.title': 'Choose messages to share',
              'select.all': 'Select all',
              'select.none': 'Clear',
              'select.count': '{selected} of {total} selected',
              'select.generate': 'Create image',
              'select.cancel': 'Cancel',
              'select.empty': 'Choose at least one message.',
              'preview.back': 'Back to selection',
              'dialog.title': 'Share as image',
              'dialog.download': 'Download PNG',
              'dialog.copy': 'Copy image',
              'dialog.close': 'Close',
              'dialog.copied': 'Image copied',
              'dialog.copyFailed': "Couldn't copy the image. Download it instead.",
              'dialog.preview': 'Conversation image preview',
              'dialog.partial':
                "Older messages aren't loaded in this view yet, so the image starts partway through the conversation.",
              'card.defaultTitle': 'Conversation',
              'card.messages': '{count} messages',
              'card.you': 'You',
              'card.assistant': 'Assistant',
              'card.image': 'Image',
              'card.file': 'File',
              'card.footer': 'Shared from DeepSeek Harness',
              'card.truncated':
                'Long conversation: only the most recent messages fit in one image.',
            },
            zh: {
              'action.shareMessage': '\u628a\u8fd9\u6761\u56de\u590d\u5206\u4eab\u4e3a\u56fe\u7247',
              'select.title': '\u9009\u62e9\u8981\u5206\u4eab\u7684\u6d88\u606f',
              'select.all': '\u5168\u9009',
              'select.none': '\u5168\u4e0d\u9009',
              'select.count': '\u5df2\u9009 {selected} / {total}',
              'select.generate': '\u751f\u6210\u56fe\u7247',
              'select.cancel': '\u53d6\u6d88',
              'select.empty': '\u8bf7\u81f3\u5c11\u9009\u62e9\u4e00\u6761\u6d88\u606f\u3002',
              'preview.back': '\u8fd4\u56de\u9009\u62e9',
              'dialog.title': '\u5206\u4eab\u4e3a\u56fe\u7247',
              'dialog.download': '\u4e0b\u8f7d PNG',
              'dialog.copy': '\u590d\u5236\u56fe\u7247',
              'dialog.close': '\u5173\u95ed',
              'dialog.copied': '\u56fe\u7247\u5df2\u590d\u5236',
              'dialog.copyFailed':
                '\u590d\u5236\u56fe\u7247\u5931\u8d25\uff0c\u8bf7\u6539\u4e3a\u4e0b\u8f7d\u3002',
              'dialog.preview': '\u5bf9\u8bdd\u56fe\u7247\u9884\u89c8',
              'dialog.partial':
                '\u5f53\u524d\u89c6\u56fe\u5c1a\u672a\u52a0\u8f7d\u66f4\u65e9\u7684\u6d88\u606f\uff0c\u56e0\u6b64\u56fe\u7247\u4ece\u5bf9\u8bdd\u4e2d\u6bb5\u5f00\u59cb\u3002',
              'card.defaultTitle': '\u5bf9\u8bdd',
              'card.messages': '{count} \u6761\u6d88\u606f',
              'card.you': '\u4f60',
              'card.assistant': '\u52a9\u624b',
              'card.image': '\u56fe\u7247',
              'card.file': '\u6587\u4ef6',
              'card.footer': '\u6765\u81ea DeepSeek Harness \u7684\u5bf9\u8bdd\u5206\u4eab',
              'card.truncated':
                '\u5bf9\u8bdd\u8fc7\u957f\uff0c\u4e00\u5f20\u56fe\u7247\u53ea\u5bb9\u7eb3\u4e86\u6700\u8fd1\u7684\u6d88\u606f\u3002',
            },
          }),
        'conversation-share-image: copy dictionaries',
      );

      ctx.slots.inject('conversation.chat.assistant-actions', () =>
        ctx.slots.register(
          {
            name: 'conversation.chat.assistant-actions',
            id: 'share-image-message',
            order: 5,
            locale: NS,
          },
          ShareMessageAction,
        ),
      );

      ctx.slots.inject('shell.overlay', () =>
        ctx.slots.register(
          {
            name: 'shell.overlay',
            id: 'share-image-preview',
            order: 300,
            locale: NS,
          },
          ShareOverlay,
        ),
      );
    }

    return {
      inject: ['slots', 'locale'],
      apply,
    };
  },
});
