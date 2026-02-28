import type { PeerGraph, PeerConflict } from "../../../types/index.js";
import { satisfies } from "../../../utils/semver.js";
import { classifyConflict } from "./conflict.js";

/**
 * Resolves peer conflicts in the given PeerGraph.
 *
 * Algorithm: single-pass BFS over the graph.
 *   For each node N that has peer requirements:
 *     For each (peerName, requiredRange) in N.peerRequirements:
 *       1. Look up peerName in the graph (the resolved version we have)
 *       2. Call satisfies(resolvedVersion, requiredRange)
 *       3. If not satisfied → conflict
 *
 * Complexity: O(n × max_peers_per_package) — effectively O(n) since
 * peerDependencies counts are always small (< 10 in practice).
 *
 * Returns an array of conflicts sorted by severity (errors first) then by name.
 */
export function resolvePeerConflicts(graph: PeerGraph): PeerConflict[] {
  const conflicts: PeerConflict[] = [];
  const queue = [...graph.roots];
  const visited = new Set<string>();

  // BFS traversal so we process in dependency order (roots first)
  while (queue.length > 0) {
    const name = queue.shift()!;
    if (visited.has(name)) continue;
    visited.add(name);

    const node = graph.nodes.get(name);
    if (!node) {
      // Queue children: any node that references `name` as a peer
      // (they will be checked when processed)
      continue;
    }

    for (const [peerName, requiredRange] of node.peerRequirements) {
      const peerNode = graph.nodes.get(peerName);

      if (!peerNode) {
        // Package not in the dependency tree at all → hard error
        conflicts.push(
          classifyConflict({
            requester: name,
            peer: peerName,
            requiredRange,
            resolvedVersion: "(not installed)",
            isInstalled: false,
          }),
        );
        continue;
      }

      const peerVersion = peerNode.resolvedVersion;
      const satisfied = satisfies(peerVersion, requiredRange);

      if (!satisfied) {
        conflicts.push(
          classifyConflict({
            requester: name,
            peer: peerName,
            requiredRange,
            resolvedVersion: peerVersion,
            isInstalled: true,
          }),
        );
      }

      // Always enqueue the peer for processing
      if (!visited.has(peerName)) {
        queue.push(peerName);
      }
    }
  }

  // Sort: errors first, then warnings; within category sort by requester name
  return conflicts.sort((a, b) => {
    if (a.severity !== b.severity) {
      return a.severity === "error" ? -1 : 1;
    }
    return a.requester.localeCompare(b.requester);
  });
}
