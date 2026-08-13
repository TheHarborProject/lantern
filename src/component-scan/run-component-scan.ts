import { relative, sep } from "node:path";
import ts from "typescript";
import { ComponentScanError } from "../errors/component-scan-error.js";
import type {
  CanonicalComponent,
  CanonicalComponentModel,
  ComponentAnalysisStatus,
  ComponentExportKind,
  ComponentScanDiagnostic,
  ResolvedComponentProp,
} from "../types/component-scan.js";
import { findSourceFiles } from "./find-source-files.js";

interface ExportCandidate {
  readonly declaration: ts.Declaration;
  readonly exportName: string;
  readonly exportKind: ComponentExportKind;
  readonly name: string;
}

/**
 * Discover exported React components and build the single canonical model that
 * every projection is derived from. Props are resolved exhaustively and tagged
 * with provenance so consumers can separate component-owned props from
 * inherited/resolved DOM and React props.
 */
export function runComponentScan(projectRoot: string): CanonicalComponentModel {
  let sourceFiles: string[];
  try {
    sourceFiles = findSourceFiles(projectRoot);
  } catch (cause) {
    throw new ComponentScanError(`Could not scan component sources in ${projectRoot}`, { cause });
  }

  const program = ts.createProgram(sourceFiles, {
    allowJs: false,
    jsx: ts.JsxEmit.ReactJSX,
    module: ts.ModuleKind.NodeNext,
    moduleResolution: ts.ModuleResolutionKind.NodeNext,
    noEmit: true,
    skipLibCheck: true,
    strict: true,
    target: ts.ScriptTarget.ES2022,
  });
  const checker = program.getTypeChecker();
  const components: CanonicalComponent[] = [];
  const diagnostics: ComponentScanDiagnostic[] = [];
  const sourceFileSet = new Set(sourceFiles);

  for (const sourceFile of program.getSourceFiles()) {
    if (sourceFile.isDeclarationFile || !sourceFiles.includes(sourceFile.fileName)) {
      continue;
    }

    for (const candidate of collectExportCandidates(sourceFile, checker, sourceFileSet)) {
      const source = toPortablePath(relative(projectRoot, candidate.declaration.getSourceFile().fileName));
      const result = analyzeCandidate(candidate, source, checker, sourceFileSet, projectRoot);
      if ("component" in result) {
        components.push(result.component);
      } else {
        diagnostics.push(result.diagnostic);
      }
    }
  }

  return {
    version: 1,
    components: uniqueBy(components, (component) => component.id).sort(compareComponents),
    diagnostics: uniqueBy(
      diagnostics,
      (diagnostic) => `${diagnostic.source}#${diagnostic.exportName}#${diagnostic.message}`,
    ).sort(compareDiagnostics),
  };
}

function collectExportCandidates(
  sourceFile: ts.SourceFile,
  checker: ts.TypeChecker,
  sourceFiles: ReadonlySet<string>,
): ExportCandidate[] {
  const moduleSymbol = checker.getSymbolAtLocation(sourceFile);
  if (moduleSymbol === undefined) {
    return [];
  }

  const candidates: ExportCandidate[] = [];
  for (const exportedSymbol of checker.getExportsOfModule(moduleSymbol)) {
    const exportName = exportedSymbol.getName();
    const target = exportedSymbol.flags & ts.SymbolFlags.Alias
      ? checker.getAliasedSymbol(exportedSymbol)
      : exportedSymbol;
    if ((target.flags & ts.SymbolFlags.Value) === 0) {
      continue;
    }
    const declaration = target.valueDeclaration ?? target.declarations?.[0];
    if (declaration === undefined || !sourceFiles.has(declaration.getSourceFile().fileName)) {
      continue;
    }

    const inferredName = inferComponentName(declaration, sourceFile, exportName);
    if (exportName !== "default" && !isPascalCase(exportName)) {
      continue;
    }

    candidates.push({
      declaration,
      exportName,
      exportKind: exportName === "default" ? "default" : "named",
      name: inferredName,
    });
  }
  return candidates.sort((left, right) => compareText(left.exportName, right.exportName));
}

