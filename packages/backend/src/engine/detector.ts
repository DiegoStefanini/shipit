import * as fs from 'fs';
import * as path from 'path';
import { exec } from '../services/ssh.js';

export function detectLanguage(repoPath: string): string {
  if (fs.existsSync(path.join(repoPath, 'Cargo.toml'))) return 'rust';
  if (fs.existsSync(path.join(repoPath, 'package.json'))) return 'node';
  if (fs.existsSync(path.join(repoPath, 'requirements.txt'))) return 'python';
  return 'static';
}

export async function detectLanguageRemote(hostId: string, repoPath: string): Promise<string> {
  const result = await exec(hostId, `ls ${repoPath}`);
  const files = result.stdout.split('\n');
  if (files.includes('Cargo.toml')) return 'rust';
  if (files.includes('package.json')) return 'node';
  if (files.includes('requirements.txt')) return 'python';
  return 'static';
}
