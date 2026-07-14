import { Text, View } from '@react-pdf/renderer';

function decodeEntities(str) {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
}

/**
 * Parse inline markup into react-pdf Text nodes.
 * Supports: <strong>/<b>, <em>/<i>, <br>, color spans, strips links to text.
 */
function parseInlineSegments(html, baseStyle) {
  const marked = html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<span\s+style="[^"]*color:\s*([^;"']+)[^"]*"[^>]*>([\s\S]*?)<\/span>/gi, '\x07$1\x08$2\x09')
    .replace(/<span\s+style='[^']*color:\s*([^;']+)[^']*'[^>]*>([\s\S]*?)<\/span>/gi, '\x07$1\x08$2\x09')
    .replace(/<strong>([\s\S]*?)<\/strong>/gi, '\x01$1\x02')
    .replace(/<b>([\s\S]*?)<\/b>/gi, '\x01$1\x02')
    .replace(/<em>([\s\S]*?)<\/em>/gi, '\x03$1\x04')
    .replace(/<i>([\s\S]*?)<\/i>/gi, '\x03$1\x04')
    .replace(/<u>([\s\S]*?)<\/u>/gi, '\x0b$1\x0c')
    .replace(/<a[^>]*>([\s\S]*?)<\/a>/gi, '$1')
    .replace(/<[^>]+>/g, '');

  const clean = decodeEntities(marked);
  const parts = clean.split(/(\x01[\s\S]*?\x02|\x03[\s\S]*?\x04|\x07[\s\S]*?\x08[\s\S]*?\x09|\x0b[\s\S]*?\x0c)/);

  return parts.map((part, i) => {
    if (part.startsWith('\x01') && part.endsWith('\x02')) {
      return <Text key={i} style={{ ...baseStyle, fontWeight: 'bold' }}>{part.slice(1, -1)}</Text>;
    }
    if (part.startsWith('\x03') && part.endsWith('\x04')) {
      return <Text key={i} style={{ ...baseStyle, fontStyle: 'italic' }}>{part.slice(1, -1)}</Text>;
    }
    if (part.startsWith('\x0b') && part.endsWith('\x0c')) {
      return <Text key={i} style={{ ...baseStyle, textDecoration: 'underline' }}>{part.slice(1, -1)}</Text>;
    }
    if (part.startsWith('\x07') && part.includes('\x08') && part.endsWith('\x09')) {
      const idx = part.indexOf('\x08');
      const colorVal = part.slice(1, idx).trim();
      const textVal = part.slice(idx + 1, -1);
      return <Text key={i} style={{ ...baseStyle, color: colorVal }}>{textVal}</Text>;
    }
    return part ? <Text key={i} style={baseStyle}>{part}</Text> : null;
  }).filter(Boolean);
}

/**
 * HTML → react-pdf rich text, closer to the canvas `.rich-text-output` behavior.
 */
export function PdfRichText({ html, style = {} }) {
  if (!html) return null;

  const elements = [];
  let src = html;

  const lists = [];
  src = src.replace(/<(ul|ol)>([\s\S]*?)<\/\1>/gi, (_, tag, inner) => {
    const items = [...inner.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)].map(m => m[1]);
    const idx = lists.length;
    lists.push({ ordered: tag.toLowerCase() === 'ol', items });
    return `\x05${idx}\x06`;
  });

  // Split on list markers and paragraph boundaries
  const parts = src.split(/(\x05\d+\x06)|<\/p>|<p[^>]*>/i).filter(p => p != null && p !== '');

  for (const part of parts) {
    const listMatch = part.match(/^\x05(\d+)\x06$/);
    if (listMatch) {
      const list = lists[parseInt(listMatch[1], 10)];
      if (list) {
        list.items.forEach((item, i) => {
          const bullet = list.ordered ? `${i + 1}.` : '•';
          // Allow wrapping so long bullets can split across pages (canvas can window
          // tall leaves). wrap={false} left large empty bottoms and extra PDF pages.
          elements.push(
            <View key={`li-${elements.length}-${i}`} style={{ flexDirection: 'row', marginBottom: 1.5 }}>
              <Text style={{ ...style, width: list.ordered ? 14 : 10 }}>{bullet}</Text>
              <Text style={{ ...style, flex: 1 }}>{parseInlineSegments(item, style)}</Text>
            </View>
          );
        });
      }
      continue;
    }

    // Skip pure whitespace / leftover tags
    const stripped = part.replace(/<[^>]+>/g, '').trim();
    if (!stripped) continue;

    const inline = parseInlineSegments(part, style);
    if (inline.length) {
      elements.push(
        <Text key={`p-${elements.length}`} style={{ ...style, marginBottom: 2 }}>
          {inline}
        </Text>
      );
    }
  }

  if (!elements.length) {
    // Fallback: strip tags and dump plain text so content is never silently dropped
    const plain = decodeEntities(html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
    if (plain) {
      return <Text style={style}>{plain}</Text>;
    }
    return null;
  }

  return <>{elements}</>;
}
