import model from "./second-reader-model.json" with { type: "json" };
/** A different trained decision function; its limited data does not certify independence. */
export function secondRead(mask: Float32Array, color: number[]) {
  const input = [...mask, ...color.map((value) => value / 255)].map((value) =>
    Math.max(-1, Math.min(1, value * 2 - 1)),
  );
  const hidden = Array.from({ length: model.hidden }, (_, j) =>
    Math.tanh(
      model.b1[j] +
        input.reduce(
          (sum, value, i) => sum + value * model.w1[i * model.hidden + j],
          0,
        ),
    ),
  );
  const logits = model.labels.map(
    (_label, j) =>
      model.b2[j] +
      hidden.reduce(
        (sum, value, i) => sum + value * model.w2[i * model.labels.length + j],
        0,
      ),
  );
  const max = Math.max(...logits),
    exp = logits.map((value) => Math.exp(value - max)),
    sum = exp.reduce((a, b) => a + b, 0);
  const ranked = model.labels
    .map((piece, i) => ({ piece, score: exp[i] / sum }))
    .sort((a, b) => b.score - a.score);
  return {
    piece: ranked[0].piece,
    activation: ranked[0].score,
    alternatives: ranked.slice(0, 3),
    validated: model.validation.independentlyValidated,
  };
}
export const secondReaderInfo = {
  id: model.id,
  policy: model.validation.policy,
  validated: model.validation.independentlyValidated,
};
