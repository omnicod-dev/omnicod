const SHELL_TIMEOUT_MS = 30_000
const OUTPUT_MAX_CHARS = 50_000

const ENV_WHITELIST = [
  "PATH", "HOME", "USER", "LOGNAME", "LANG", "LC_ALL",
  "TERM", "SHELL", "TMPDIR", "TMP", "TEMP",
]

function filterEnv(env: NodeJS.ProcessEnv): Record<string, string> {
  const result: Record<string, string> = {}
  for (const key of ENV_WHITELIST) {
    if (env[key] !== undefined) result[key] = env[key]!
  }
  return result
}

export interface SandboxResult {
  stdout:   string
  stderr:   string
  exitCode: number
  timedOut: boolean
}

export async function sandboxExec(command: string, workdir: string): Promise<SandboxResult> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), SHELL_TIMEOUT_MS)

  try {
    const proc = Bun.spawn(["bash", "-c", command], {
      cwd:    workdir,
      env:    filterEnv(process.env),
      stdout: "pipe",
      stderr: "pipe",
    })

    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ])

    return {
      stdout:   stdout.slice(0, OUTPUT_MAX_CHARS),
      stderr:   stderr.slice(0, OUTPUT_MAX_CHARS),
      exitCode: exitCode ?? 0,
      timedOut: false,
    }
  } catch (err) {
    if (controller.signal.aborted) {
      return { stdout: "", stderr: `Timeout after ${SHELL_TIMEOUT_MS}ms`, exitCode: 124, timedOut: true }
    }
    throw err
  } finally {
    clearTimeout(timer)
  }
}