function analyzeCandidate(
  candidate: ExportCandidate,
  source: string,
  checker: ts.TypeChecker,
  sourceFiles: ReadonlySet<string>,
  projectRoot: string,
): { readonly component: CanonicalComponent } | { readonly diagnostic: ComponentScanDiagnostic } {
  if (!isReactComponentDeclaration(candidate.declaration)) {
    return {
      diagnostic: {
        source,
        exportName: candidate.exportName,
        message: "Export could not be confirmed as a React component by static analysis.",
      },
    };
  }

  const propResult = extractProps(candidate.declaration, checker, sourceFiles, projectRoot);
  const intrinsicElements = collectIntrinsicElements(candidate.declaration);
  return {
    component: {
      id: `${source}#${candidate.exportName}`,
      source,
      exportName: candidate.exportName,
      name: candidate.name,
      exportKind: candidate.exportKind,
      props: propResult.props,
      rendering: {
        intrinsicElements,
        analyzable: intrinsicElements.length > 0,
      },
      analysis: {
        status: propResult.status,
        diagnostics: propResult.diagnostics,
      },
    },
  };
}

function isReactComponentDeclaration(declaration: ts.Declaration): boolean {
  if (ts.isFunctionDeclaration(declaration)) {
    return containsJsx(declaration.body);
  }
  if (ts.isVariableDeclaration(declaration)) {
    return declaration.initializer !== undefined && containsJsx(declaration.initializer);
  }
  if (ts.isClassDeclaration(declaration)) {
    return declaration.members.some(
      (member) => ts.isMethodDeclaration(member) && member.name.getText() === "render" && containsJsx(member.body),
    );
  }
  if (ts.isExportAssignment(declaration)) {
    return containsJsx(declaration.expression);
  }
  return false;
}

function containsJsx(node: ts.Node | undefined): boolean {
  if (node === undefined) {
    return false;
  }
  if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node) || ts.isJsxFragment(node)) {
    return true;
  }
  let found = false;
  node.forEachChild((child) => {
    if (!found && containsJsx(child)) {
      found = true;
    }
  });
  return found;
}

/** Collect sorted, unique lowercase intrinsic JSX element tag names. */
function collectIntrinsicElements(declaration: ts.Declaration): string[] {
  const names = new Set<string>();
  const visit = (node: ts.Node): void => {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tag = node.tagName.getText();
      if (/^[a-z]/.test(tag)) {
        names.add(tag);
      }
    }
    node.forEachChild(visit);
  };
  visit(declaration);
  return [...names].sort(compareText);
}

function extractProps(
  declaration: ts.Declaration,
  checker: ts.TypeChecker,
  sourceFiles: ReadonlySet<string>,
  projectRoot: string,
): {
  readonly props: readonly ResolvedComponentProp[];
  readonly status: ComponentAnalysisStatus;
  readonly diagnostics: readonly string[];
} {
  const parameter = getPropsParameter(declaration);
  const classPropsType = getClassPropsTypeNode(declaration);
  if (parameter === undefined && classPropsType === undefined) {
    return { props: [], status: "complete", diagnostics: [] };
  }
  const propsTypeNode = parameter?.type ?? classPropsType;
  if (propsTypeNode === undefined) {
    return {
      props: [],
      status: "partial",
      diagnostics: ["Props parameter has no analyzable TypeScript annotation."],
    };
  }

  const type = checker.getTypeAtLocation(propsTypeNode);
  const props = checker.getPropertiesOfType(type).map((property): ResolvedComponentProp => {
    const declarationNode = property.valueDeclaration ?? property.declarations?.[0];
    const location = declarationNode ?? propsTypeNode;
    const declarationFile = declarationNode?.getSourceFile().fileName;
    return {
      name: property.getName(),
      type: checker.typeToString(checker.getTypeOfSymbolAtLocation(property, location)),
      required: (property.flags & ts.SymbolFlags.Optional) === 0,
      origin: declarationFile !== undefined && sourceFiles.has(declarationFile) ? "declared" : "inherited",
      provenance: describeProvenance(declarationFile, propsTypeNode.getSourceFile().fileName, projectRoot),
    };
  }).sort((left, right) => compareText(left.name, right.name));

  return { props, status: "complete", diagnostics: [] };
}

