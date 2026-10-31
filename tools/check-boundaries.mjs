import { readdirSync, readFileSync } from 'node:fs'
import { dirname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const slash = value => value.replaceAll('\\', '/')

export function boundaryViolation(from, to) {
  const source = from.split('/')
  const target = to.split('/')
  if (source[1] === 'shared' && ['features', 'app'].includes(target[1]))
    return 'Shared code must not depend on app or business features.'
  if (source[1] === 'features' && target[1] === 'app')
    return 'Features must not depend on app composition.'
  if (source[1] === 'features' && target[1] === 'features' && source[2] !== target[2]) {
    if (target.length > 4 || /-page\.[tj]sx?$/.test(target[3]))
      return 'Use a public feature-root entry, not another feature\'s private implementation or page.'
  }
  return null
}

export function moduleImports(source, file) {
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true)
  const imports = []
  const visit = node => {
    let specifier, typeOnly = false
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier) {
      specifier = node.moduleSpecifier
      typeOnly = !!node.isTypeOnly || !!node.importClause?.isTypeOnly
      const bindings = ts.isExportDeclaration(node) ? node.exportClause : node.importClause?.namedBindings
      if (!node.importClause?.name && bindings && (ts.isNamedImports(bindings) || ts.isNamedExports(bindings)))
        typeOnly ||= bindings.elements.length > 0 && bindings.elements.every(item => item.isTypeOnly)
    } else if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      specifier = node.arguments[0]
    } else if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument)) {
      specifier = node.argument.literal
      typeOnly = true
    }
    if (specifier && ts.isStringLiteralLike(specifier)) imports.push({
      specifier: specifier.text, typeOnly,
      line: ast.getLineAndCharacterOfPosition(node.getStart(ast)).line + 1,
    })
    ts.forEachChild(node, visit)
  }
  visit(ast)
  return imports
}

export function runtimeCycles(graph) {
  const complete = new Set(), active = new Map(), path = [], cycles = []
  function visit(file) {
    if (active.has(file)) { cycles.push([...path.slice(active.get(file)), file]); return }
    if (complete.has(file)) return
    active.set(file, path.length)
    path.push(file)
    for (const target of graph.get(file) ?? []) if (graph.has(target)) visit(target)
    path.pop()
    active.delete(file)
    complete.add(file)
  }
  for (const file of graph.keys()) visit(file)
  return cycles
}

export function auditBoundaries(root) {
  const sourceRoot = resolve(root, 'src'), files = []
  function walk(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const file = resolve(directory, entry.name)
      if (entry.isDirectory()) walk(file)
      else if (/\.[tj]sx?$/.test(entry.name) && !entry.name.endsWith('.d.ts')) files.push(file)
    }
  }
  walk(sourceRoot)
  const raw = ts.readConfigFile(resolve(root, 'tsconfig.app.json'), ts.sys.readFile)
  if (raw.error) throw new Error('Cannot read the frontend TypeScript configuration.')
  const config = ts.parseJsonConfigFileContent(raw.config, ts.sys, root)
  if (config.errors.length) throw new Error('Invalid frontend TypeScript configuration.')
  const cache = ts.createModuleResolutionCache(root, value => value, config.options)
  const local = file => slash(relative(root, file))
  const graph = new Map(), violations = []
  for (const file of files) {
    const from = local(file), edges = new Set()
    graph.set(from, edges)
    for (const item of moduleImports(readFileSync(file, 'utf8'), file)) {
      const target = ts.resolveModuleName(item.specifier, file, config.options, ts.sys, cache).resolvedModule?.resolvedFileName
      if (!target) continue // TypeScript validates unresolved source imports; asset imports have no module edge.
      const to = local(target)
      if (!to.startsWith('src/')) continue
      const error = boundaryViolation(from, to)
      if (error) violations.push(`${from}:${item.line}: ${error} (${to})`)
      if (!item.typeOnly) edges.add(to)
    }
  }
  for (const cycle of runtimeCycles(graph)) violations.push('Runtime import cycle: ' + cycle.join(' -> '))
  return { files: files.length, violations }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = auditBoundaries(resolve(dirname(fileURLToPath(import.meta.url)), '..'))
  if (result.violations.length) {
    console.error(result.violations.join('\n'))
    process.exitCode = 1
  } else console.log(`Source boundaries passed (${result.files} files).`)
}
