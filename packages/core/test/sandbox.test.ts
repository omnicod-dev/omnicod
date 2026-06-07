import { describe, it, expect } from "bun:test"
import { shouldUseSandbox } from "../src/terminal/sandbox.js"
import { classifyCommand }  from "../src/terminal/classifier.js"

function analysis(cmd: string) {
  return classifyCommand(cmd)
}

describe("shouldUseSandbox", () => {
  it("ls does NOT need sandbox", () => {
    expect(shouldUseSandbox("ls -la", analysis("ls -la"))).toBe(false)
  })

  it("cat does NOT need sandbox", () => {
    expect(shouldUseSandbox("cat file.txt", analysis("cat file.txt"))).toBe(false)
  })

  it("git status does NOT need sandbox", () => {
    expect(shouldUseSandbox("git status", analysis("git status"))).toBe(false)
  })

  it("node script.js NEEDS sandbox", () => {
    expect(shouldUseSandbox("node script.js", analysis("node script.js"))).toBe(true)
  })

  it("python main.py NEEDS sandbox", () => {
    expect(shouldUseSandbox("python main.py", analysis("python main.py"))).toBe(true)
  })

  it("python3 main.py NEEDS sandbox", () => {
    expect(shouldUseSandbox("python3 app.py", analysis("python3 app.py"))).toBe(true)
  })

  it("ruby script.rb NEEDS sandbox", () => {
    expect(shouldUseSandbox("ruby script.rb", analysis("ruby script.rb"))).toBe(true)
  })

  it("bash script NEEDS sandbox", () => {
    expect(shouldUseSandbox("bash deploy.sh", analysis("bash deploy.sh"))).toBe(true)
  })

  it("sh -c command NEEDS sandbox", () => {
    expect(shouldUseSandbox("sh -c 'echo hi'", analysis("sh -c 'echo hi'"))).toBe(true)
  })

  it("bun run (not node/python) does NOT need sandbox by default", () => {
    // bun run is a script runner, not in the risky set
    expect(shouldUseSandbox("bun run test", analysis("bun run test"))).toBe(false)
  })

  it("tsc --noEmit does NOT need sandbox", () => {
    expect(shouldUseSandbox("tsc --noEmit", analysis("tsc --noEmit"))).toBe(false)
  })
})
