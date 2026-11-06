/**
 * Share-as-image browser half.
 *
 * Adds a picture action to every finalized assistant reply, renders the
 * selected messages into a PNG card with Canvas 2D, and previews it in the
 * frame-wide overlay with Download and Copy actions.
 */
window.__ModuleLoader__.load({
  id: '@showin2333/dsh-plugin-share-image',
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
      margin: 16,
      pad: 40,
      radius: 20,
      maxHeight: 6200,
      brand: '#4d6bfe',
    };

    const COLORS = {
      backgroundTop: '#f7f9fd',
      backgroundBottom: '#e8edf7',
      card: '#ffffff',
      cardEdge: 'rgba(20, 29, 54, 0.05)',
      ink: '#12141a',
      body: '#22262e',
      meta: '#6b7482',
      divider: '#eceff5',
      marker: '#7c8695',
      codeBg: '#f7f8fb',
      codeBorder: '#e9ecf2',
      codeText: '#374151',
      quoteBar: '#c7d2fe',
      quoteText: '#4b5563',
      warnBg: '#fff8ed',
      warnBorder: '#fbe2c0',
      warnText: '#b45309',
      userBg: '#f4f8ff',
      userBorder: '#e3ebfd',
      userChipBg: '#e8efff',
      userChipText: '#3b5bdb',
      assistantChipBg: '#f2f3f6',
      assistantChipText: '#5b6472',
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
      const lastIndex = blocks.length - 1;
      blocks.forEach((block, index) => {
        const trailing = index === lastIndex ? 0 : blockGap(block);
        if (block.kind === 'heading') {
          const size = block.level <= 1 ? 21 : block.level === 2 ? 18.5 : 16.5;
          const font = '700 ' + size + 'px ' + SANS;
          if (index > 0) y += 8;
          const lines = wrapText(measure, block.text, width, font);
          y = emitLines(ops, lines, x, y, font, COLORS.ink, size + 11, size * 0.8 + 3);
          y += index === lastIndex ? 0 : 6;
          return;
        }
        if (block.kind === 'code') {
          const font = '12.5px ' + MONO;
          const pad = 15;
          const lineHeight = 20;
          const lines = [];
          for (const raw of block.lines) {
            lines.push(...wrapText(measure, raw === '' ? ' ' : raw, width - pad * 2, font));
          }
          if (lines.length === 0) lines.push(' ');
          const height = pad * 2 + lines.length * lineHeight;
          ops.push({ t: 'rect', x, y, w: width, h: height, r: 10, c: COLORS.codeBg });
          ops.push({ t: 'stroke', x, y, w: width, h: height, r: 10, c: COLORS.codeBorder });
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
          y += height + trailing;
          return;
        }
        if (block.kind === 'quote') {
          const font = '15px ' + SANS;
          const lineHeight = 24;
          const lines = wrapText(measure, block.text, width - 20, font);
          ops.push({
            t: 'rect',
            x,
            y: y + 3,
            w: 4,
            h: Math.max(lines.length * lineHeight - 8, 8),
            r: 2,
            c: COLORS.quoteBar,
          });
          y = emitLines(ops, lines, x + 20, y, font, COLORS.quoteText, lineHeight, 17.5);
          y += trailing;
          return;
        }
        if (block.kind === 'item') {
          const font = '15px ' + SANS;
          const lineHeight = 25;
          const lines = wrapText(measure, block.text, width - 26, font);
          ops.push({ t: 'text', s: block.marker, x, y: y + 18, f: font, c: COLORS.marker });
          y = emitLines(ops, lines, x + 26, y, font, COLORS.body, lineHeight, 18);
          y += trailing;
          return;
        }
        const font = '15px ' + SANS;
        const lineHeight = 25;
        const lines = wrapText(measure, block.text, width, font);
        y = emitLines(ops, lines, x, y, font, COLORS.body, lineHeight, 18);
        y += trailing;
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

    /** Gradient rounded square with a white photo glyph, used as the card mark. */
    function paintMark(ctx, op) {
      const { x, y, s } = op;
      ctx.save();
      const gradient = ctx.createLinearGradient(x, y, x + s, y + s);
      gradient.addColorStop(0, '#5b78ff');
      gradient.addColorStop(1, '#7a5cff');
      roundRectPath(ctx, x, y, s, s, s * 0.3);
      ctx.fillStyle = gradient;
      ctx.fill();

      const frameW = s * 0.52;
      const frameH = s * 0.4;
      const frameX = x + (s - frameW) / 2;
      const frameY = y + (s - frameH) / 2;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
      ctx.lineWidth = Math.max(1.2, s * 0.045);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      roundRectPath(ctx, frameX, frameY, frameW, frameH, frameH * 0.2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(frameX + frameW * 0.28, frameY + frameH * 0.34, Math.max(1, s * 0.045), 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(frameX + frameW * 0.12, frameY + frameH * 0.82);
      ctx.lineTo(frameX + frameW * 0.42, frameY + frameH * 0.5);
      ctx.lineTo(frameX + frameW * 0.62, frameY + frameH * 0.72);
      ctx.lineTo(frameX + frameW * 0.78, frameY + frameH * 0.58);
      ctx.lineTo(frameX + frameW * 0.9, frameY + frameH * 0.82);
      ctx.stroke();
      ctx.restore();
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
        } else if (op.t === 'dot') {
          ctx.beginPath();
          ctx.arc(op.x, op.y, op.r, 0, Math.PI * 2);
          ctx.fillStyle = op.c;
          ctx.fill();
        } else if (op.t === 'mark') {
          paintMark(ctx, op);
        } else if (op.t === 'text') {
          ctx.font = op.f;
          ctx.fillStyle = op.c;
          ctx.fillText(op.s, op.x, op.y);
        }
      }
    }

    function fitEllipsis(measure, text, maxWidth, font) {
      measure.font = font;
      let candidate = text;
      while (candidate.length > 0 && measure.measureText(candidate + '\u2026').width > maxWidth) {
        candidate = candidate.slice(0, -1);
      }
      return candidate + '\u2026';
    }

    function measureTextWidth(measure, text, font) {
      measure.font = font;
      return measure.measureText(text).width;
    }

    /** Lay out parsed markdown at the origin so callers can place or box it. */
    function renderBlocks(text, width, measure) {
      const ops = [];
      const height = layoutMessageBlocks(ops, parseBlocks(text), 0, 0, width, measure);
      return { ops, height };
    }

    function naturalContentWidth(content, measure) {
      let width = 0;
      for (const op of content.ops) {
        if (op.t === 'text') {
          width = Math.max(width, measureTextWidth(measure, op.s, op.f));
        } else if (op.t === 'rect' || op.t === 'stroke') {
          width = Math.max(width, op.w);
        } else if (op.t === 'line') {
          width = Math.max(width, Math.abs(op.x2 - op.x1));
        }
      }
      return width;
    }

    function shiftOps(target, ops, dx, dy) {
      for (const op of ops) {
        if (op.x !== undefined) op.x += dx;
        if (op.y !== undefined) op.y += dy;
        if (op.x1 !== undefined) {
          op.x1 += dx;
          op.x2 += dx;
          op.y1 += dy;
          op.y2 += dy;
        }
        target.push(op);
      }
    }

    function buildLayout(options) {
      const measure = measureContext();
      const ops = [];
      const width = CARD.width;
      const margin = CARD.margin;
      const pad = CARD.pad;
      const cardWidth = width - margin * 2;
      const contentWidth = cardWidth - pad * 2;
      const left = pad;
      const right = cardWidth - pad;
      let y = pad;

      // Brand row: gradient mark, wordmark, and date.
      ops.push({ t: 'mark', x: left, y, s: 36 });
      ops.push({
        t: 'text',
        s: 'DeepSeek Harness',
        x: left + 50,
        y: y + 24,
        f: '600 16px ' + SANS,
        c: COLORS.ink,
      });
      const dateFont = '12.5px ' + SANS;
      const dateWidth = measureTextWidth(measure, options.dateText, dateFont);
      ops.push({
        t: 'text',
        s: options.dateText,
        x: right - dateWidth,
        y: y + 23,
        f: dateFont,
        c: COLORS.meta,
      });

      y += 36 + 28;

      // Title.
      const titleFont = '700 27px ' + SANS;
      const allTitleLines = wrapText(measure, options.title, contentWidth, titleFont);
      const titleLines = allTitleLines.slice(0, 3);
      if (allTitleLines.length > 3) {
        titleLines[2] = fitEllipsis(measure, titleLines[2], contentWidth, titleFont);
      }
      for (const line of titleLines) {
        ops.push({ t: 'text', s: line, x: left, y: y + 23, f: titleFont, c: COLORS.ink });
        y += 37;
      }

      // Meta line.
      y += 2;
      ops.push({
        t: 'text',
        s: options.metaText,
        x: left,
        y: y + 16,
        f: '13px ' + SANS,
        c: COLORS.meta,
      });
      y += 16 + 24;
      ops.push({ t: 'line', x1: left, y1: y, x2: right, y2: y, c: COLORS.divider });
      y += 28;

      let truncated = false;
      for (const message of options.messages) {
        if (y > CARD.maxHeight - 320) {
          truncated = true;
          break;
        }
        const isUser = message.role === 'user';
        const roleLabel = isUser ? options.labels.user : options.labels.assistant;
        const pillFont = '600 11px ' + SANS;
        const pillWidth = measureTextWidth(measure, roleLabel, pillFont) + 27;
        ops.push({
          t: 'rect',
          x: left,
          y,
          w: pillWidth,
          h: 22,
          r: 11,
          c: isUser ? COLORS.userChipBg : COLORS.assistantChipBg,
        });
        ops.push({
          t: 'dot',
          x: left + 11,
          y: y + 11,
          r: 3,
          c: isUser ? COLORS.userChipText : COLORS.assistantChipText,
        });
        ops.push({
          t: 'text',
          s: roleLabel,
          x: left + 20,
          y: y + 15,
          f: pillFont,
          c: isUser ? COLORS.userChipText : COLORS.assistantChipText,
        });
        y += 22 + 12;

        if (isUser) {
          const innerWidth = contentWidth - 36;
          const content = renderBlocks(message.text, innerWidth, measure);
          const bubbleHeight = Math.ceil(content.height + 28);
          const bubbleWidth = Math.min(
            contentWidth,
            Math.max(200, Math.ceil(naturalContentWidth(content, measure) + 36)),
          );
          ops.push({
            t: 'rect',
            x: left,
            y,
            w: bubbleWidth,
            h: bubbleHeight,
            r: 14,
            c: COLORS.userBg,
          });
          ops.push({
            t: 'stroke',
            x: left,
            y,
            w: bubbleWidth,
            h: bubbleHeight,
            r: 14,
            c: COLORS.userBorder,
          });
          shiftOps(ops, content.ops, left + 18, y + 14);
          y += bubbleHeight;
        } else {
          const content = renderBlocks(message.text, contentWidth, measure);
          shiftOps(ops, content.ops, left, y);
          y += content.height;
        }
        y += 26;
      }

      if (truncated) {
        const font = '12.5px ' + SANS;
        const lines = wrapText(measure, options.truncatedNote, contentWidth - 32, font);
        const height = lines.length * 19 + 22;
        ops.push({ t: 'rect', x: left, y, w: contentWidth, h: height, r: 10, c: COLORS.warnBg });
        ops.push({
          t: 'stroke',
          x: left,
          y,
          w: contentWidth,
          h: height,
          r: 10,
          c: COLORS.warnBorder,
        });
        emitLines(ops, lines, left + 16, y + 11, font, COLORS.warnText, 19, 13.5);
        y += height + 14;
      }

      // Footer.
      y += 2;
      ops.push({ t: 'line', x1: left, y1: y, x2: right, y2: y, c: COLORS.divider });
      y += 22;
      ops.push({ t: 'dot', x: left + 3, y: y + 5, r: 3, c: CARD.brand });
      ops.push({
        t: 'text',
        s: options.footerText,
        x: left + 14,
        y: y + 10,
        f: '11.5px ' + SANS,
        c: COLORS.meta,
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
      const canvasWidth = CARD.width;
      const canvasHeight = layout.height + CARD.margin * 2;
      const scale = canvasHeight * 2 <= 16000 ? 2 : 1;
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(canvasWidth * scale);
      canvas.height = Math.round(canvasHeight * scale);
      const ctx = canvas.getContext('2d');
      ctx.scale(scale, scale);
      ctx.textBaseline = 'alphabetic';

      // Soft page gradient, then the raised card with a light shadow.
      const page = ctx.createLinearGradient(0, 0, 0, canvasHeight);
      page.addColorStop(0, COLORS.backgroundTop);
      page.addColorStop(1, COLORS.backgroundBottom);
      ctx.fillStyle = page;
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);

      const cardX = CARD.margin;
      const cardY = CARD.margin;
      const cardW = canvasWidth - CARD.margin * 2;
      const cardH = layout.height;
      ctx.save();
      ctx.shadowColor = 'rgba(20, 29, 54, 0.10)';
      ctx.shadowBlur = 24;
      ctx.shadowOffsetY = 8;
      roundRectPath(ctx, cardX, cardY, cardW, cardH, CARD.radius);
      ctx.fillStyle = COLORS.card;
      ctx.fill();
      ctx.restore();
      ctx.strokeStyle = COLORS.cardEdge;
      ctx.lineWidth = 1;
      roundRectPath(ctx, cardX + 0.5, cardY + 0.5, cardW - 1, cardH - 1, CARD.radius);
      ctx.stroke();

      ctx.save();
      ctx.translate(CARD.margin, CARD.margin);
      drawOps(ctx, layout.ops);
      ctx.restore();

      const dataUrl = canvas.toDataURL('image/png');
      const now = new Date();
      return {
        dataUrl,
        blob: dataUrlToBlob(dataUrl),
        width: Math.round(canvasWidth * scale),
        height: Math.round(canvasHeight * scale),
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
      '.dsh-shareimg-msgbtn{width:28px;height:28px;border-radius:6px;border:0;background:transparent;color:var(--dsw-alias-label-secondary);display:inline-flex;align-items:center;justify-content:center;padding:6px;cursor:pointer;flex:none}' +
      '.dsh-shareimg-msgbtn:hover{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}' +
      '.dsh-shareimg-msgbtn:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:-2px}' +
      '.dsh-shareimg-msgbtn svg{width:17px;height:17px}' +
      '.dsh-shareimg-backdrop{position:fixed;inset:0;z-index:1200;display:flex;align-items:center;justify-content:center;padding:24px;background:rgba(10,12,16,.55);pointer-events:auto;overscroll-behavior:contain}' +
      '.dsh-shareimg-panel{width:min(960px,100%);max-height:calc(100vh - 48px);display:flex;flex-direction:column;overflow:hidden;border-radius:18px;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-overlay);box-shadow:0 28px 72px rgba(0,0,0,.38);color:var(--dsw-alias-label-primary);animation:dsh-shareimg-panel-in .18s cubic-bezier(.2,.8,.3,1)}' +
      '@keyframes dsh-shareimg-panel-in{from{opacity:0;transform:translateY(8px) scale(.996)}to{opacity:1;transform:none}}' +
      '.dsh-shareimg-head{display:flex;align-items:center;gap:12px;padding:14px 16px;border-bottom:1px solid var(--dsw-alias-border-l1);flex:none}' +
      '.dsh-shareimg-mark{width:32px;height:32px;border-radius:10px;background:linear-gradient(135deg,#5b78ff,#7a5cff);color:#ffffff;display:grid;place-items:center;flex:none;box-shadow:0 2px 8px rgba(77,107,254,.32)}' +
      '.dsh-shareimg-mark svg{width:17px;height:17px}' +
      '.dsh-shareimg-headtext{flex:1;min-width:0;display:flex;flex-direction:column;gap:1px}' +
      '.dsh-shareimg-title{font-size:14px;font-weight:600;line-height:20px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
      '.dsh-shareimg-subtitle{font-size:11.5px;line-height:16px;color:var(--dsw-alias-label-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
      '.dsh-shareimg-close{width:28px;height:28px;border-radius:8px;border:0;background:transparent;color:var(--dsw-alias-label-secondary);display:grid;place-items:center;cursor:pointer;flex:none}' +
      '.dsh-shareimg-close:hover{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}' +
      '.dsh-shareimg-close:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:-2px}' +
      '.dsh-shareimg-select{display:flex;flex-direction:column;flex:1;min-height:0}' +
      '.dsh-shareimg-toolbar{display:flex;align-items:center;gap:6px;padding:10px 16px;border-bottom:1px solid var(--dsw-alias-border-l1);flex:none;background:var(--dsw-alias-bg-layer-2)}' +
      '.dsh-shareimg-count{flex:1;min-width:0;font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
      '.dsh-shareimg-link{border:0;background:transparent;color:var(--dsw-alias-brand-primary);font-size:12px;font-weight:500;line-height:18px;cursor:pointer;padding:3px 7px;border-radius:6px;white-space:nowrap}' +
      '.dsh-shareimg-link:hover{background:var(--dsw-alias-bg-layer-1)}' +
      '.dsh-shareimg-link:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:-2px}' +
      '.dsh-shareimg-list{overflow:auto;padding:8px;display:flex;flex-direction:column;gap:2px;flex:1;min-height:0}' +
      '.dsh-shareimg-row{display:flex;align-items:flex-start;gap:12px;padding:10px 10px;border-radius:9px;cursor:pointer}' +
      '.dsh-shareimg-row:hover{background:var(--dsw-alias-bg-layer-2)}' +
      '.dsh-shareimg-check{appearance:none;-webkit-appearance:none;width:18px;height:18px;margin:0;border-radius:6px;border:1.5px solid var(--dsw-alias-border-l2);background:transparent;flex:none;cursor:pointer;position:relative;transition:background .12s,border-color .12s}' +
      '.dsh-shareimg-check:hover{border-color:var(--dsw-alias-brand-primary)}' +
      '.dsh-shareimg-check:checked{background-color:var(--dsw-alias-brand-primary);border-color:var(--dsw-alias-brand-primary);background-image:url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 16 16\'%3E%3Cpath d=\'M3.5 8.5l3 3 6-7\' fill=\'none\' stroke=\'%23ffffff\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:center;background-size:12px 12px}' +
      '.dsh-shareimg-check:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}' +
      '.dsh-shareimg-rowrole{font-size:11px;font-weight:600;line-height:18px;color:var(--dsw-alias-label-secondary);flex:none;min-width:52px;padding-top:1px}' +
      '.dsh-shareimg-row[data-role=user] .dsh-shareimg-rowrole{color:var(--dsw-alias-brand-primary)}' +
      '.dsh-shareimg-rowtext{font-size:13px;line-height:19px;color:var(--dsw-alias-label-primary);min-width:0;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;word-break:break-word}' +
      '.dsh-shareimg-body{overflow:auto;padding:18px;background:var(--dsw-alias-bg-layer-2);flex:1;min-height:0;display:flex;justify-content:center;align-items:flex-start}' +
      '.dsh-shareimg-image{display:block;max-width:100%;height:auto;border-radius:12px;box-shadow:0 10px 32px rgba(0,0,0,.20)}' +
      '.dsh-shareimg-foot{display:flex;align-items:center;gap:8px;padding:12px 16px;border-top:1px solid var(--dsw-alias-border-l1);flex:none;flex-wrap:wrap;background:var(--dsw-alias-bg-layer-1)}' +
      '.dsh-shareimg-status{flex:1;min-width:120px;font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary)}' +
      '.dsh-shareimg-status[data-tone=error]{color:var(--dsw-alias-state-error-primary)}' +
      '.dsh-shareimg-action{height:34px;padding:0 15px;border-radius:9px;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-overlay);color:var(--dsw-alias-label-primary);font-size:13px;font-weight:500;cursor:pointer;white-space:nowrap;transition:background .12s}' +
      '.dsh-shareimg-action:hover:not(:disabled){background:var(--dsw-alias-bg-layer-2)}' +
      '.dsh-shareimg-action:disabled{opacity:.45;cursor:default}' +
      '.dsh-shareimg-action:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}' +
      '.dsh-shareimg-action[data-variant=primary]{background:var(--dsw-alias-brand-primary);border-color:transparent;color:#ffffff;box-shadow:0 1px 2px rgba(0,0,0,.12)}' +
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
              h('div', { className: 'dsh-shareimg-mark', 'aria-hidden': true }, h(ShareGlyph)),
              h(
                'div',
                { className: 'dsh-shareimg-headtext' },
                h(
                  'div',
                  { className: 'dsh-shareimg-title' },
                  selectStage ? t('select.title') : t('dialog.title'),
                ),
                state.title !== ''
                  ? h('div', { className: 'dsh-shareimg-subtitle' }, state.title)
                  : null,
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
