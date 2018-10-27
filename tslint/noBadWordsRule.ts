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
