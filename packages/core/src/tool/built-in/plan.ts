import { z } from "zod"
import { ptyManager } from "../../pty/manager.js"
import type { ToolDef, ToolContext, ExecuteResult } from "../types.js"
import { PlanGate } from "../../plan/gate.js"

export const planEnterTool: ToolDef = {
  id: "plan_enter",
  description: `Propose a step-by-step plan to the user and wait for their approval before proceeding.
Use this BEFORE starting any complex or risky task. The user will see each step and can approve, reject, or remove individual steps.
Only execute the steps that were approved. If all steps are rejected, do not proceed.`,
  parameters: z.object({
    title:       z.string().describe("Short title for the plan (e.g. 'Refactor auth module')"),
    description: z.string().optional().describe("Brief summary of what the plan accomplishes"),
    steps:       z.array(z.string()).min(1).max(20).describe("Ordered list of steps to propose"),
  }),
  async execute(args): Promise<ExecuteResult> {
    const id    = crypto.randomUUID()
    const steps = (args["steps"] as string[]).map((text, index) => ({ index, text, approved: true }))

    const decision = await PlanGate.wait({
      id,
      title:       (args["title"] as string) ?? "Proposed Plan",
      description: (args["description"] as string) ?? "",
      steps,
    })

    if (decision.type === "rejected") {
      return { output: "PLAN_REJECTED: The user rejected the plan. Stop here and ask what they would like to do instead." }
    }

    const approved = decision.approvedSteps
    if (approved.length === 0) {
      return { output: "PLAN_REJECTED: The user approved no steps. Do not proceed." }
    }

    const allApproved = approved.length === steps.length
    const summary = allApproved
      ? `PLAN_APPROVED: All ${steps.length} steps approved. Proceed with the plan.`
      : `PLAN_PARTIALLY_APPROVED: Approved steps: ${approved.map(i => i + 1).join(", ")} (${approved.length}/${steps.length}). Only execute those steps.`

    return { output: summary }
  },
}

export const planVerifyTool: ToolDef = {
  id: "plan_verify",
  description: "Verify that a specific step or task in your plan was actually completed successfully. This runs a verification command and ensures the output matches your expectations before you mark a task as 'done'.",
  parameters: z.object({
    taskId: z.string().describe("The ID of the task you are verifying"),
    expectedOutcome: z.string().describe("What exactly are you expecting to see to consider this a success?"),
    verificationCommand: z.string().describe("A bash command to run to verify the outcome (e.g., 'bunx tsc --noEmit' or 'grep something file.ts')"),
  }),
  async execute(args, ctx: ToolContext): Promise<ExecuteResult> {
    const taskId = String(args["taskId"])
    const expectedOutcome = String(args["expectedOutcome"])
    const command = String(args["verificationCommand"])

    let session
    try {
      // Doğrulamalar genellikle sessiz ve hızlı olmalıdır
      session = await ptyManager.create("bash", ["-c", command], ctx.workdir, {})
    } catch (err) {
      return { output: "", error: `Verification process failed to start: ${err instanceof Error ? err.message : String(err)}` }
    }

    const finished = await ptyManager.wait(session.id, 15000) // 15 sn timeout
    ptyManager.cleanup()

    const success = finished.exitCode === 0

    if (success) {
      return {
        output: `VERIFICATION SUCCESS for Task [${taskId}]\nCommand: ${command}\nOutput:\n${finished.outputBuffer.slice(0, 2000)}\n\nYou may now mark the task as done.`
      }
    } else {
      return {
        output: "",
        error: `VERIFICATION FAILED for Task [${taskId}]\nExpected: ${expectedOutcome}\nCommand: ${command}\nExit Code: ${finished.exitCode}\nOutput:\n${finished.outputBuffer.slice(0, 2000)}\n\nDo not mark this task as done. Fix the errors first.`
      }
    }
  }
}
