import type { RecognitionDiagnostics } from "../../recognition/types";
export function RecognitionReport({
  report,
  onExportLabels,
}: {
  report: RecognitionDiagnostics | null;
  onExportLabels?: () => void;
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
        {report.crops.length} board alignments checked · {report.elapsedMs} ms.
        Readers agree on {report.tiles.filter((tile) => tile.agreed).length}/
        {report.tiles.length} squares.
      </p>
      <p>
        Second reader is experimental. Agreement is not a calibrated accuracy
        score.
      </p>
      {report.tracking && (
        <p>
          {report.tracking.matched
            ? `Game continuation: ${report.tracking.moves?.join(" ") || "same position"}`
            : "No unique continuation; full image recognition used."}
        </p>
      )}
      <p>
        Native piece library: {report.nativeLabels.join(" ")}. Missing
        high-resolution types: {report.missingNativeLabels.join(" ")}.
      </p>
      <button className="secondary" onClick={download}>
        Download diagnostic report
      </button>
      {onExportLabels && (
        <button className="text-button" onClick={onExportLabels}>
          Export current board labels
        </button>
      )}
      <table>
        <thead>
          <tr>
            <th>Square</th>
            <th>Read</th>
            <th>Other reader</th>
            <th>Alternatives</th>
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
