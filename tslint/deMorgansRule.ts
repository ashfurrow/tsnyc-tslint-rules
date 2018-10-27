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
