# Steps

These are steps for my [meetup talk](https://www.meetup.com/TypeScriptNYC/events/255170060/). Code in this repo after each step is committed at a tag listed beside the step (see [tags](https://github.com/ashfurrow/tsnyc-tslint-rules/tags)).

## Create Project ([`step-1`](https://github.com/ashfurrow/tsnyc-tslint-rules/tree/step-1))

```sh
yo artsy
```

And follow the prompts.

## Create basic rule ([`step-2`](https://github.com/ashfurrow/tsnyc-tslint-rules/tree/step-2))

Update `lint` script to use `ts-node`:

```diff
diff --git a/package.json b/package.json
index 5eb6e8b..77a0324 100755
--- a/package.json
+++ b/package.json
@@ -23,7 +23,7 @@
   "scripts": {
     "type-check": "tsc --noEmit",
     "build": "tsc",
-    "lint": "tslint 'src/**/*.{ts,tsx}'",
+    "lint": "node -r ts-node/register node_modules/.bin/tslint 'src/**/*.{ts,tsx}'",
     "release": "release-it"
   },
   "jest": {
```

Next we'll create a directory for our custom rules and create the first file for our custom rules. TSLint requires you to adhere to [its filename conventions](https://palantir.github.io/tslint/develop/custom-rules/).

```sh
mkdir tslint
touch tslint/noBadWordsRule.ts
```

And update the `tslint.json` config for TSLint to use the new rule, in the new directory:

```diff
diff --git a/tslint.json b/tslint.json
index b946fbc..a28eb9f 100755
--- a/tslint.json
+++ b/tslint.json
@@ -17,6 +17,7 @@
       "check-accessor",
       "check-constructor"
     ],
+    "no-bad-words": true,
     // Disabled till there’s an auto-fixer for this.
     // https://github.com/palantir/tslint/blob/master/src/rules/objectLiteralSortKeysRule.ts
     "object-literal-sort-keys": false,
@@ -31,5 +32,6 @@
       true,
       { "multiline": "always", "singleline": "never" }
     ]
-  }
+  },
+  "rulesDirectory": ["./tslint"]
 }
```

```ts
import * as Lint from "tslint"
import * as ts from "typescript"

export class Rule extends Lint.Rules.AbstractRule {
  apply(sourceFile: ts.SourceFile): Lint.RuleFailure[] {
    return []
  }
}
```

Test it out:

## Add dependencies, write rule ([`step-3`](https://github.com/ashfurrow/tsnyc-tslint-rules/tree/step-3))

Add the [`bad-words`](https://github.com/web-mech/badwords) node module:

```sh
yarn add -D bad-words
```

Implement the rule:

```diff
diff --git a/tslint/noBadWordsRule.ts b/tslint/noBadWordsRule.ts
index 3858f26..36de09f 100644
--- a/tslint/noBadWordsRule.ts
+++ b/tslint/noBadWordsRule.ts
@@ -1,8 +1,21 @@
+import * as Filter from "bad-words"
 import * as Lint from "tslint"
+import * as utils from "tsutils"
 import * as ts from "typescript"
 
 export class Rule extends Lint.Rules.AbstractRule {
   apply(sourceFile: ts.SourceFile): Lint.RuleFailure[] {
-    return []
+    const filter = new Filter()
+    return this.applyWithFunction(sourceFile, walk, { filter })
   }
 }
+
+function walk(ctx: Lint.WalkContext<any>) {
+  utils.forEachComment(ctx.sourceFile, (fullText, { kind, pos, end }) => {
+    const comment = fullText.slice(pos, end)
+    const cleanedComment = ctx.options.filter.clean(comment)
+    if (comment !== cleanedComment) {
+      ctx.addFailure(pos, end, `Found a bad word in the following comment: \`${comment}\``)
+    }
+  })
+}
```

Full implementation:

```ts
import * as Filter from "bad-words"
import * as Lint from "tslint"
import * as utils from "tsutils"
import * as ts from "typescript"

