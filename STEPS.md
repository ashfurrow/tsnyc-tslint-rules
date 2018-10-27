# Steps

These are steps for my [meetup talk](https://www.meetup.com/TypeScriptNYC/events/255170060/). Code in this repo after each step is committed at a tag listed beside the step (see [tags](https://github.com/ashfurrow/tsnyc-tslint-rules/tags)).

## Create Project (`step-1`)

```sh
yo artsy
```

And follow the prompts.

## Create basic rule (`step-2`)

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

```sh
mkdir tslint
# Add "rulesDirectory": ["./tslint"] to tslint.json
touch tslint/noBadWordsRule.ts
# Add "no-bad-words": true, to tslint.json
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

## Add dependencies, write rule (`step-3`)

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

## Add configuration to rule (`step-4`)

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
+  filter: any
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
