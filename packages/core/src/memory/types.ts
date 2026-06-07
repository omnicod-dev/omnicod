export type Category = "preference" | "project" | "fact" | "decision" | "pattern"
export type Scope    = "global" | "project"
export type Source   = "auto" | "manual" | "tool"

export interface Memory {
  id:        string
  content:   string
  category:  Category
  scope:     Scope
  project?:  string | undefined
  timestamp: number
  source:    Source
  tags?:     string[] | undefined
}
