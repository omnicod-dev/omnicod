export type AutoTrigger = "url" | "file-edit" | "dep-change" | "keyword"

export interface AutoInvokeRule {
  trigger:  AutoTrigger
  match:    string | RegExp
  skillIds: string[]
  priority: number
}

const DEFAULT_RULES: AutoInvokeRule[] = [
  { trigger: "url",       match: /https?:\/\//,         skillIds: ["llm-integration"],                             priority: 10 },
  { trigger: "file-edit", match: /\.(tsx|jsx)$/,        skillIds: ["react-expert"],                                priority: 20 },
  { trigger: "file-edit", match: /auth/i,               skillIds: ["authentication-patterns", "security-review"],  priority: 30 },
  { trigger: "file-edit", match: /\.test\.[tj]sx?$/,   skillIds: ["testing-patterns"],                            priority: 20 },
  { trigger: "file-edit", match: /\.sql$/,              skillIds: ["sql-optimization"],                            priority: 20 },
  { trigger: "file-edit", match: /schema\.[tj]s$/,      skillIds: ["drizzle-orm"],                                 priority: 25 },
  { trigger: "file-edit", match: /Dockerfile$/,         skillIds: ["docker-patterns"],                             priority: 20 },
  { trigger: "file-edit", match: /\.css$/,              skillIds: ["css-architecture"],                            priority: 15 },
  { trigger: "keyword",   match: /security|xss|sql.?inject/i, skillIds: ["security-review"],                      priority: 40 },
]

function testMatch(match: string | RegExp, value: string): boolean {
  if (typeof match === "string") return value.includes(match)
  return match.test(value)
}

class AutoInvoker {
  private customRules: AutoInvokeRule[] = []

  check(trigger: AutoTrigger, value: string): string[] {
    const allRules = [...DEFAULT_RULES, ...this.customRules]
      .filter((r) => r.trigger === trigger)
      .sort((a, b) => b.priority - a.priority)

    const ids = new Set<string>()
    for (const rule of allRules) {
      if (testMatch(rule.match, value)) {
        for (const id of rule.skillIds) ids.add(id)
      }
    }
    return [...ids]
  }

  addRule(rule: AutoInvokeRule): void {
    this.customRules.push(rule)
  }

  listRules(): AutoInvokeRule[] {
    return [...DEFAULT_RULES, ...this.customRules]
  }
}

export const autoInvoker = new AutoInvoker()
