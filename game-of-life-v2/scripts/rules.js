// Rule parsing and application (B/S notation).

import { RULESETS } from "./constants.js";
import { state, els } from "./state.js";
import { showToast } from "./ui.js";

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

export function applyRule(ruleString, announce = false) {
  const compiled = compileRule(ruleString);
  if (!compiled) {
    showToast("Invalid rule. Use B/S notation like B3/S23.");
    els.ruleInput.value = state.rule;
    return false;
  }
  state.rule = compiled.rule;
  state.rules = compiled;
  els.ruleInput.value = state.rule;
  const preset = RULESETS.find((item) => item.rule === state.rule);
  els.rulesetSelect.value = preset ? preset.rule : "custom";
  els.exportNote.textContent = `Exports use ${state.rule}.`;
  if (announce) showToast(`Ruleset set to ${state.rule}`);
  return true;
}

export function getRuleLabel() {
  const preset = RULESETS.find((item) => item.rule === state.rule);
  return preset ? preset.label : state.rule;
}