export class Rule extends Lint.Rules.AbstractRule {
  apply(sourceFile: ts.SourceFile): Lint.RuleFailure[] {
    const filter = new Filter()
    return this.applyWithFunction(sourceFile, walk, { filter })
  }
}

function walk(ctx: Lint.WalkContext<any>) {
  utils.forEachComment(ctx.sourceFile, (fullText, { kind, pos, end }) => {
    const comment = fullText.slice(pos, end)
    const cleanedComment = ctx.options.filter.clean(comment)
    if (comment !== cleanedComment) {
      ctx.addFailure(pos, end, `Found a bad word in the following comment: \`${comment}\``)
    }
  })
}
```

Add a lint violation to `src/index.ts`:

```ts
// TODO: This is a hell of a hack.
let a = 123
a = 456
```

Verify it fails:

```sh
yarn lint
yarn run v1.10.1
$ node -r ts-node/register node_modules/.bin/tslint 'src/**/*.{ts,tsx}'

ERROR: src/index.ts[5, 1]: Found a bad word in the following comment: `// TODO: This is a hell of a hack.`

error Command failed with exit code 2.
info Visit https://yarnpkg.com/en/docs/cli/run for documentation about this command.
```

Fix the lint error and commit:

```diff
diff --git a/src/index.ts b/src/index.ts
index 4e3e874..7829486 100755
--- a/src/index.ts
+++ b/src/index.ts
@@ -1,3 +1,7 @@
 export default function hello() {
   console.log("Hello World") // tslint:disable-line
 }

-// TODO: This is a hell of a hack.
+// TODO: This is a heck of a hack.
let a = 123
a = 456
```

## Add configuration to rule ([`step-4`](https://github.com/ashfurrow/tsnyc-tslint-rules/tree/step-4))

We should make our rule configurable so people can add their own custom bad words. Let's pass in configuration from `tslint.json`:

```diff
diff --git a/tslint.json b/tslint.json
index a28eb9f..2beccfd 100755
--- a/tslint.json
+++ b/tslint.json
@@ -17,7 +17,7 @@
       "check-accessor",
       "check-constructor"
     ],
-    "no-bad-words": true,
+    "no-bad-words": [true, "TODO"],
     // Disabled till there’s an auto-fixer for this.
     // https://github.com/palantir/tslint/blob/master/src/rules/objectLiteralSortKeysRule.ts
     "object-literal-sort-keys": false,
```

Let's access that configuration in our rule using the `this.getOptions()` function. Rule arguments are passed in as the `ruleArguments` key. We pass that list in using the `list` option of the `Filter` constructor.

```diff
diff --git a/tslint/noBadWordsRule.ts b/tslint/noBadWordsRule.ts
index 36de09f..76db1d8 100644
--- a/tslint/noBadWordsRule.ts
+++ b/tslint/noBadWordsRule.ts
@@ -3,14 +3,19 @@ import * as Lint from "tslint"
 import * as utils from "tsutils"
 import * as ts from "typescript"
 
+interface Options {
+  filter: any // The bad-words module has no types on DefinitelyTyped, so we need to use any.
+}
+
 export class Rule extends Lint.Rules.AbstractRule {
   apply(sourceFile: ts.SourceFile): Lint.RuleFailure[] {
-    const filter = new Filter()
+    const { ruleArguments: list } = this.getOptions()
+    const filter = new Filter({ list } as any)
     return this.applyWithFunction(sourceFile, walk, { filter })
   }
 }
 
