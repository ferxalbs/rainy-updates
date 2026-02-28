import { randomUUID } from "node:crypto";
import path from "node:path";
import type {
  PackageLicense,
  SbomDocument,
  SbomPackage,
  SbomRelationship,
} from "../../types/index.js";

/**
 * Generates an SPDX 2.3 compliant SBOM JSON document from a list of
 * scanned package licenses.
 *
 * SPDX 2.3 spec: https://spdx.github.io/spdx-spec/v2.3/
 * Required by: CISA SBOM mandate, EU Cyber Resilience Act, many enterprise
 * security standards.
 */
export function generateSbom(
  packages: PackageLicense[],
  projectName: string,
): SbomDocument {
  const docId = `SPDXRef-DOCUMENT`;
  const rootId = `SPDXRef-Package-root`;
  const timestamp = new Date().toISOString();
  const namespace = `https://spdx.org/spdxdocs/${encodeURIComponent(path.basename(projectName))}-${randomUUID()}`;

  const spdxPackages: SbomPackage[] = [
    // Root package entry
    {
      SPDXID: rootId,
      name: path.basename(projectName),
      versionInfo: "NOASSERTION",
      downloadLocation: "NOASSERTION",
      licenseConcluded: "NOASSERTION",
      licenseDeclared: "NOASSERTION",
      copyrightText: "NOASSERTION",
    },
    // One entry per dependency
    ...packages.map((pkg) => ({
      SPDXID: toSpdxId(pkg.name, pkg.version),
      name: pkg.name,
      versionInfo: pkg.version,
      downloadLocation: pkg.repository
        ? normalizeRepoUrl(pkg.repository)
        : `https://www.npmjs.com/package/${encodeURIComponent(pkg.name)}`,
      licenseConcluded: pkg.spdxExpression ?? "NOASSERTION",
      licenseDeclared: pkg.spdxExpression ?? "NOASSERTION",
      copyrightText: "NOASSERTION",
    })),
  ];

  const relationships: SbomRelationship[] = [
    {
      spdxElementId: docId,
      relationshipType: "DESCRIBES",
      relatedSpdxElement: rootId,
    },
    ...packages.map((pkg) => ({
      spdxElementId: rootId,
      relationshipType: "DEPENDS_ON" as const,
      relatedSpdxElement: toSpdxId(pkg.name, pkg.version),
    })),
  ];

  return {
    spdxVersion: "SPDX-2.3",
    dataLicense: "CC0-1.0",
    name: `SBOM for ${path.basename(projectName)}`,
    documentNamespace: namespace,
    packages: spdxPackages,
    relationships,
  };
}

/** Converts a package name + version to a valid SPDX ID. */
function toSpdxId(name: string, version: string): string {
  const safe = `${name}-${version}`.replace(/[^a-zA-Z0-9-.]/g, "-");
  return `SPDXRef-Package-${safe}`;
}

/** Normalize various repository URL formats to a clean string. */
function normalizeRepoUrl(raw: string): string {
  // git+https://... or git://...
  return raw.replace(/^git\+/, "").replace(/\.git$/, "");
}