/**
 * Describe where a prop declaration lives in a machine-stable, portable way:
 * a project-relative path for owned sources, a `node_modules`-relative hint or
 * lib basename for inherited declarations.
 */
function describeProvenance(
  declarationFile: string | undefined,
  fallbackFile: string,
  projectRoot: string,
): string {
  const file = declarationFile ?? fallbackFile;
  const portable = toPortablePath(file);
  const moduleMarker = "/node_modules/";
  const moduleIndex = portable.lastIndexOf(moduleMarker);
  if (moduleIndex !== -1) {
    return portable.slice(moduleIndex + moduleMarker.length);
  }
  const relativePath = toPortablePath(relative(projectRoot, file));
  if (relativePath === "" || relativePath.startsWith("..")) {
    return portable.split("/").at(-1) ?? portable;
  }
  return relativePath;
}

function getPropsParameter(declaration: ts.Declaration): ts.ParameterDeclaration | undefined {
  if (ts.isFunctionDeclaration(declaration)) {
    return declaration.parameters[0];
  }
  if (ts.isVariableDeclaration(declaration)) {
    return getFunctionLikeInitializer(declaration.initializer)?.parameters[0];
  }
  if (ts.isExportAssignment(declaration)) {
    return getFunctionLikeInitializer(declaration.expression)?.parameters[0];
  }
  return undefined;
}

function getClassPropsTypeNode(declaration: ts.Declaration): ts.TypeNode | undefined {
  if (!ts.isClassDeclaration(declaration)) {
    return undefined;
  }
  const componentHeritage = declaration.heritageClauses
    ?.flatMap((clause) => clause.types)
    .find((type) => /(?:Component|PureComponent)$/.test(type.expression.getText()));
  return componentHeritage?.typeArguments?.[0];
}

function getFunctionLikeInitializer(
  expression: ts.Expression | undefined,
): ts.ArrowFunction | ts.FunctionExpression | undefined {
  if (expression === undefined) {
    return undefined;
  }
  if (ts.isArrowFunction(expression) || ts.isFunctionExpression(expression)) {
    return expression;
  }
  if (ts.isCallExpression(expression)) {
    for (const argument of expression.arguments) {
      const nested = getFunctionLikeInitializer(argument);
      if (nested !== undefined) {
        return nested;
      }
    }
  }
  return undefined;
}

function inferComponentName(
  declaration: ts.Declaration,
  sourceFile: ts.SourceFile,
  exportName: string,
): string {
  if (exportName !== "default") {
    return exportName;
  }
  if ((ts.isFunctionDeclaration(declaration) || ts.isClassDeclaration(declaration)) && declaration.name !== undefined) {
    return declaration.name.text;
  }
  if (ts.isVariableDeclaration(declaration) && ts.isIdentifier(declaration.name)) {
    return declaration.name.text;
  }
  return sourceFile.fileName.split(/[\\/]/).at(-1)?.replace(/\.[^.]+$/, "") ?? "DefaultComponent";
}

function isPascalCase(value: string): boolean {
  return /^[A-Z][A-Za-z0-9]*$/.test(value);
}

function toPortablePath(path: string): string {
  return path.split(sep).join("/");
}

function compareComponents(left: CanonicalComponent, right: CanonicalComponent): number {
  return compareText(left.id, right.id);
}

function compareDiagnostics(left: ComponentScanDiagnostic, right: ComponentScanDiagnostic): number {
  return compareText(`${left.source}#${left.exportName}`, `${right.source}#${right.exportName}`);
}

function uniqueBy<T>(items: readonly T[], key: (item: T) => string): T[] {
  return [...new Map(items.map((item) => [key(item), item])).values()];
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
