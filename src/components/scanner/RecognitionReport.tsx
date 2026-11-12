import type { RecognitionDiagnostics } from "../../recognition/types";
export function RecognitionReport({
  report,
  onExportLabels,
  reconstructionImage,
}: {
  report: RecognitionDiagnostics | null;
  onExportLabels?: () => void;
  reconstructionImage?: string;
}) {
  if (!report) return null;
  const download = () => {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(report, null, 2)], { type: "application/json" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "chesslens-recognition-report.json";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <details className="recognition-report">
      <summary>Recognition report</summary>
      <p>
        Tried {report.crops.length} board crops in {report.elapsedMs} ms. The
        extra piece check agrees on{" "}
        {report.tiles.filter((tile) => tile.agreed).length}/
        {report.tiles.length} squares.
      </p>
      <p>
        That extra check is still being tested. Both checks can agree and still
        miss a piece, so it’s worth a quick look at the board.
      </p>
      {report.processing && (
        <p>
          {report.processing.clearFirstPass} squares were clear on the first
          try. {report.processing.refined.length} got another look.
          {report.processing.deferred > 0
            ? ` Please check ${report.processing.deferred === 1 ? "the remaining square" : `the ${report.processing.deferred} remaining squares`}.`
            : ""}
        </p>
      )}
      {report.coordinates && (
        <p>
          Board direction came from{" "}
          {report.orientationSource === "coordinates"
            ? `${report.coordinates.matched} labels along the edges`
            : report.orientationSource === "tracked-game"
              ? "your saved game"
              : "the piece positions"}
          .
          {report.coordinates.orientation
            ? ""
            : " There weren’t enough clear edge labels to confirm it."}
        </p>
      )}
      {report.reconstruction && (
        <p>
          Compared piece shapes on {report.reconstruction.checked}/64 squares
          with saved examples.
          {report.reconstruction.outliers.length
            ? ` Take a look at ${report.reconstruction.outliers.join(", ")}.`
            : ""}
        </p>
      )}
      {reconstructionImage && (
        <figure className="reconstruction-preview">
          <img
            src={reconstructionImage}
            alt="Reconstructed foreground board"
            width={384}
            height={384}
          />
          <figcaption>
            Striped squares don’t have a saved example to compare with yet.
          </figcaption>
        </figure>
      )}
      {report.tracking && (
        <p>
          {report.tracking.matched
            ? `Matched your game: ${report.tracking.moves?.join(" ") || "same position"}`
            : "Couldn’t match this to one clear next position, so the whole board was scanned again."}
        </p>
      )}
      {report.missingNativeLabels.length > 0 && (
        <p>
          Detailed examples are still missing for{" "}
          {report.missingNativeLabels.join(" ")}. Those pieces use the other
          shape checks.
        </p>
      )}
      <button className="secondary" onClick={download}>
        Download scan report
      </button>
      {onExportLabels && (
        <button className="text-button" onClick={onExportLabels}>
          Save board labels
        </button>
      )}
      <table>
        <thead>
          <tr>
            <th>Square</th>
            <th>Piece</th>
            <th>Extra check</th>
            <th>Other matches</th>
          </tr>
        </thead>
        <tbody>
          {report.tiles
            .filter(
              (tile) =>
                !tile.agreed ||
                tile.alternatives[1]?.distance -
                  tile.alternatives[0]?.distance <
                  0.02,
            )
            .map((tile) => (
              <tr key={tile.square}>
                <td>{tile.square}</td>
                <td>{tile.piece}</td>
                <td>{tile.secondary.piece}</td>
                <td>
                  {tile.alternatives
                    .map((a) => `${a.piece} ${a.distance.toFixed(3)}`)
                    .join(" · ")}
                </td>
              </tr>
            ))}
        </tbody>
      </table>
    </details>
  );
}
