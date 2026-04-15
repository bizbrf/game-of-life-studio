// Rule parsing and application (B/S notation).

import { RULESETS } from "./constants.js";
import { state } from "./state.js";

export function compileRule(ruleString) {
  const match = /^B([0-8]*)\/S([0-8]*)$/i.exec(ruleString.trim());
  if (!match) return null;
  return {
    rule: `B${[...new Set(match[1].split(""))].sort().join("")}/S${[...new Set(match[2].split(""))].sort().join("")}`,
    birth: new Set(match[1].split("").filter(Boolean).map(Number)),
    survive: new Set(match[2].split("").filter(Boolean).map(Number)),
  };
}

export function canonicalizeRule(ruleString) {
  const compiled = compileRule(ruleString);
  return compiled ? compiled.rule : null;
}

// Applies a rule string to state. Returns a result; callers (app.js / ui.js)
// surface toasts and sync DOM via updateUI(). Keeping DOM out of rules.js
// keeps the module dependency-direction-clean.
export function applyRule(ruleString) {
  const compiled = compileRule(ruleString);
  if (!compiled) {
    return { success: false, message: "Invalid rule. Use B/S notation like B3/S23." };
  }
  state.rule = compiled.rule;
  state.rules = compiled;
  return { success: true, rule: compiled.rule };
}

export function getRuleLabel() {
  const preset = RULESETS.find((item) => item.rule === state.rule);
  return preset ? preset.label : state.rule;
}
