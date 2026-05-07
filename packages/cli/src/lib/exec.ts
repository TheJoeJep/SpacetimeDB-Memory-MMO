import { execa } from 'execa';
import chalk from 'chalk';

export async function run(
  cmd: string,
  args: string[],
  opts: { cwd?: string; quiet?: boolean } = {}
): Promise<{ stdout: string; stderr: string }> {
  if (!opts.quiet) {
    console.log(chalk.gray(`$ ${cmd} ${args.join(' ')}`));
  }
  try {
    const result = await execa(cmd, args, { cwd: opts.cwd });
    return { stdout: result.stdout, stderr: result.stderr };
  } catch (err) {
    const e = err as { stdout?: string; stderr?: string; message: string };
    throw new Error(
      `Command failed: ${cmd} ${args.join(' ')}\n` +
      `${e.stderr ?? ''}\n${e.stdout ?? ''}\n${e.message}`
    );
  }
}

export async function commandExists(cmd: string): Promise<boolean> {
  try {
    await execa(cmd, ['--version']);
    return true;
  } catch {
    return false;
  }
}
