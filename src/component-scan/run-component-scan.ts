import { relative, sep } from "node:path";
import ts from "typescript";
import { ComponentScanError } from "../errors/component-scan-error.js";
import type {
  ComponentAnalysisStatus,
  ComponentExportKind,
  ComponentProp,
  ComponentScanDiagnostic,
  ComponentScanIndex,
  DiscoveredComponent,
} from "../types/component-scan.js";
import { findSourceFiles } from "./find-source-files.js";

interface ExportCandidate {
  readonly declaration: ts.Declaration;
  readonly exportName: string;
  readonly exportKind: ComponentExportKind;
  readonly name: string;
}

/** Discover exported React components and their statically analyzable props. */
export function runComponentScan(projectRoot: string): ComponentScanIndex {
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
  const components: DiscoveredComponent[] = [];
  const diagnostics: ComponentScanDiagnostic[] = [];
  const sourceFileSet = new Set(sourceFiles);

  for (const sourceFile of program.getSourceFiles()) {
    if (sourceFile.isDeclarationFile || !sourceFiles.includes(sourceFile.fileName)) {
      continue;
    }

    for (const candidate of collectExportCandidates(sourceFile, checker, sourceFileSet)) {
      const source = toPortablePath(relative(projectRoot, candidate.declaration.getSourceFile().fileName));
      const result = analyzeCandidate(candidate, source, checker);
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
): { readonly component: DiscoveredComponent } | { readonly diagnostic: ComponentScanDiagnostic } {
  if (!isReactComponentDeclaration(candidate.declaration)) {
    return {
      diagnostic: {
        source,
        exportName: candidate.exportName,
        message: "Export could not be confirmed as a React component by static analysis.",
      },
    };
  }

  const propResult = extractProps(candidate.declaration, checker);
  return {
    component: {
      id: `${source}#${candidate.exportName}`,
      source,
      exportName: candidate.exportName,
      name: candidate.name,
      exportKind: candidate.exportKind,
      props: propResult.props,
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

function extractProps(
  declaration: ts.Declaration,
  checker: ts.TypeChecker,
): {
  readonly props: readonly ComponentProp[];
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
  const props = checker.getPropertiesOfType(type).map((property) => {
    const location = property.valueDeclaration ?? property.declarations?.[0] ?? propsTypeNode;
    return {
      name: property.getName(),
      type: checker.typeToString(checker.getTypeOfSymbolAtLocation(property, location)),
      required: (property.flags & ts.SymbolFlags.Optional) === 0,
    };
  }).sort((left, right) => compareText(left.name, right.name));

  return { props, status: "complete", diagnostics: [] };
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

function compareComponents(left: DiscoveredComponent, right: DiscoveredComponent): number {
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
