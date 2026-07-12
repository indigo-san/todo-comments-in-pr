import { spawn } from 'node:child_process';

type CommandResult = {
  stdout: string;
  stderr: string;
};

async function runGit(args: string[]): Promise<CommandResult> {
  return await new Promise((resolve, reject) => {
    const child = spawn('git', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];

    child.stdout.on('data', (chunk: Buffer) => {
      stdoutChunks.push(chunk);
    });
    child.stderr.on('data', (chunk: Buffer) => {
      stderrChunks.push(chunk);
    });
    child.on('error', reject);
    child.on('close', (code, signal) => {
      const stdout = Buffer.concat(stdoutChunks).toString('utf8');
      const stderr = Buffer.concat(stderrChunks).toString('utf8');

      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }

      reject(
        new Error(
          `git ${args.join(' ')} failed with ${
            signal ? `signal ${signal}` : `exit code ${code ?? 'unknown'}`
          }: ${stderr || stdout}`
        )
      );
    });
  });
}

export async function outputDiff(
  path: string[],
  commit: string
): Promise<string> {
  await runGit(['fetch', 'origin', commit]);
  const { stdout } = await runGit([
    'diff',
    `origin/${commit}`,
    '-U0',
    '--diff-filter=AM',
    '--',
    ...path
  ]);

  return stdout;
}
