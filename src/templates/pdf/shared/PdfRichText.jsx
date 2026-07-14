import { Text, View } from '@react-pdf/renderer';

function decodeEntities(str) {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"');
}

function parseInlineSegments(html, baseStyle) {
  const marked = html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<span\s+style="color:\s*([^;"]+);?"[^>]*>([\s\S]*?)<\/span>/gi, '\x07$1\x08$2\x09')
    .replace(/<strong>([\s\S]*?)<\/strong>/gi, '\x01$1\x02')
    .replace(/<b>([\s\S]*?)<\/b>/gi, '\x01$1\x02')
    .replace(/<em>([\s\S]*?)<\/em>/gi, '\x03$1\x04')
    .replace(/<i>([\s\S]*?)<\/i>/gi, '\x03$1\x04')
    .replace(/<a[^>]*>([\s\S]*?)<\/a>/gi, '$1')
    .replace(/<[^>]+>/g, '');

  const clean = decodeEntities(marked);
  const parts = clean.split(/(\x01[\s\S]*?\x02|\x03[\s\S]*?\x04|\x07[\s\S]*?\x08[\s\S]*?\x09)/);

  return parts.map((part, i) => {
    if (part.startsWith('\x01') && part.endsWith('\x02')) {
      return <Text key={i} style={{ ...baseStyle, fontWeight: 'bold' }}>{part.slice(1, -1)}</Text>;
    }
    if (part.startsWith('\x03') && part.endsWith('\x04')) {
      return <Text key={i} style={{ ...baseStyle, fontStyle: 'italic' }}>{part.slice(1, -1)}</Text>;
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

export function PdfRichText({ html, style = {} }) {
  if (!html) return null;

  const elements = [];
  let src = html;

  const lists = [];
  src = src.replace(/<(ul|ol)>([\s\S]*?)<\/\1>/gi, (_, _tag, inner) => {
    const items = [...inner.matchAll(/<li>([\s\S]*?)<\/li>/gi)].map(m => m[1]);
    const idx = lists.length;
    lists.push(items);
    return `\x05${idx}\x06`;
  });

  const parts = src.split(/(\x05\d+\x06)|<\/p>/).filter(Boolean);

  for (const part of parts) {
    const listMatch = part.match(/^\x05(\d+)\x06$/);
    if (listMatch) {
      const items = lists[parseInt(listMatch[1])];
      if (items) {
        items.forEach((item, i) => {
          elements.push(
            <View key={`li-${elements.length}-${i}`} style={{ flexDirection: 'row', marginBottom: 1 }} wrap={false}>
              <Text style={{ ...style, width: 10 }}>{'•'}</Text>
              <Text style={{ ...style, flex: 1 }}>{parseInlineSegments(item, style)}</Text>
            </View>
          );
        });
      }
    } else {
      const stripped = part.replace(/<p[^>]*>/gi, '').replace(/<[^>]+>/g, '').trim();
      if (!stripped) continue;
      const inline = parseInlineSegments(part.replace(/<p[^>]*>/gi, ''), style);
      if (inline.length) {
        elements.push(
          <Text key={`p-${elements.length}`} style={{ ...style, marginBottom: 2 }}>
            {inline}
          </Text>
        );
      }
    }
  }

  return <>{elements}</>;
}
