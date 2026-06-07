export type CommandSecurityLevel = "safe" | "warning" | "danger"

export interface CommandAnalysis {
  isReadOnly: boolean
  level: CommandSecurityLevel
  reason: string
  parsedExecutables: string[]
}

// Güvenli (Salt-Okunur) komutların beyaz listesi
const READ_ONLY_COMMANDS = new Set([
  "ls", "cat", "grep", "find", "pwd", "echo", "head", "tail", "less", "more", 
  "wc", "stat", "file", "which", "whereis", "whoami", "date", "cal", "uptime",
  "df", "du", "free", "top", "htop", "ps", "history", "git status", "git log", 
  "git diff", "git show", "git branch", "tsc"
])

// Yıkıcı / Tehlikeli komutların kara listesi
const DESTRUCTIVE_COMMANDS = new Set([
  "rm", "mkfs", "dd", "fdisk", "mkswap", "format", "shutdown", "reboot", "halt",
  "poweroff", "init", "kill", "killall", "pkill", "su", "sudo", "chown", "chmod",
  "iptables", "ufw", "mv", "cp" // mv ve cp duruma göre tehlikeli olabilir
])

/**
 * Verilen Bash komutunu parçalar (;, &&, ||, | kullanarak)
 * ve her bir komut parçacığının (executable) güvenliğini analiz eder.
 */
export function classifyCommand(commandLine: string): CommandAnalysis {
  if (!commandLine || commandLine.trim() === "") {
    return { isReadOnly: true, level: "safe", reason: "Empty command", parsedExecutables: [] }
  }

  // Komutları ayırıcı operatörlere göre böl (|, ;, &&, ||)
  const segments = commandLine.split(/\||;|&&|\|\|/).map(s => s.trim()).filter(s => s.length > 0)
  
  const executables: string[] = []
  let isDanger = false
  let dangerReason = ""
  let allReadOnly = true

  for (const segment of segments) {
    // Çift tırnak vb. basit sanitize işlemleri
    const tokens = segment.split(/\s+/)
    if (tokens.length === 0) continue

    let exec = tokens[0] ?? ""

    // sudo kontrolü
    if (exec === "sudo" && tokens.length > 1) {
      isDanger = true
      dangerReason = "Sudo usage detected"
      exec = tokens[1] ?? "" // asıl komuta bak
    }

    // git gibi alt komutu olanları kontrol et (örn: git status)
    let fullExec = exec
    if (exec === "git" && tokens.length > 1) {
      fullExec = `git ${tokens[1] ?? ""}`
    }

    // bunx, npx gibi prefixleri atla
    if ((exec === "bunx" || exec === "npx" || exec === "bun" || exec === "npm" || exec === "yarn") && tokens.length > 1) {
      if (exec === "bun" && tokens[1] === "run") {
        fullExec = `bun run` // script çalıştırıyor, read-only sayılamaz
      } else {
        fullExec = tokens[1] ?? ""
      }
    }

    executables.push(fullExec)

    // Analiz
    if (DESTRUCTIVE_COMMANDS.has(exec)) {
      isDanger = true
      dangerReason = `Destructive command detected: ${exec}`
    }
    
    // rm -rf gibi riskli argüman analizi
    if (exec === "rm" && tokens.includes("-rf")) {
      isDanger = true
      dangerReason = "Destructive recursive remove (rm -rf) detected!"
    }

    if (!READ_ONLY_COMMANDS.has(fullExec) && !READ_ONLY_COMMANDS.has(exec)) {
      allReadOnly = false
    }
  }

  if (isDanger) {
    return {
      isReadOnly: false,
      level: "danger",
      reason: dangerReason,
      parsedExecutables: executables
    }
  }

  if (allReadOnly) {
    return {
      isReadOnly: true,
      level: "safe",
      reason: "All segments are read-only commands",
      parsedExecutables: executables
    }
  }

  return {
    isReadOnly: false,
    level: "warning",
    reason: "Command is mutating but not explicitly destructive",
    parsedExecutables: executables
  }
}
