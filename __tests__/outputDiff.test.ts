import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { outputDiff } from '../src/outputDiff';

function git(cwd: string, args: string[]): void {
  execFileSync('git', args, { cwd, stdio: 'ignore' });
}

function makeLargeTodoFile(): string {
  return (
    Array.from(
      { length: 12000 },
      (_, index) =>
        `// TODO line ${index.toString().padStart(5, '0')} ${'x'.repeat(80)}`
    ).join('\n') + '\n'
  );
}

describe('outputDiff', () => {
  const originalCwd = process.cwd();
  let tmpRoot: string;

  beforeEach(() => {
    tmpRoot = mkdtempSync(join(tmpdir(), 'todo-comments-in-pr-'));
  });

  afterEach(() => {
    process.chdir(originalCwd);
    rmSync(tmpRoot, { recursive: true, force: true });
  });

  it('returns diff output larger than child_process.exec maxBuffer', async () => {
    const originPath = join(tmpRoot, 'origin.git');
    const workPath = join(tmpRoot, 'work');

    git(tmpRoot, ['init', '--bare', originPath]);
    git(tmpRoot, ['clone', originPath, workPath]);
    git(workPath, ['checkout', '-b', 'main']);
    git(workPath, ['config', 'user.email', 'todo-comments-in-pr@example.com']);
    git(workPath, ['config', 'user.name', 'todo-comments-in-pr']);
    writeFileSync(join(workPath, 'large.txt'), 'base\n');
    git(workPath, ['add', 'large.txt']);
    git(workPath, ['commit', '-m', 'initial']);
    git(workPath, ['push', '-u', 'origin', 'main']);

    writeFileSync(join(workPath, 'large.txt'), makeLargeTodoFile());

    process.chdir(workPath);
    const diff = await outputDiff(['*.txt'], 'main');

    expect(Buffer.byteLength(diff, 'utf8')).toBeGreaterThan(1024 * 1024);
    expect(diff).toContain('+// TODO line 00000');
  });
});
