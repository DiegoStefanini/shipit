import * as fs from 'fs';
import * as path from 'path';

export function detectLanguage(repoPath: string): string {
  if (fs.existsSync(path.join(repoPath, 'Cargo.toml'))) return 'rust';
  if (fs.existsSync(path.join(repoPath, 'package.json'))) return 'node';
  if (fs.existsSync(path.join(repoPath, 'requirements.txt'))) return 'python';
  return 'static';
}
