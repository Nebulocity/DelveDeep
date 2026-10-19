import { readdirSync, readFileSync } from 'node:fs';

export function sourceInventory() {
  return ['scenes', 'ui'].flatMap(folder => readdirSync(folder).filter(file => file.endsWith('.js')).map(file => {
    const source = readFileSync(`${folder}/${file}`, 'utf8');
    return { file: `${folder}/${file}`,
      navigation: [...source.matchAll(/(?:scene\.start|navigate)\(['"]([^'"]+)['"]|scene:\s*['"]([^'"]+)['"]/g)].map(match => match[1] ?? match[2]),
      controls: [...source.matchAll(/(?:setName\(|name:\s*)['"`]([^'"`]+)['"`]/g)].map(match => match[1]),
      states: [...new Set([...source.matchAll(/\b((?:show|open|render|close)[A-Z]\w*)\s*\(/g)].map(match => match[1]))]
    };
  }));
}