-function walk(ctx: Lint.WalkContext<any>) {
+function walk(ctx: Lint.WalkContext<Options>) {
   utils.forEachComment(ctx.sourceFile, (fullText, { kind, pos, end }) => {
     const comment = fullText.slice(pos, end)
     const cleanedComment = ctx.options.filter.clean(comment)
```

And let's verify it works:

```sh
yarn lint
yarn run v1.10.1
$ node -r ts-node/register node_modules/.bin/tslint 'src/**/*.{ts,tsx}'

ERROR: src/index.ts[5, 1]: Found a bad word in the following comment: `// TODO: This is a heck of a hack.`

error Command failed with exit code 2.
info Visit https://yarnpkg.com/en/docs/cli/run for documentation about this command.
```

## Let's write a rule that uses the TypeScript AST ([`step-5`](https://github.com/ashfurrow/tsnyc-tslint-rules/tree/step-5))

TypeScript's AST is really cool and its easy to make TSLint rules that rely on it. See [the original repo](https://github.com/ashfurrow/tslint-playground) for more further reading on the AST.

We're going to write a new rule based on [DeMorgan's Law](https://en.wikipedia.org/wiki/De_Morgan%27s_laws), a logical principle that states the following two pieces of code behave identically.

```
if (!a && !b) { ... }
if (!(a || b)) { ... }

// Or, also:

if (!a || !b) { ... }
if (!(a && b)) { ... }
```

We'll write a rule to **minimize the number of exclamation points** in our code. Let's add our new rule to the TSLint config:

```diff
diff --git a/tslint.json b/tslint.json
index 2beccfd..9f601a1 100755
--- a/tslint.json
+++ b/tslint.json
@@ -17,6 +17,7 @@
       "check-accessor",
       "check-constructor"
     ],
+    "de-morgans": true,
     "no-bad-words": [true, "TODO"],
     // Disabled till there’s an auto-fixer for this.
     // https://github.com/palantir/tslint/blob/master/src/rules/objectLiteralSortKeysRule.ts
```

And create the new rule:

```sh
touch tslint/deMorgansRule.ts
```

And its implementation:

```ts
import * as Lint from "tslint"
import * as utils from "tsutils"
import * as ts from "typescript"

export class Rule extends Lint.Rules.AbstractRule {
  apply(sourceFile: ts.SourceFile): Lint.RuleFailure[] {
    return this.applyWithWalker(new DeMorgansWalker(sourceFile, this.getOptions()))
  }
}

class DeMorgansWalker extends Lint.RuleWalker {
  public visitBinaryExpression(node: ts.BinaryExpression) {
    if (this.isNegatedBooleanExpression(node.left) && this.isNegatedBooleanExpression(node.right)) {
      switch (node.operatorToken.kind) {
        case ts.SyntaxKind.AmpersandAmpersandToken:
          this.addFailureAtNode(node, "detected (!a && !b)")
          break
        case ts.SyntaxKind.BarBarToken:
          this.addFailureAtNode(node, "detected (!a || !b)")
          break
      }
    }

    super.visitBinaryExpression(node)
  }

  isNegatedBooleanExpression(node: ts.Node) {
    if (utils.isPrefixUnaryExpression(node)) {
      return node.operator === ts.SyntaxKind.ExclamationToken
    }
  }
}
```

And let's try it out by adding a failure to our `src/index.ts`:

```diff
diff --git a/src/index.ts b/src/index.ts
index 6b1e808..b2fb60f 100755
--- a/src/index.ts
+++ b/src/index.ts
@@ -4,3 +4,10 @@ export default function hello() {
 
 let a = 123
 a = 456
+
+const x = true
+const y = false
+
+if (!x && !y) {
+  a = 789
+}
```

Okay and let's verify it works:

```sh
yarn lint
yarn run v1.10.1
$ node -r ts-node/register node_modules/.bin/tslint 'src/**/*.{ts,tsx}'

ERROR: src/index.ts[11, 5]: detected (!a && !b)

error Command failed with exit code 2.
info Visit https://yarnpkg.com/en/docs/cli/run for documentation about this command.
```

Okay, sweet!

## Adding fix-it ([`step-6`](https://github.com/ashfurrow/tsnyc-tslint-rules/tree/step-6))

Let's add a fix-it so our DeMorgan's Rule can fix our code for us.

```diff
diff --git a/tslint/deMorgansRule.ts b/tslint/deMorgansRule.ts
index b107d17..2eebcee 100644
--- a/tslint/deMorgansRule.ts
+++ b/tslint/deMorgansRule.ts
@@ -13,10 +13,10 @@ class DeMorgansWalker extends Lint.RuleWalker {
     if (this.isNegatedBooleanExpression(node.left) && this.isNegatedBooleanExpression(node.right)) {
       switch (node.operatorToken.kind) {
         case ts.SyntaxKind.AmpersandAmpersandToken:
-          this.addFailureAtNode(node, "detected (!a && !b)")
+          this.addFailureAtNode(node, "detected (!a && !b)", this.deMorganifyIfStatement(node, "||"))
           break
         case ts.SyntaxKind.BarBarToken:
-          this.addFailureAtNode(node, "detected (!a || !b)")
+          this.addFailureAtNode(node, "detected (!a || !b)", this.deMorganifyIfStatement(node, "&&"))
           break
       }
     }
@@ -24,6 +24,13 @@ class DeMorgansWalker extends Lint.RuleWalker {
     super.visitBinaryExpression(node)
   }
 
+  deMorganifyIfStatement(expression: ts.BinaryExpression, middle: string): Lint.Replacement {
+    const left = expression.left as ts.PrefixUnaryExpression
+    const right = expression.right as ts.PrefixUnaryExpression
+    const newIfExpression = `!(${left.getChildAt(1).getFullText()} ${middle} ${right.getChildAt(1).getFullText()})`
+    return Lint.Replacement.replaceFromTo(expression.getStart(), expression.getEnd(), newIfExpression)
+  }
+
   isNegatedBooleanExpression(node: ts.Node) {
     if (utils.isPrefixUnaryExpression(node)) {
       return node.operator === ts.SyntaxKind.ExclamationToken
```

You can see that we add a `Lint.Replacement` to the end of `this.addFailureAtNode()` which is how we tell TSLint how to fix our code (if the user passes in the `--fix` flag).

And the full implementation:

```ts
import * as Lint from "tslint"
import * as utils from "tsutils"
import * as ts from "typescript"

export class Rule extends Lint.Rules.AbstractRule {
  apply(sourceFile: ts.SourceFile): Lint.RuleFailure[] {
    return this.applyWithWalker(new DeMorgansWalker(sourceFile, this.getOptions()))
  }
}

class DeMorgansWalker extends Lint.RuleWalker {
  public visitBinaryExpression(node: ts.BinaryExpression) {
    if (this.isNegatedBooleanExpression(node.left) && this.isNegatedBooleanExpression(node.right)) {
      switch (node.operatorToken.kind) {
        case ts.SyntaxKind.AmpersandAmpersandToken:
          this.addFailureAtNode(node, "detected (!a && !b)", this.deMorganifyIfStatement(node, "||"))
          break
        case ts.SyntaxKind.BarBarToken:
          this.addFailureAtNode(node, "detected (!a || !b)", this.deMorganifyIfStatement(node, "&&"))
          break
      }
    }

    super.visitBinaryExpression(node)
  }

  deMorganifyIfStatement(expression: ts.BinaryExpression, middle: string): Lint.Replacement {
    const left = expression.left as ts.PrefixUnaryExpression
    const right = expression.right as ts.PrefixUnaryExpression
    const newIfExpression = `!(${left.getChildAt(1).getFullText()} ${middle} ${right.getChildAt(1).getFullText()})`
    return Lint.Replacement.replaceFromTo(expression.getStart(), expression.getEnd(), newIfExpression)
  }

  isNegatedBooleanExpression(node: ts.Node) {
    if (utils.isPrefixUnaryExpression(node)) {
      return node.operator === ts.SyntaxKind.ExclamationToken
    }
  }
}
```

And finally, verify it works:

```sh
yarn lint --fix
yarn run v1.10.1
$ node -r ts-node/register node_modules/.bin/tslint 'src/**/*.{ts,tsx}' --fix
Fixed 1 error(s) in src/index.ts


✨  Done in 1.57s.
git diff src/index.ts
diff --git a/src/index.ts b/src/index.ts
index b2fb60f..0afe98c 100755
--- a/src/index.ts
+++ b/src/index.ts
@@ -8,6 +8,6 @@ a = 456
 const x = true
 const y = false
 
-if (!x && !y) {
+if (!(x || y)) {
   a = 789
 }
```

Nice, it works! Commit everything.
