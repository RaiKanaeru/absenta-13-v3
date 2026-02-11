import { spawnSync } from "node:child_process"
import { tool } from "@opencode-ai/plugin"

const PROFILES = {
  quick: [
    ["npm", ["run", "lint"]],
    ["npm", ["run", "build"]],
  ],
  full: [
    ["npm", ["run", "lint"]],
    ["npm", ["test"]],
    ["npm", ["run", "build"]],
  ],
  backend: [["npm", ["run", "test:server"]]],
}

function run(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    shell: process.platform === "win32",
    timeout: 600000,
    maxBuffer: 10 * 1024 * 1024,
  })

  const stdout = (result.stdout || "").trim()
  const stderr = (result.stderr || "").trim()
  const output = [stdout, stderr].filter(Boolean).join("\n")

  if (result.error) {
    throw new Error(`${command} ${args.join(" ")} failed: ${result.error.message}`)
  }

  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} exited with code ${result.status}\n${output}`)
  }

  return output || "(no output)"
}

export default tool({
  description: "Run standard Absenta13 verification command sets.",
  args: tool.schema.object({
    profile: tool.schema.enum(["quick", "full", "backend"]).default("quick"),
  }),
  async execute({ profile }, context) {
    const steps = PROFILES[profile]
    const sections = []

    for (const [command, args] of steps) {
      const output = run(command, args, context.directory)
      sections.push(`$ ${command} ${args.join(" ")}\n${output}`)
    }

    return sections.join("\n\n")
  },
})
