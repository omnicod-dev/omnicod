import { spawn } from "bun"
import type { CommandAnalysis } from "./classifier.js"
import { ptyManager } from "../pty/manager.js"

export interface SandboxConfig {
  image?: string // Varsayılan: node:20-bullseye
  network?: boolean // Varsayılan: true
}

/**
 * Komutun izole bir Docker sandbox'ında çalıştırılıp çalıştırılmayacağına karar verir.
 */
export function shouldUseSandbox(command: string, analysis: CommandAnalysis): boolean {
  const { parsedExecutables } = analysis

  // Çok açık yıkıcı komutları Sandbox içinde izole etmeye çalış, 
  // ama rm -rf /workspace dahi tehlikeli olabilir.
  // Biz genellikle bilinmeyen/untrusted script yürütmelerini sandbox'a atarız:
  const riskyExecutables = new Set(["node", "python", "python3", "ruby", "perl", "sh", "bash"])
  
  // npm install, pip install gibi dış ağdan inen kodları çalıştıranları yakala
  if (parsedExecutables.includes("npm install") || parsedExecutables.includes("yarn install") || parsedExecutables.includes("pip install")) {
    return true
  }

  // Node veya Python ile çalıştırılan her türlü lokal script untrusted kabul edilebilir.
  for (const exec of parsedExecutables) {
    if (riskyExecutables.has(exec)) {
      return true
    }
  }

  return false
}

/**
 * Verilen komutu geçici bir Docker container'ı içinde (sandbox) başlatır.
 * PTY Session döndürür.
 */
export async function startSandboxedProcess(
  command: string,
  args: string[],
  workdir: string,
  env?: Record<string, string>,
  config?: SandboxConfig
) {
  const image = config?.image || "node:20-slim"
  const netFlag = config?.network === false ? "--network=none" : ""

  // Environment variable'ları docker -e formatına çevir
  const envArgs: string[] = []
  if (env) {
    for (const [k, v] of Object.entries(env)) {
      envArgs.push("-e", `${k}=${v}`)
    }
  }

  // Docker command: docker run --rm -i -v <workdir>:/workspace -w /workspace <env> <image> <command> <args>
  const dockerArgs = [
    "run", "--rm", "-i",
    "-v", `${workdir}:/workspace`,
    "-w", "/workspace",
    ...envArgs
  ]

  if (netFlag) {
    dockerArgs.push(netFlag)
  }

  dockerArgs.push(image)

  // Asıl komut ve argümanlar
  dockerArgs.push(command, ...args)

  // Bunu normal ptyManager üzerinden Docker çalıştıracak şekilde sarmalıyoruz
  return ptyManager.create("docker", dockerArgs, workdir, {})
}
